import { BRUSHES, BRUSH_CATEGORIES, brushCategory, getBrush } from '../brushes'
import { Icon } from '../Icon'
import { exportAnimationHTML } from '../io'
import { useStore } from '../store'
import { getActiveKeyframe } from '../utils'
import { Stage } from './Stage'
import type { Shape, ToolId } from '../types'

const SIMPLE_TOOLS: { id: ToolId; label: string; icon: string; hint: string }[] = [
  { id: 'selection', label: 'Select', icon: 'selection', hint: 'Click a shape to select it. Drag to move it, drag the corner handles to resize.' },
  { id: 'pencil', label: 'Draw', icon: 'pencil', hint: 'Drag on the stage to draw with a pencil. Pick a brush below to change how it looks.' },
  { id: 'brush', label: 'Paint', icon: 'brush', hint: 'Drag on the stage to paint with a Krita brush preset. Open the brush picker to choose one.' },
  { id: 'paintBucket', label: 'Fill', icon: 'paintBucket', hint: 'Pick a color below, then click inside a shape to fill it.' },
  { id: 'text', label: 'Text', icon: 'text', hint: 'Click on the stage to add text, then type your words in the Properties panel.' },
  { id: 'eraser', label: 'Erase', icon: 'eraser', hint: 'Drag across a drawing to erase part of it. Use the size slider to change the eraser.' },
  { id: 'bone', label: 'Bones', icon: 'bone', hint: 'Drag to draw a bone. Drag from a bone’s end joint to add a child limb. Drag its head or body to pose it. Hold Alt for a free bone.' },
  { id: 'motionPath', label: 'Motion Path', icon: 'motionPath', hint: 'Select a shape, then drag on the stage to draw the track it should follow. The shape animates along that track.' },
]

const CATEGORY_LABELS: Record<string, string> = {
  'Pencils & Lineart': 'Lineart',
  'Brushes & Glazing': 'Glazing',
  'Textured Brushes': 'Textured',
  'Textures & Effects': 'Effects',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Pencils & Lineart': '#5d4037',
  Essentials: '#0d47a1',
  'Brushes & Glazing': '#7b1fa2',
  'Textured Brushes': '#6d4c41',
  Water: '#0277bd',
  'Textures & Effects': '#c62828',
}

const KRITA_CATEGORY_CHIPS = BRUSH_CATEGORIES
  .filter((category) => BRUSHES.some((brush) => brushCategory(brush) === category))
  .map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    color: CATEGORY_COLORS[category] ?? '#455a64',
  }))

const COLORS = ['#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#f06292', '#8d6e63', '#ff7043']

