import { Icon } from '../Icon'
import { useStore } from '../store'

export function TitleBar() {
  const { state } = useStore()
  if (!window.electronAPI?.isElectron) return null

  return (
    <div className="title-bar">
      <div className="title-bar-app">
        <Icon name="Adobe" size={15} />
        <span>Animate</span>
        <span className="title-version">2026</span>
      </div>
      <div className="title-bar-doc">{state.project.name} — {state.project.width} × {state.project.height}</div>
      <div className="title-bar-controls">
        <button title="Minimize" onClick={() => window.electronAPI?.minimize()}>
          <svg viewBox="0 0 12 12"><path d="M2 8.5h8" /></svg>
        </button>
        <button title="Maximize" onClick={() => window.electronAPI?.maximize()}>
          <svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" /></svg>
        </button>
        <button className="close" title="Close" onClick={() => window.electronAPI?.close()}>
          <svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
