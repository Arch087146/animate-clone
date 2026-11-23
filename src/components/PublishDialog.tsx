import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { defaultExportOptions, exportProject, VIDEO_FORMATS, type ExportOptions, type VideoFormat } from '../exportVideo'
import { useStore } from '../store'

/** Animate-style Publish Settings dialog with video and image export formats. */
export function PublishDialog() {
  const { state, dispatch } = useStore()
  const { project, showPublish } = state
  const [options, setOptions] = useState<ExportOptions>(() => ({
    ...defaultExportOptions,
    format: (VIDEO_FORMATS.find((f) => f.id === state.publishFormat)?.id ?? 'mp4') as VideoFormat,
  }))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('')
  const [result, setResult] = useState('')

  const close = () => {
    if (busy) return
    dispatch({ type: 'SET_PUBLISH_OPEN', open: false })
  }

  useEffect(() => {
    if (!showPublish) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPublish, busy])

  useEffect(() => {
    if (!showPublish || !window.electronAPI?.onExportProgress) return
    const dispose = window.electronAPI.onExportProgress((fraction) => setProgress(0.65 + fraction * 0.35))
    return dispose
  }, [showPublish])

  useEffect(() => {
    if (!showPublish) { setBusy(false); setProgress(0); setResult(''); return }
    const requested = VIDEO_FORMATS.find((f) => f.id === state.publishFormat)?.id ?? 'mp4'
    setOptions((prev) => ({ ...prev, format: requested }))
  }, [showPublish, state.publishFormat])

  if (!showPublish) return null

  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }))

  const formatInfo = VIDEO_FORMATS.find((f) => f.id === options.format)!
  const size = {
    width: Math.max(2, Math.round(project.width * options.scale / 2) * 2),
    height: Math.max(2, Math.round(project.height * options.scale / 2) * 2),
  }

  const run = async () => {
    setBusy(true)
    setProgress(0)
    setResult('')
    try {
      const message = await exportProject(project, options, (p, text) => {
        setProgress(p)
        setLabel(text)
      })
      setResult(message)
    } catch (err) {
      setResult(`Export failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop publish-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="publish-modal" role="dialog" aria-label="Publish Settings">
        <div className="publish-titlebar">
          <Icon name="export" size={15} />
          <span>Publish Settings</span>
          <button title="Close" onClick={close}><Icon name="close" size={13} /></button>
        </div>

        <div className="publish-body">
          <div className="publish-formats">
            <div className="publish-group-title">FORMAT</div>
            {VIDEO_FORMATS.map((f) => (
              <button
                key={f.id}
                className={`publish-format ${options.format === f.id ? 'active' : ''}`}
                onClick={() => set('format', f.id as VideoFormat)}
              >
                <span className="publish-format-name">{f.label}</span>
                <span className="publish-format-note">{f.note}</span>
              </button>
            ))}
          </div>

          <div className="publish-settings">
            <div className="publish-group-title">{formatInfo.label.toUpperCase()} SETTINGS</div>

            <div className="publish-row"><label>File name</label><span className="publish-static">{project.name}.{formatInfo.ext}</span></div>
            <div className="publish-row"><label>Stage size</label><span className="publish-static">{project.width} × {project.height} px</span></div>
            <div className="publish-row"><label>Output size</label><span className="publish-static">{size.width} × {size.height} px</span></div>

            <div className="publish-row">
              <label htmlFor="pub-fps">Frames per second</label>
              <input id="pub-fps" type="number" min="1" max="60" value={options.fps || project.fps}
                onChange={(e) => set('fps', Math.max(1, Math.min(60, Number(e.target.value))))} />
            </div>

            <div className="publish-row">
              <label htmlFor="pub-scale">Scale</label>
              <select id="pub-scale" value={options.scale} onChange={(e) => set('scale', Number(e.target.value))}>
                <option value={0.25}>25%</option>
                <option value={0.5}>50%</option>
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.5}>150%</option>
                <option value={2}>200%</option>
              </select>
            </div>

            {!['html', 'json', 'pngseq', 'sheet'].includes(options.format) && (
              <div className="publish-row">
                <label htmlFor="pub-quality">Quality</label>
                <div className="publish-quality">
                  <input id="pub-quality" type="range" min="10" max="100" value={options.quality}
                    onChange={(e) => set('quality', Number(e.target.value))} />
                  <span>{options.quality}%</span>
                </div>
              </div>
            )}

            {['gif', 'apng'].includes(options.format) && (
              <div className="publish-row">
                <label htmlFor="pub-loop">Loops</label>
                <input id="pub-loop" type="number" min="0" max="999" value={options.loop}
                  onChange={(e) => set('loop', Math.max(0, Number(e.target.value)))} />
              </div>
            )}

            <label className="publish-check">
              <input type="checkbox" checked={options.includeBones} onChange={(e) => set('includeBones', e.target.checked)} />
              Include bone overlay in export
            </label>

            <div className="publish-estimate">
              <Icon name="film" size={13} /> {project.totalFrames} frames · {project.name} · {project.fps} fps source
            </div>

            {busy && (
              <div className="publish-progress">
                <div className="publish-progress-bar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <span>{label || 'Working...'} · {Math.round(progress * 100)}%</span>
              </div>
            )}
            {result && <div className="publish-result">{result}</div>}
          </div>
        </div>

        <div className="publish-footer">
          <span>Exports use the exact stage size and frame rate from your document.</span>
          <div>
            <button className="publish-cancel" onClick={close} disabled={busy}>Cancel</button>
            <button className="publish-export" onClick={run} disabled={busy}>
              <Icon name="export" size={13} /> {busy ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
