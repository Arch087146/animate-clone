import { useEffect, useState } from 'react'
import { BoneOptions } from './BoneOptions'
import { Icon } from '../Icon'
import { useStore } from '../store'
import { createShape, type Shape, uid } from '../types'
import { getActiveKeyframe } from '../utils'

const SWATCHES = [
  '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
  '#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
  '#7f00ff', '#ff00ff', '#ff7f7f', '#ffbf7f', '#ffff7f', '#bfff7f',
  '#7fffbf', '#7fffff', '#7fbfff', '#7f7fff', '#bf7fff', '#ff7fbf',
  '#8b4513', '#a0522d', '#3cb371', '#2e8b57', '#4682b4', '#1e90ff',
]

export function RightPanel() {
  const { state, dispatch } = useStore()
  const { project, selection, currentFrame } = state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    document: true, position: true, fill: true, appearance: true, tween: true, frame: true, bone: true, rig: true,
  })
  const [showMore, setShowMore] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null)
  const [constrainProportions, setConstrainProportions] = useState(false)
  const [alignToSelection, setAlignToSelection] = useState(false)
  const [scaleX, setScaleX] = useState(100)
  const [scaleY, setScaleY] = useState(100)

  useEffect(() => { setScaleX(100); setScaleY(100) }, [selection.shapeId])

  const layer = project.layers.find((l) => l.id === selection.layerId)
  const kf = layer ? getActiveKeyframe(layer, currentFrame) : null
  const shape = kf?.shapes.find((s) => s.id === selection.shapeId)
  const bone = kf ? (kf.bones ?? []).find((b) => b.id === selection.boneId) : null

  const toggle = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }))
  const patch = (p: Partial<Shape>) => {
    if (!shape || !layer) return
    dispatch({ type: 'UPDATE_SHAPE', layerId: layer.id, shapeId: shape.id, patch: p })
  }
  const number = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback)

  /** Keeps absolute brush/path points aligned when a shape is moved or resized. */
  const geometryPatchFor = (source: Shape, next: Partial<Shape>): Partial<Shape> => {
    const sx = source.width ? (next.width ?? source.width) / source.width : 1
    const sy = source.height ? (next.height ?? source.height) / source.height : 1
    const dx = (next.x ?? source.x) - source.x
    const dy = (next.y ?? source.y) - source.y
    return {
      ...next,
      points: source.points?.map((point) => ({
        x: source.x + dx + (point.x - source.x) * sx,
        y: source.y + dy + (point.y - source.y) * sy,
      })),
    }
  }
  const patchGeometry = (next: Partial<Shape>) => { if (shape) patch(geometryPatchFor(shape, next)) }

  const siblings = kf?.shapes ?? []
  const alignBounds = () => {
    if (!alignToSelection || !siblings.length) return { x: 0, y: 0, width: project.width, height: project.height }
    const minX = Math.min(...siblings.map((s) => s.x))
    const minY = Math.min(...siblings.map((s) => s.y))
    const maxX = Math.max(...siblings.map((s) => s.x + s.width))
    const maxY = Math.max(...siblings.map((s) => s.y + s.height))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  const alignShape = (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!shape) return
    const b = alignBounds()
    const next: Partial<Shape> =
      direction === 'left' ? { x: b.x }
      : direction === 'center' ? { x: b.x + (b.width - shape.width) / 2 }
      : direction === 'right' ? { x: b.x + b.width - shape.width }
      : direction === 'top' ? { y: b.y }
      : direction === 'middle' ? { y: b.y + (b.height - shape.height) / 2 }
      : { y: b.y + b.height - shape.height }
    patchGeometry(next)
  }
  const distribute = (axis: 'x' | 'y') => {
    if (!layer || siblings.length < 3) {
      dispatch({ type: 'STATUS', message: 'Add at least 3 shapes to distribute them' })
      return
    }
    const sorted = [...siblings].sort((a, b) => axis === 'x'
      ? (a.x + a.width / 2) - (b.x + b.width / 2)
      : (a.y + a.height / 2) - (b.y + b.height / 2))
    const centerOf = (s: Shape) => axis === 'x' ? s.x + s.width / 2 : s.y + s.height / 2
    const start = centerOf(sorted[0])
    const step = (centerOf(sorted[sorted.length - 1]) - start) / (sorted.length - 1)
    sorted.forEach((s, i) => {
      const next = axis === 'x' ? { x: start + step * i - s.width / 2 } : { y: start + step * i - s.height / 2 }
      dispatch({ type: 'UPDATE_SHAPE', layerId: layer.id, shapeId: s.id, patch: geometryPatchFor(s, next) })
    })
    dispatch({ type: 'STATUS', message: `Distributed ${sorted.length} shapes ${axis === 'x' ? 'horizontally' : 'vertically'}` })
  }
  const applyScale = (axis: 'x' | 'y', value: number) => {
    if (!shape || value <= 0) return
    const previous = axis === 'x' ? scaleX : scaleY
    const ratio = value / Math.max(1, previous)
    if (axis === 'x') { patchGeometry({ width: Math.max(1, shape.width * ratio) }); setScaleX(value) }
    else { patchGeometry({ height: Math.max(1, shape.height * ratio) }); setScaleY(value) }
  }
  const flipShape = (axis: 'h' | 'v') => {
    if (!shape) return
    patch(axis === 'h' ? { flipX: !shape.flipX, rotation: -shape.rotation } : { flipY: !shape.flipY, rotation: -shape.rotation })
    dispatch({ type: 'STATUS', message: `Flipped ${shape.name} ${axis === 'h' ? 'horizontally' : 'vertically'}` })
  }

  const q = librarySearch.trim().toLowerCase()
  const visibleLibrary = (project.library ?? []).filter((item) => !q || item.name.toLowerCase().includes(q))
  const newSymbol = () => {
    const id = uid('symbol')
    const source = shape ?? createShape({ name: 'Symbol', type: 'oval', x: 40, y: 40, width: 80, height: 80 })
    dispatch({
      type: 'ADD_LIBRARY_ITEM',
      item: { id, name: `${source.name} Symbol`, type: 'Graphic', shapes: [{ ...source, points: source.points?.map((p) => ({ ...p })) }] },
    })
    setSelectedLibraryId(id)
  }
  const newFolder = () => {
    const id = uid('folder')
    dispatch({ type: 'ADD_LIBRARY_ITEM', item: { id, name: `Folder ${(project.library ?? []).length + 1}`, type: 'Graphic', folder: true, shapes: [] } })
    setSelectedLibraryId(id)
  }
  const deleteLibrarySelection = () => {
    if (!selectedLibraryId) { dispatch({ type: 'STATUS', message: 'Select a library item first' }); return }
    dispatch({ type: 'DELETE_LIBRARY_ITEM', itemId: selectedLibraryId })
    setSelectedLibraryId(null)
  }

  const section = (key: string, title: string, content: React.ReactNode) => (
    <div className="prop-section" key={key}>
      <button className="prop-section-head" onClick={() => toggle(key)}>
        <Icon name={openSections[key] ? 'chevronDown' : 'chevronRight'} size={11} /> {title}
      </button>
      {openSections[key] && <div className="prop-section-body">{content}</div>}
    </div>
  )

  const tabList = [
    ['properties', 'Properties'],
    ['library', 'Library'],
    ['color', 'Color'],
    ['swatches', 'Swatches'],
  ]
  const morePanels = [
    ['motionPresets', 'Motion Presets'],
    ['align', 'Align'],
    ['info', 'Info'],
    ['transform', 'Transform'],
    ['document', 'Document'],
    ['publish', 'Publish'],
    ['debug', 'Debug'],
    ['about', 'About Animate'],
  ]

  const activePanel = state.activePanel

  return (
    <div className="right-panel">
      <div className="panel-tabs">
        {tabList.map(([id, label]) => (
          <button
            key={id}
            className={`panel-tab ${activePanel === id ? 'active' : ''}`}
            onClick={() => { setShowMore(false); dispatch({ type: 'SET_ACTIVE_PANEL', panel: id }) }}
          >
            {label}
          </button>
        ))}
        <button className={`panel-tab-more ${morePanels.some(([id]) => id === activePanel) ? 'active' : ''}`} title="More panels" onClick={() => setShowMore(!showMore)}>≡</button>
        {showMore && (
          <div className="panel-more-menu">
            {morePanels.map(([id, label]) => (
              <button key={id} data-label={label} className={activePanel === id ? 'active' : ''} onClick={() => { dispatch({ type: 'SET_ACTIVE_PANEL', panel: id }); setShowMore(false) }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="panel-content">
        {(activePanel === 'properties' || activePanel === 'document' || activePanel === 'publish') && (
          <div className="properties-panel">
            {activePanel === 'document' && (
              <div className="notice-bar">Document properties — changes apply to the whole stage.</div>
            )}
            {activePanel === 'publish' && (
              <>
                <div className="notice-bar">Export MP4, WebM, MKV, GIF, image sequences and more.</div>
                <div className="prop-btn-row">
                  <button className="wide-btn" onClick={() => dispatch({ type: 'SET_PUBLISH_OPEN', open: true })}>
                    <Icon name="export" size={13} /> Open Export Settings
                  </button>
                </div>
              </>
            )}
            {section('document', 'Document', (
              <>
                <div className="prop-row">
                  <label>Title</label>
                  <input value={project.name} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'name', value: e.target.value })} />
                </div>
                <div className="prop-grid-2">
                  <div className="prop-row"><label>W</label><input type="number" value={project.width} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'width', value: number(Number(e.target.value), 550) })} /></div>
                  <div className="prop-row"><label>H</label><input type="number" value={project.height} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'height', value: number(Number(e.target.value), 400) })} /></div>
                </div>
                <div className="prop-row">
                  <label>Stage color</label>
                  <input type="color" value={project.backgroundColor} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'backgroundColor', value: e.target.value })} />
                </div>
                <div className="prop-row"><label>FPS</label><input type="number" value={project.fps} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'fps', value: Math.max(1, Number(e.target.value)) })} /></div>
              </>
            ))}

            {section('position', 'Position and Size', shape ? (
              <>
                <div className="prop-grid-2">
                  <div className="prop-row"><label>X</label><input type="number" value={Math.round(shape.x * 10) / 10} onChange={(e) => patchGeometry({ x: Number(e.target.value) })} /></div>
                  <div className="prop-row"><label>Y</label><input type="number" value={Math.round(shape.y * 10) / 10} onChange={(e) => patchGeometry({ y: Number(e.target.value) })} /></div>
                </div>
                <div className="prop-grid-2">
                  <div className="prop-row"><label>W</label><input type="number" value={Math.round(shape.width * 10) / 10} onChange={(e) => {
                    const width = Math.max(1, Number(e.target.value))
                    const height = constrainProportions ? Math.max(1, shape.height * width / shape.width) : shape.height
                    patchGeometry({ width, height })
                  }} /></div>
                  <div className="prop-row"><label>H</label><input type="number" value={Math.round(shape.height * 10) / 10} onChange={(e) => {
                    const height = Math.max(1, Number(e.target.value))
                    const width = constrainProportions ? Math.max(1, shape.width * height / shape.height) : shape.width
                    patchGeometry({ width, height })
                  }} /></div>
                </div>
                <div className="prop-row">
                  <label>Rotation</label>
                  <input type="range" min="-180" max="180" value={shape.rotation} onChange={(e) => patch({ rotation: Number(e.target.value) })} />
                  <span className="prop-value">{Math.round(shape.rotation)}°</span>
                </div>
                <div className="prop-row">
                  <label>Lock</label>
                  <input type="checkbox" checked={shape.locked} onChange={(e) => patch({ locked: e.target.checked })} />
                  <label className="inline-label">Constrain proportions</label>
                  <input type="checkbox" checked={constrainProportions} onChange={(e) => setConstrainProportions(e.target.checked)} />
                </div>
              </>
            ) : <div className="empty-hint">Select a shape on the Stage to edit its position and size.</div>)}

            {section('fill', 'Fill and Stroke', shape ? (
              <>
                <div className="prop-row"><label>Fill</label><input type="color" value={shape.fill.startsWith('#') ? shape.fill : '#ffffff'} onChange={(e) => patch({ fill: e.target.value })} /><input className="hex-input" value={shape.fill} onChange={(e) => patch({ fill: e.target.value })} /></div>
                <div className="prop-row"><label>Stroke</label><input type="color" value={shape.stroke.startsWith('#') ? shape.stroke : '#000000'} onChange={(e) => patch({ stroke: e.target.value })} /><input className="hex-input" value={shape.stroke} onChange={(e) => patch({ stroke: e.target.value })} /></div>
                <div className="prop-row"><label>Stroke width</label><input type="number" min="0" max="50" value={shape.strokeWidth} onChange={(e) => patch({ strokeWidth: Number(e.target.value) })} /><span className="prop-unit">px</span></div>
                {shape.type === 'text' && (
                  <>
                    <div className="prop-row"><label>Text</label><input value={shape.text ?? ''} onChange={(e) => patch({ text: e.target.value })} /></div>
                    <div className="prop-row"><label>Font</label>
                      <select value={shape.fontFamily ?? 'Arial'} onChange={(e) => patch({ fontFamily: e.target.value })}>
                        {['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Comic Sans MS'].map((font) => <option key={font}>{font}</option>)}
                      </select>
                    </div>
                    <div className="prop-row"><label>Font size</label><input type="number" value={shape.fontSize ?? 28} onChange={(e) => patch({ fontSize: Number(e.target.value) })} /></div>
                    <div className="prop-row"><label>Style</label>
                      <button className={shape.fontBold !== false ? 'active' : ''} onClick={() => patch({ fontBold: shape.fontBold === false })}><b>B</b></button>
                      <button className={shape.fontItalic ? 'active' : ''} onClick={() => patch({ fontItalic: !shape.fontItalic })}><i>I</i></button>
                    </div>
                  </>
                )}
                {(shape.type === 'polyStar') && (
                  <>
                    <div className="prop-row"><label>Sides</label><input type="number" min="3" max="20" value={shape.sides ?? 5} onChange={(e) => patch({ sides: Number(e.target.value) })} /></div>
                    <div className="prop-row"><label>Inner radius</label><input type="range" min="0.05" max="0.95" step="0.05" value={shape.innerRadius ?? 0.45} onChange={(e) => patch({ innerRadius: Number(e.target.value) })} /></div>
                  </>
                )}
              </>
            ) : <div className="empty-hint">No fill or stroke to edit.</div>)}

            {section('appearance', 'Appearance', shape ? (
              <>
                <div className="prop-row"><label>Alpha</label><input type="range" min="0" max="1" step="0.05" value={shape.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} /><span className="prop-value">{Math.round(shape.opacity * 100)}%</span></div>
                <div className="prop-row"><label>Visible</label><input type="checkbox" checked={shape.visible} onChange={(e) => patch({ visible: e.target.checked })} /></div>
                <div className="prop-row"><label>Name</label><input value={shape.name} onChange={(e) => patch({ name: e.target.value })} /></div>
                <div className="prop-btn-row">
                  <button onClick={() => dispatch({ type: 'ARRANGE_SHAPE', layerId: layer!.id, shapeId: shape.id, direction: 'front' })}><Icon name="bringFront" size={13} /> Front</button>
                  <button onClick={() => dispatch({ type: 'ARRANGE_SHAPE', layerId: layer!.id, shapeId: shape.id, direction: 'back' })}><Icon name="sendBack" size={13} /> Back</button>
                  <button onClick={() => dispatch({ type: 'DUPLICATE_SHAPE', layerId: layer!.id, shapeId: shape.id })}><Icon name="copy" size={13} /> Duplicate</button>
                  <button onClick={() => dispatch({ type: 'ADD_LIBRARY_ITEM', item: { id: uid('symbol'), name: `${shape.name} Symbol`, type: 'Graphic', shapes: [{ ...shape, points: shape.points?.map((p) => ({ ...p })) }] } })}><Icon name="symbol" size={13} /> Symbol</button>
                  <button className="danger" onClick={() => dispatch({ type: 'DELETE_SHAPE', layerId: layer!.id, shapeId: shape.id })}><Icon name="trash" size={13} /> Delete</button>
                </div>
              </>
            ) : <div className="empty-hint">Select a shape to edit its appearance.</div>)}

            {section('bone', 'Bone Rigging', <BoneOptions embedded />)}

            {section('tween', 'Tween', (
              <>
                <div className="prop-row">
                  <label>Tween type</label>
                  <select
                    value={kf?.tween ?? 'none'}
                    onChange={(e) => dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: e.target.value as 'none' | 'motion' | 'shape' })}
                  >
                    <option value="none">None</option>
                    <option value="motion">Motion Tween</option>
                    <option value="shape">Shape Tween</option>
                  </select>
                </div>
                <div className="prop-row"><label>Easing</label><input type="range" min="-1" max="1" step="0.1" value={kf?.ease ?? 0} onChange={(e) => dispatch({ type: 'SET_KEYFRAME_EASE', ease: Number(e.target.value) })} /><span className="prop-value">{Math.round((kf?.ease ?? 0) * 100)}</span></div>
                <div className="empty-hint small">Add a second keyframe later on the timeline to create animation.</div>
              </>
            ))}

            {section('frame', 'Frame', (
              <>
                <div className="prop-row"><label>Frame</label><span className="prop-static">{currentFrame + 1} / {project.totalFrames}</span></div>
                <div className="prop-row"><label>Layer</label><span className="prop-static">{layer?.name ?? '—'}</span></div>
                <div className="prop-btn-row">
                  <button onClick={() => dispatch({ type: 'INSERT_KEYFRAME' })}>Add Keyframe</button>
                  <button onClick={() => dispatch({ type: 'INSERT_KEYFRAME', blank: true })}>Blank Keyframe</button>
                </div>
              </>
            ))}

            {section('onion', 'Onion Skin', (
              <>
                <label className="tool-option-check"><input type="checkbox" checked={state.onionSkin} onChange={() => dispatch({ type: 'TOGGLE', key: 'onionSkin' })} /> Enable onion skin</label>
                <label className="tool-option-check"><input type="checkbox" checked={state.onionKeyframesOnly} onChange={() => dispatch({ type: 'TOGGLE', key: 'onionKeyframesOnly' })} /> Show keyframes only</label>
                <div className="prop-row"><label>Frames</label><input type="range" min="0" max="5" value={state.onionRange} onChange={(e) => dispatch({ type: 'SET_ONION_RANGE', range: Number(e.target.value) })} /><span className="prop-value">{state.onionRange}</span></div>
                <div className="prop-row"><label>Opacity</label><input type="range" min="0.02" max="0.8" step="0.02" value={state.onionOpacity} onChange={(e) => dispatch({ type: 'SET_ONION_OPACITY', opacity: Number(e.target.value) })} /><span className="prop-value">{Math.round(state.onionOpacity * 100)}%</span></div>
              </>
            ))}
          </div>
        )}

        {activePanel === 'library' && (
          <div className="library-panel">
            <div className="library-toolbar">
              <button className="mini-btn" title="New symbol" onClick={newSymbol}><Icon name="plus" size={13} /></button>
              <button className="mini-btn" title="New folder" onClick={newFolder}><Icon name="folder" size={13} /></button>
              <button className="mini-btn" title="Delete selected" onClick={deleteLibrarySelection}><Icon name="trash" size={13} /></button>
              <input className="library-search" placeholder="Search library" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
            </div>
            <div className="library-list">
              {visibleLibrary.map((item) => (
                <div
                  className={`library-item ${selectedLibraryId === item.id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedLibraryId(item.id)}
                  onDoubleClick={() => {
                    if (item.folder || !item.shapes.length) return
                    dispatch({ type: 'PLACE_LIBRARY_ITEM', itemId: item.id })
                  }}
                >
                  <Icon name={item.folder ? 'folder' : 'symbol'} size={15} />
                  <span>{item.name}</span>
                  <small>{item.folder ? 'Folder' : item.type}</small>
                  <button className="library-delete" title="Delete symbol" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_LIBRARY_ITEM', itemId: item.id }); if (selectedLibraryId === item.id) setSelectedLibraryId(null) }}>×</button>
                </div>
              ))}
              {!visibleLibrary.length && <div className="empty-hint">{q ? `No library items match “${librarySearch}”.` : 'No symbols yet. Use + to create one.'}</div>}
            </div>
            <div className="library-footer">{q ? `${visibleLibrary.length} of ` : ''}{(project.library ?? []).length} items · double-click to place</div>
          </div>
        )}

        {activePanel === 'color' && (
          <div className="color-panel">
            <div className="color-preview" style={{ background: state.fillColor }} />
            <div className="prop-row"><label>Color</label><input type="color" value={state.fillColor} onChange={(e) => dispatch({ type: 'SET_FILL', color: e.target.value })} /></div>
            <div className="prop-row"><label>HEX</label><input value={state.fillColor} onChange={(e) => dispatch({ type: 'SET_FILL', color: e.target.value })} /></div>
            <div className="prop-row"><label>Alpha</label><input type="range" min="0" max="1" step="0.05" disabled={!shape} value={shape?.opacity ?? 1} onChange={(e) => patch({ opacity: Number(e.target.value) })} /><span className="prop-value">{Math.round((shape?.opacity ?? 1) * 100)}%</span></div>
            {!shape && <div className="empty-hint small">Select a shape on the Stage to change its alpha.</div>}
            <div className="prop-grid-2">
              {[0, 15, 30, 45, 60, 90, 120, 180].map((h) => <button key={h} className="lock-swatch" style={{ background: `hsl(${h},70%,50%)` }} onClick={() => dispatch({ type: 'SET_FILL', color: `hsl(${h},70%,50%)` })} />)}
            </div>
            <button className="wide-btn" onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'swatches' })}>Open Swatches</button>
          </div>
        )}

        {activePanel === 'swatches' && (
          <div className="swatches-panel">
            <div className="panel-subhead">Default Colors</div>
            <div className="swatch-grid">
              {SWATCHES.map((c) => (
                <button key={c} className={`swatch-cell ${state.fillColor === c ? 'active' : ''}`} style={{ background: c }} title={c} onClick={() => dispatch({ type: 'SET_FILL', color: c })} />
              ))}
            </div>
            <div className="panel-subhead">Color ramp</div>
            <div className="color-ramp" style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = (e.clientX - rect.left) / rect.width
              const hue = Math.round((x % 1) * 360)
              dispatch({ type: 'SET_FILL', color: `hsl(${hue},100%,50%)` })
            }} />
          </div>
        )}

        {activePanel === 'motionPresets' && (
          <div className="motion-presets-panel">
            <div className="panel-subhead">Default Presets</div>
            <div className="preset-list">
              {[
                { name: 'Motion Fade In', tween: 'motion' as const, ease: 0.8, note: 'Slow in, gentle arrival' },
                { name: 'Motion Fade Out', tween: 'motion' as const, ease: -0.8, note: 'Ease out of the scene' },
                { name: 'Smooth Move', tween: 'motion' as const, ease: 0, note: 'Linear, even movement' },
                { name: 'Snap', tween: 'motion' as const, ease: 1, note: 'Fast start, hard finish' },
                { name: 'Bounce Feel', tween: 'shape' as const, ease: -0.6, note: 'Springy shape change' },
                { name: 'No Tween', tween: 'none' as const, ease: 0, note: 'Hold the keyframe' },
              ].map((preset) => (
                <button key={preset.name} className="motion-preset" onClick={() => {
                  dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: preset.tween })
                  dispatch({ type: 'SET_KEYFRAME_EASE', ease: preset.ease })
                  dispatch({ type: 'STATUS', message: `Applied ${preset.name}` })
                }}>
                  <Icon name={preset.tween === 'none' ? 'stop' : preset.tween === 'motion' ? 'motionPath' : 'sparkle'} size={15} />
                  <span><b>{preset.name}</b><small>{preset.note}</small></span>
                </button>
              ))}
            </div>
            <div className="empty-hint small">Select a keyframe, then apply a preset to set its tween and easing.</div>
          </div>
        )}

        {activePanel === 'align' && (
          <div className="align-panel">
            <div className="panel-subhead">{alignToSelection ? 'Align to Selection' : 'Align to Stage'}</div>
            <div className="align-grid">
              {([
                ['alignLeft', 'Left', 'left'], ['alignCenter', 'Center', 'center'], ['alignRight', 'Right', 'right'],
              ] as const).map(([icon, label, direction]) => <button key={label} title={label} data-label={`Align ${label}`} onClick={() => alignShape(direction)}><Icon name={icon} size={16} /></button>)}
              {([
                ['chevronUp', 'Top', 'top'], ['center', 'Middle', 'middle'], ['chevronDown', 'Bottom', 'bottom'],
              ] as const).map(([icon, label, direction]) => <button key={label} title={label} data-label={`Align ${label}`} onClick={() => alignShape(direction)}><Icon name={icon} size={16} /></button>)}
            </div>
            <div className="panel-subhead">Distribute</div>
            <div className="align-grid">
              <button title="Distribute horizontally" data-label="Distribute horizontally" onClick={() => distribute('x')}><Icon name="alignLeft" size={16} /></button>
              <button title="Distribute vertically" data-label="Distribute vertically" onClick={() => distribute('y')}><Icon name="chevronDown" size={16} /></button>
              <button title="Distribute evenly" data-label="Distribute evenly" onClick={() => { distribute('x'); distribute('y') }}><Icon name="center" size={16} /></button>
            </div>
            <label className="tool-option-check"><input type="checkbox" checked={alignToSelection} onChange={(e) => setAlignToSelection(e.target.checked)} /> Align to selection bounds</label>
            <div className="empty-hint small">Select a shape to align it. Distribute needs at least 3 shapes on this frame.</div>
          </div>
        )}

        {activePanel === 'info' && (
          <div className="info-panel">
            <div className="prop-row"><label>Stage width</label><span className="prop-static">{project.width} px</span></div>
            <div className="prop-row"><label>Stage height</label><span className="prop-static">{project.height} px</span></div>
            <div className="prop-row"><label>Frame rate</label><span className="prop-static">{project.fps} fps</span></div>
            <div className="prop-row"><label>Frame</label><span className="prop-static">{currentFrame + 1} / {project.totalFrames}</span></div>
            <div className="prop-row"><label>Layers</label><span className="prop-static">{project.layers.length}</span></div>
            <div className="prop-row"><label>Shapes</label><span className="prop-static">{kf?.shapes.length ?? 0}</span></div>
            <div className="prop-row"><label>Zoom</label><span className="prop-static">{Math.round(state.zoom * 100)}%</span></div>
          </div>
        )}

        {activePanel === 'transform' && (
          <div className="transform-panel">
            <div className="panel-subhead">Transform</div>
            {shape ? (
              <>
                <div className="prop-grid-2">
                  <div className="prop-row"><label>Scale X %</label><input type="number" min="10" max="1000" value={Math.round(scaleX)} onChange={(e) => applyScale('x', Number(e.target.value))} /></div>
                  <div className="prop-row"><label>Scale Y %</label><input type="number" min="10" max="1000" value={Math.round(scaleY)} onChange={(e) => applyScale('y', Number(e.target.value))} /></div>
                </div>
                <div className="prop-row"><label>Rotate</label><input type="range" min="-180" max="180" value={shape.rotation} onChange={(e) => patch({ rotation: Number(e.target.value) })} /><span className="prop-value">{Math.round(shape.rotation)}°</span></div>
                <div className="prop-btn-row">
                  <button data-label="Flip H" onClick={() => flipShape('h')}><Icon name="alignLeft" size={13} /> Flip H</button>
                  <button data-label="Flip V" onClick={() => flipShape('v')}><Icon name="chevronDown" size={13} /> Flip V</button>
                  <button onClick={() => { setScaleX(100); setScaleY(100) }}>Reset scale</button>
                </div>
                <div className="empty-hint small">Scale values are relative to the size when you selected this shape.</div>
              </>
            ) : <div className="empty-hint">Select a shape to transform it.</div>}
          </div>
        )}

        {activePanel === 'debug' && (
          <div className="debug-panel">
            <div className="panel-subhead">Movie Inspector</div>
            <div className="prop-row"><label>Document</label><span className="prop-static">{project.name}</span></div>
            <div className="prop-row"><label>Stage</label><span className="prop-static">{project.width} × {project.height}</span></div>
            <div className="prop-row"><label>Frame rate</label><span className="prop-static">{project.fps} fps</span></div>
            <div className="prop-row"><label>Current frame</label><span className="prop-static">{currentFrame + 1} / {project.totalFrames}</span></div>
            <div className="prop-row"><label>Layers</label><span className="prop-static">{project.layers.length}</span></div>
            <div className="prop-row"><label>Shapes</label><span className="prop-static">{siblings.length}</span></div>
            <div className="prop-row"><label>Bones</label><span className="prop-static">{kf?.bones.length ?? 0}</span></div>
            <div className="prop-row"><label>Library</label><span className="prop-static">{(project.library ?? []).length} items</span></div>
            <div className="panel-subhead">Active keyframe</div>
            <pre className="debug-json">{kf ? JSON.stringify({ start: kf.start, duration: kf.duration, tween: kf.tween, ease: kf.ease, label: kf.label ?? null }, null, 2) : 'No keyframe on this frame'}</pre>
            <button className="wide-btn" onClick={() => dispatch({ type: 'STATUS', message: `Inspector: frame ${currentFrame + 1}, ${siblings.length} shapes, ${kf?.bones.length ?? 0} bones` })}>Copy status to bar</button>
          </div>
        )}

        {activePanel === 'about' && (
          <div className="about-panel">
            <div className="about-logo"><Icon name="Adobe" size={40} /></div>
            <h2>Animate</h2>
            <p>Desktop Edition v1.0</p>
            <p>Draw, animate, rig, export video, and publish — all in a real Windows desktop app.</p>
            <button className="wide-btn" onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'properties' })}>Back to Properties</button>
          </div>
        )}
      </div>
    </div>
  )
}
