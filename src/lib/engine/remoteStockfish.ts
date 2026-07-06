import type StockfishWeb from '@lichess-org/stockfish-web'

import { getEngineServerWsUrl } from './engineSettings'

/**
 * A StockfishWeb-compatible shim that forwards UCI traffic to the
 * engine-server sidecar over a WebSocket instead of running the WASM build.
 *
 * The server pipes each connection to a dedicated native Stockfish process,
 * so the entire client-side analysis orchestration (staged root probing,
 * MultiPV snapshot streaming, progressive depth updates) works unchanged.
 */
export class RemoteStockfishWeb implements StockfishWeb {
  listen: (data: string) => void = () => undefined
  onError: (msg: string) => void = () => undefined

  private ws: WebSocket | null = null
  private pendingCommands: string[] = []
  private connected = false
  private closed = false
  private readyPromise: Promise<void>

  constructor(url: string = `${getEngineServerWsUrl()}/ws/stockfish`) {
    this.readyPromise = new Promise((resolve, reject) => {
      let settled = false

      const fail = (message: string) => {
        this.connected = false
        if (!settled) {
          settled = true
          reject(new Error(message))
        } else {
          this.onError(message)
        }
      }

      try {
        this.ws = new WebSocket(url)
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : 'Failed to open engine server WebSocket',
        )
        return
      }

      this.ws.onopen = () => {
        this.connected = true
        for (const command of this.pendingCommands) {
          this.ws?.send(command)
        }
        this.pendingCommands = []
        if (!settled) {
          settled = true
          resolve()
        }
      }

      this.ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        // The server sends one UCI line per message, but split defensively.
        for (const line of event.data.split(/\r?\n/)) {
          if (line) this.listen(line)
        }
      }

      this.ws.onerror = () => {
        fail(`Could not reach engine server at ${url}`)
      }

      this.ws.onclose = () => {
        if (this.closed) return
        fail('Engine server connection closed')
      }
    })
  }

  /** Resolves once the WebSocket is connected; rejects on failure. */
  ready(): Promise<void> {
    return this.readyPromise
  }

  uci(command: string): void {
    if (this.closed) return
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(command)
    } else {
      this.pendingCommands.push(command)
    }
  }

  // NNUE management is a no-op in server mode: the native engine loads its
  // own networks. These exist to satisfy the StockfishWeb interface.
  setNnueBuffer(_data: Uint8Array, _index?: number): void {
    // no-op
  }

  getRecommendedNnue(_index?: number): string {
    return ''
  }

  destroy(): void {
    this.closed = true
    this.connected = false
    try {
      this.ws?.close()
    } catch {
      // ignore
    }
    this.ws = null
  }
}

export default RemoteStockfishWeb
