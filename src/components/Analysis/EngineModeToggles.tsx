import React from 'react'

import { useEngineSettings } from 'src/hooks/useEngineSettings'
import type { EngineMode } from 'src/lib/engine/engineSettings'

interface ToggleProps {
  label: string
  mode: EngineMode
  onToggle: (mode: EngineMode) => void
}

const EngineModeToggle: React.FC<ToggleProps> = ({ label, mode, onToggle }) => {
  const isServer = mode === 'server'

  return (
    <button
      type="button"
      onClick={() => onToggle(isServer ? 'client' : 'server')}
      className="flex items-center gap-1 rounded-md border border-glass-border bg-glass px-2 py-1 text-xs transition-colors hover:bg-glass-stronger"
      title={`${label} runs ${
        isServer ? 'on the engine server' : 'in this browser'
      } — click to switch`}
      aria-pressed={isServer}
    >
      <span className="material-symbols-outlined !text-xs text-white/80">
        {isServer ? 'dns' : 'computer'}
      </span>
      <span className="text-white/90">
        {label}: {isServer ? 'Server' : 'Client'}
      </span>
    </button>
  )
}

/**
 * Independent client/server execution toggles for the Maia and Stockfish
 * engines. Intended for trusted (LAN) deployments where an engine-server
 * sidecar is available.
 */
export const EngineModeToggles: React.FC = () => {
  const { stockfishMode, maiaMode, setStockfishMode, setMaiaMode } =
    useEngineSettings()

  return (
    <div className="flex items-center gap-1">
      <EngineModeToggle label="Maia" mode={maiaMode} onToggle={setMaiaMode} />
      <EngineModeToggle
        label="SF"
        mode={stockfishMode}
        onToggle={setStockfishMode}
      />
    </div>
  )
}
