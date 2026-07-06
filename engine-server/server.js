/**
 * Maia engine-server sidecar.
 *
 * Trusted-LAN service exposing:
 *  - GET  /health        → { ok, maia, maiaProvider, stockfish }
 *  - WS   /ws/stockfish  → one native Stockfish process per connection;
 *                          each WebSocket text message is a UCI command,
 *                          each UCI output line is sent as one message.
 *  - POST /maia/batch    → Maia ONNX inference on a preprocessed batch.
 *                          Request JSON: { tokens, eloSelfs, eloOppos, batchSize }
 *                          Response: binary — uint32-LE move-logit count,
 *                          then move logits, then value logits (float32).
 *
 * Environment:
 *  - PORT                (default 3001)
 *  - STOCKFISH_PATH      (default 'stockfish')
 *  - STOCKFISH_THREADS   (default max(1, cpus - 2))
 *  - STOCKFISH_HASH_MB   (default 512)
 *  - MAIA_MODEL_PATH     (default ./models/maia3_simplified.onnx)
 *  - ONNX_EXECUTION      ('cuda' | 'cpu' | 'auto', default 'auto')
 *
 * This service is intended for private LAN use only — it has no
 * authentication and must not be exposed to the public internet.
 */

const http = require('http')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const { WebSocketServer } = require('ws')
const ort = require('onnxruntime-node')

const PORT = Number.parseInt(process.env.PORT || '3001', 10)
const STOCKFISH_PATH = process.env.STOCKFISH_PATH || 'stockfish'
const STOCKFISH_THREADS = Number.parseInt(
  process.env.STOCKFISH_THREADS || String(Math.max(1, os.cpus().length - 2)),
  10,
)
const STOCKFISH_HASH_MB = Number.parseInt(
  process.env.STOCKFISH_HASH_MB || '512',
  10,
)
const MAIA_MODEL_PATH =
  process.env.MAIA_MODEL_PATH ||
  path.join(__dirname, 'models', 'maia3_simplified.onnx')
const ONNX_EXECUTION = (process.env.ONNX_EXECUTION || 'auto').toLowerCase()

// ── Maia ONNX session ────────────────────────────────────────────────────────

let maiaSession = null
let maiaProvider = 'none'
// Serialize inference: ORT sessions are not safe for concurrent run() calls.
let maiaQueue = Promise.resolve()

async function initMaia() {
  if (!fs.existsSync(MAIA_MODEL_PATH)) {
    console.warn(`[maia] model not found at ${MAIA_MODEL_PATH}; disabled`)
    return
  }

  const attempts = []
  if (ONNX_EXECUTION === 'cuda' || ONNX_EXECUTION === 'auto') {
    attempts.push('cuda')
  }
  if (ONNX_EXECUTION === 'cpu' || ONNX_EXECUTION === 'auto') {
    attempts.push('cpu')
  }

  for (const provider of attempts) {
    try {
      maiaSession = await ort.InferenceSession.create(MAIA_MODEL_PATH, {
        executionProviders: [provider],
      })
      maiaProvider = provider
      console.log(`[maia] model loaded with ${provider} execution provider`)
      return
    } catch (error) {
      console.warn(
        `[maia] failed to initialize ${provider} execution provider:`,
        error.message || error,
      )
    }
  }

  console.error('[maia] no usable execution provider; Maia disabled')
}

async function runMaiaBatch({ tokens, eloSelfs, eloOppos, batchSize }) {
  if (!maiaSession) {
    throw new Error('Maia model is not loaded')
  }

  const feeds = {
    tokens: new ort.Tensor('float32', Float32Array.from(tokens), [
      batchSize,
      64,
      12,
    ]),
    elo_self: new ort.Tensor('float32', Float32Array.from(eloSelfs), [
      batchSize,
    ]),
    elo_oppo: new ort.Tensor('float32', Float32Array.from(eloOppos), [
      batchSize,
    ]),
  }

  const run = maiaQueue.then(() => maiaSession.run(feeds))
  maiaQueue = run.catch(() => undefined)
  const result = await run

  return {
    logitsMove: new Float32Array(result.logits_move.data),
    logitsValue: new Float32Array(result.logits_value.data),
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Allow embedding responses in the COEP-isolated (require-corp) web app.
  'Cross-Origin-Resource-Policy': 'cross-origin',
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(body))
}

