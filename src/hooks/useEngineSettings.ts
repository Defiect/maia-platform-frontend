import { useCallback, useEffect, useState } from 'react'

import {
  EngineMode,
  ENGINE_MODE_CHANGE_EVENT,
  getMaiaMode,
  getStockfishMode,
  setMaiaMode as persistMaiaMode,
  setStockfishMode as persistStockfishMode,
} from 'src/lib/engine/engineSettings'

/**
 * Reactive view of the per-engine client/server execution mode toggles.
 * State is persisted in localStorage and synchronized across all consumers
 * (and browser tabs) via a window event.
 */
export const useEngineSettings = () => {
  const [stockfishMode, setStockfishModeState] = useState<EngineMode>('client')
  const [maiaMode, setMaiaModeState] = useState<EngineMode>('client')

  useEffect(() => {
    const sync = () => {
      setStockfishModeState(getStockfishMode())
      setMaiaModeState(getMaiaMode())
    }

    sync()
    window.addEventListener(ENGINE_MODE_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(ENGINE_MODE_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setStockfishMode = useCallback((mode: EngineMode) => {
    persistStockfishMode(mode)
  }, [])

  const setMaiaMode = useCallback((mode: EngineMode) => {
    persistMaiaMode(mode)
  }, [])

  return { stockfishMode, maiaMode, setStockfishMode, setMaiaMode }
}