export function SimpleMode() {
  const { state, dispatch } = useStore()
  const { project, currentFrame, tool, toolSettings: settings } = state
  const layer = project.layers.find((l) => l.id === state.selection.layerId) ?? project.layers[0]
  const kf = layer ? getActiveKeyframe(layer, currentFrame) : null
  const shape = kf?.shapes.find((s) => s.id === state.selection.shapeId)
  const currentHint = SIMPLE_TOOLS.find((t) => t.id === tool)?.hint ?? 'Pick a tool on the left to get started.'
  const activeCategory = brushCategory(getBrush(state.toolSettings.brushId))

  const setTool = (id: ToolId) => dispatch({ type: 'SET_TOOL', tool: id })
  const patchShape = (patch: Partial<Shape>) => {
    if (shape && layer) dispatch({ type: 'UPDATE_SHAPE', layerId: layer.id, shapeId: shape.id, patch })
  }

  const makeItMove = () => {
    if (!shape || !layer) {
      dispatch({ type: 'STATUS', message: 'Select a shape first, then press Make it move' })
      return
    }
    const start = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
    const path = [
      start,
      { x: start.x + 45, y: start.y - 80 },
      { x: start.x + 95, y: start.y - 35 },
    ]
    dispatch({ type: 'SET_MOTION_PATH', layerId: layer.id, shapeId: shape.id, points: path })
    dispatch({ type: 'STATUS', message: 'Motion path added — press Play to watch it follow the track!' })
  }

  return (
    <div className="simple-workspace">
      <header className="simple-header">
        <div className="simple-brand"><Icon name="Adobe" size={18} /><b>Animate</b><span className="simple-doc">{project.name}</span></div>
        <div className="simple-header-actions">
          <button className="simple-header-btn" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true })}><Icon name="book" size={14} /> Guides</button>
          <button className="simple-header-btn" onClick={() => dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' })}><Icon name={state.theme === 'dark' ? 'sun' : 'moon'} size={14} /></button>
          <button className="simple-mode-btn" onClick={() => dispatch({ type: 'SET_MODE', mode: 'pro' })}><Icon name="pro" size={14} /> Pro Mode</button>
          <button className="simple-mode-btn" title="Export video, GIF and more" onClick={() => dispatch({ type: 'SET_PUBLISH_OPEN', open: true })}><Icon name="film" size={14} /> Export Video</button>
          <button className="simple-mode-btn primary" onClick={() => exportAnimationHTML(project)}><Icon name="export" size={14} /> Publish</button>
          <button className="simple-header-btn" title="Home" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'home' })}><Icon name="home" size={14} /></button>
        </div>
      </header>

      <div className="simple-body">
        <nav className="simple-tools">
          <div className="simple-tools-label">TOOLS</div>
          {SIMPLE_TOOLS.map((item) => (
            <button key={item.id} className={`simple-tool ${tool === item.id ? 'active' : ''}`} onClick={() => setTool(item.id)} title={item.hint}>
              <Icon name={item.icon} size={20} /><span>{item.label}</span>
            </button>
          ))}
          <div className="simple-tools-label brush-label">BRUSHES</div>
          <div className="simple-brush-chips">
            {KRITA_CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.category}
                className={activeCategory === chip.category ? 'active' : ''}
                style={{ '--chip-color': chip.color } as React.CSSProperties}
                onClick={() => {
                  const first = BRUSHES.find((brush) => brushCategory(brush) === chip.category)
                  if (first) dispatch({ type: 'SET_TOOL_SETTING', key: 'brushId', value: first.id })
                  if (tool !== 'pencil' && tool !== 'brush') setTool('brush')
                }}
              >{chip.label}</button>
            ))}
          </div>
          <label className="simple-size">
            <span>Size <b>{tool === 'eraser' ? settings.eraserSize : settings.brushSize}px</b></span>
            <input
              type="range" min="1" max="80"
              value={tool === 'eraser' ? settings.eraserSize : settings.brushSize}
              onChange={(e) => dispatch({ type: 'SET_TOOL_SETTING', key: tool === 'eraser' ? 'eraserSize' : 'brushSize', value: Number(e.target.value) })}
            />
          </label>
        </nav>

        <div className="simple-center"><Stage compact /></div>

        <aside className="simple-side">
          <div className="simple-card help-card">
            <div className="simple-card-head"><Icon name="lightbulb" size={15} /> <b>How to {SIMPLE_TOOLS.find((t) => t.id === tool)?.label.toLowerCase()}</b></div>
            <p>{currentHint}</p>
            <button className="simple-link" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true })}>Show me a guide <Icon name="arrowRight" size={12} /></button>
          </div>

          <div className="simple-card">
            <div className="simple-card-head"><Icon name="palette" size={15} /> <b>Colors</b></div>
            <div className="simple-colors">
              {COLORS.map((c) => (
                <button
                  key={c} style={{ background: c }}
                  className={state.fillColor === c ? 'active' : ''}
                  title={c}
                  onClick={() => dispatch({ type: 'SET_FILL', color: c })}
                />
              ))}
            </div>
            <div className="simple-color-row">
              <label>Fill <input type="color" value={state.fillColor.startsWith('#') ? state.fillColor : '#000000'} onChange={(e) => dispatch({ type: 'SET_FILL', color: e.target.value })} /></label>
              <label>Line <input type="color" value={state.strokeColor} onChange={(e) => dispatch({ type: 'SET_STROKE', color: e.target.value })} /></label>
            </div>
          </div>

          <div className="simple-card">
            <div className="simple-card-head"><Icon name="sliders" size={15} /> <b>Quick edits</b></div>
            {shape ? <>
              <div className="simple-edit-row"><span>Opacity</span><input type="range" min="0.1" max="1" step="0.05" value={shape.opacity} onChange={(e) => patchShape({ opacity: Number(e.target.value) })} /></div>
              <div className="simple-edit-row"><span>Rotate</span><input type="range" min="-180" max="180" value={shape.rotation} onChange={(e) => patchShape({ rotation: Number(e.target.value) })} /></div>
              <button className="simple-action" onClick={makeItMove}><Icon name="sparkle" size={14} /> Make it move</button>
              <div className="simple-action-row">
                <button onClick={() => dispatch({ type: 'DUPLICATE_SHAPE', layerId: layer!.id, shapeId: shape.id })}><Icon name="copy" size={13} /> Duplicate</button>
                <button onClick={() => {
                  const cx = shape.x + shape.width / 2
                  const cy = shape.y + shape.height / 2
                  patchShape({
                    width: shape.width * 1.2,
                    height: shape.height * 1.2,
                    x: cx - shape.width * 0.6,
                    y: cy - shape.height * 0.6,
                    points: shape.points?.map((p) => ({ x: cx + (p.x - cx) * 1.2, y: cy + (p.y - cy) * 1.2 })),
                  })
                }}>Bigger</button>
                <button className="danger" onClick={() => dispatch({ type: 'DELETE_SHAPE', layerId: layer!.id, shapeId: shape.id })}><Icon name="trash" size={13} /> Delete</button>
              </div>
            </> : <p className="simple-empty">Select something on the stage to edit it, or draw a new shape.</p>}
          </div>

          <div className="simple-card tip-card">
            <Icon name="sparkle" size={15} /> <span><b>Did you know?</b> Press <kbd>Enter</kbd> to play your animation and <kbd>F6</kbd> to add a pose.</span>
          </div>
        </aside>
      </div>

      <footer className="simple-bottom">
        <button className={`simple-play ${state.playing ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_PLAYING', playing: !state.playing })}>
          <Icon name={state.playing ? 'stop' : 'play'} size={16} /> {state.playing ? 'Stop' : 'Play'}
        </button>
        <span className="simple-frame-label">Frame {currentFrame + 1} of {project.totalFrames}</span>
        <input className="simple-frame-slider" type="range" min="0" max={project.totalFrames - 1} value={currentFrame} onChange={(e) => dispatch({ type: 'SET_CURRENT_FRAME', frame: Number(e.target.value) })} />
        <button className="simple-pose-btn" onClick={() => dispatch({ type: 'INSERT_KEYFRAME' })}><Icon name="plus" size={14} /> Add pose</button>
        <button className={`simple-footer-tool ${state.onionSkin ? 'active' : ''}`} onClick={() => dispatch({ type: 'TOGGLE', key: 'onionSkin' })} title="See nearby frames"><Icon name="onion" size={15} /> Ghost frames</button>
        <button className="simple-footer-tool" onClick={() => dispatch({ type: 'UNDO' })} title="Undo"><Icon name="undo" size={15} /></button>
        <button className="simple-footer-tool" onClick={() => dispatch({ type: 'REDO' })} title="Redo"><Icon name="redo" size={15} /></button>
        <button className="simple-footer-tool" onClick={() => dispatch({ type: 'SET_MODE', mode: 'pro' })} title="More controls"><Icon name="pro" size={15} /></button>
      </footer>
    </div>
  )
}
