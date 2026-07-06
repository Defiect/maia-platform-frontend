/**
 * Engine execution mode settings for the private LAN deployment.
 *
 * Each engine (Maia, Stockfish) can independently run either:
 *  - 'client': in the browser (WASM / onnxruntime-web), the default
 *  - 'server': on the host machine via the engine-server sidecar
 *    (native Stockfish over WebSocket, Maia via onnxruntime-node)
 *
 * Settings persist in localStorage and broadcast changes via a window event
 * so React hooks and engine providers can react to toggles.
 */

export type EngineMode = 'client' | 'server'

export const STOCKFISH_MODE_KEY = 'maia.engineMode.stockfish'
export const MAIA_MODE_KEY = 'maia.engineMode.maia'
export const ENGINE_MODE_CHANGE_EVENT = 'maia:engine-mode-change'

const isEngineMode = (value: unknown): value is EngineMode =>
  value === 'client' || value === 'server'

/**
 * Multithreaded Stockfish WASM needs SharedArrayBuffer, which browsers only
 * enable in cross-origin-isolated contexts. Plain-HTTP LAN origins (e.g.
 * http://192.168.1.174:8080) are untrustworthy, so COOP/COEP is ignored and
 * client-side Stockfish cannot run — default to server mode there.
 */
const clientStockfishSupported = (): boolean =>
  typeof window === 'undefined' ||
  typeof SharedArrayBuffer !== 'undefined' ||
  window.crossOriginIsolated

const defaultMode = (key: string): EngineMode =>
  key === STOCKFISH_MODE_KEY && !clientStockfishSupported()
    ? 'server'
    : 'client'

const readMode = (key: string): EngineMode => {
  if (typeof window === 'undefined') return 'client'
  try {
    const value = window.localStorage.getItem(key)
    return isEngineMode(value) ? value : defaultMode(key)
  } catch {
    return defaultMode(key)
  }
}

export const getStockfishMode = (): EngineMode => readMode(STOCKFISH_MODE_KEY)
export const getMaiaMode = (): EngineMode => readMode(MAIA_MODE_KEY)

const writeMode = (key: string, mode: EngineMode) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, mode)
  } catch {
    // ignore localStorage failures
  }
  window.dispatchEvent(new CustomEvent(ENGINE_MODE_CHANGE_EVENT))
}

export const setStockfishMode = (mode: EngineMode) =>
  writeMode(STOCKFISH_MODE_KEY, mode)
export const setMaiaMode = (mode: EngineMode) => writeMode(MAIA_MODE_KEY, mode)

/**
 * Base HTTP URL of the engine-server sidecar. Defaults to the page's host on
 * port 3001 so it works from any LAN client without configuration.
 */
export const getEngineServerUrl = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_ENGINE_SERVER_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return 'http://localhost:3001'
  return `${window.location.protocol}//${window.location.hostname}:3001`
}

export const getEngineServerWsUrl = (): string => {
  const base = getEngineServerUrl()
  return base.replace(/^http/, 'ws')
}