function readRequestBody(req, limitBytes = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limitBytes) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      maia: maiaSession !== null,
      maiaProvider,
      stockfish: STOCKFISH_PATH,
      threads: STOCKFISH_THREADS,
      hashMb: STOCKFISH_HASH_MB,
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/maia/batch') {
    try {
      const body = JSON.parse((await readRequestBody(req)).toString('utf8'))
      const { tokens, eloSelfs, eloOppos, batchSize } = body

      if (
        !Array.isArray(tokens) ||
        !Array.isArray(eloSelfs) ||
        !Array.isArray(eloOppos) ||
        !Number.isInteger(batchSize) ||
        batchSize <= 0 ||
        batchSize > 64 ||
        tokens.length !== batchSize * 64 * 12 ||
        eloSelfs.length !== batchSize ||
        eloOppos.length !== batchSize
      ) {
        sendJson(res, 400, { error: 'Malformed inference batch' })
        return
      }

      const startedAt = Date.now()
      const { logitsMove, logitsValue } = await runMaiaBatch(body)
      const elapsedMs = Date.now() - startedAt

      const header = Buffer.alloc(4)
      header.writeUInt32LE(logitsMove.length, 0)
      const payload = Buffer.concat([
        header,
        Buffer.from(logitsMove.buffer, logitsMove.byteOffset, logitsMove.byteLength),
        Buffer.from(logitsValue.buffer, logitsValue.byteOffset, logitsValue.byteLength),
      ])

      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'application/octet-stream',
        'X-Inference-Ms': String(elapsedMs),
        'X-Execution-Provider': maiaProvider,
      })
      res.end(payload)
    } catch (error) {
      console.error('[maia] inference error:', error.message || error)
      sendJson(res, 500, { error: error.message || 'Inference failed' })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

// ── Stockfish over WebSocket ─────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws/stockfish' })

wss.on('connection', (ws, req) => {
  const remote = req.socket.remoteAddress
  console.log(`[sf] connection from ${remote}`)

  let engine
  try {
    engine = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (error) {
    console.error('[sf] failed to spawn stockfish:', error.message || error)
    ws.close(1011, 'Failed to start engine')
    return
  }

  engine.on('error', (error) => {
    console.error('[sf] engine error:', error.message || error)
    ws.close(1011, 'Engine process error')
  })

  engine.stdin.write(`setoption name Threads value ${STOCKFISH_THREADS}\n`)
  engine.stdin.write(`setoption name Hash value ${STOCKFISH_HASH_MB}\n`)

  // Stream stdout line by line — one UCI line per WebSocket message.
  let stdoutBuffer = ''
  engine.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString('utf8')
    let newlineIndex
    while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '')
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
      if (line && ws.readyState === ws.OPEN) {
        ws.send(line)
      }
    }
  })

  engine.stderr.on('data', (chunk) => {
    console.error('[sf] stderr:', chunk.toString('utf8').trim())
  })

  engine.on('exit', (code) => {
    console.log(`[sf] engine exited (${code})`)
    if (ws.readyState === ws.OPEN) {
      ws.close(1011, 'Engine process exited')
    }
  })

  ws.on('message', (data) => {
    const command = data.toString('utf8').trim()
    if (!command) return
    // UCI commands from our own client; no shell involved, plain stdin write.
    engine.stdin.write(`${command}\n`)
  })

  ws.on('close', () => {
    console.log(`[sf] connection closed (${remote})`)
    try {
      engine.stdin.write('quit\n')
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (engine.exitCode === null) {
        engine.kill('SIGKILL')
      }
    }, 1000)
  })

  ws.on('error', () => {
    // handled by close
  })
})

// ── Startup ──────────────────────────────────────────────────────────────────

initMaia().finally(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`engine-server listening on 0.0.0.0:${PORT}`)
    console.log(
      `  stockfish: ${STOCKFISH_PATH} (threads=${STOCKFISH_THREADS}, hash=${STOCKFISH_HASH_MB}MB)`,
    )
    console.log(`  maia: ${maiaSession ? `loaded (${maiaProvider})` : 'disabled'}`)
  })
})
