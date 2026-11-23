/** Frameless-window buttons, docked at the right end of a top bar. */
export function WindowControls() {
  if (!window.electronAPI?.isElectron) return null

  return (
    <div className="win-controls" role="group" aria-label="Window controls">
      <button title="Minimize" aria-label="Minimize" onClick={() => window.electronAPI?.minimize()}>
        <svg viewBox="0 0 12 12"><path d="M2 8.5h8" /></svg>
      </button>
      <button title="Maximize" aria-label="Maximize" onClick={() => window.electronAPI?.maximize()}>
        <svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" /></svg>
      </button>
      <button className="close" title="Close" aria-label="Close" onClick={() => window.electronAPI?.close()}>
        <svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" /></svg>
      </button>
    </div>
  )
}
