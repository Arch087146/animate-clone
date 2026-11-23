import { Icon } from '../Icon'
import { useStore } from '../store'
import type { ToolId } from '../types'

const toolGroups: { id: ToolId; label: string; shortcut: string }[][] = [
  [
    { id: 'selection', label: 'Selection Tool', shortcut: 'V' },
    { id: 'subselection', label: 'Subselection Tool', shortcut: 'A' },
    { id: 'lasso', label: 'Lasso Tool', shortcut: 'L' },
  ],
  [
    { id: 'pen', label: 'Pen Tool', shortcut: 'P' },
    { id: 'text', label: 'Text Tool', shortcut: 'T' },
    { id: 'line', label: 'Line Tool', shortcut: 'N' },
  ],
  [
    { id: 'rectangle', label: 'Rectangle Tool', shortcut: 'R' },
    { id: 'oval', label: 'Oval Tool', shortcut: 'O' },
    { id: 'rectPrimitive', label: 'Rectangle Primitive Tool', shortcut: '' },
    { id: 'ovalPrimitive', label: 'Oval Primitive Tool', shortcut: '' },
    { id: 'polyStar', label: 'PolyStar Tool', shortcut: '' },
  ],
  [
    { id: 'pencil', label: 'Pencil Tool', shortcut: 'Y' },
    { id: 'brush', label: 'Brush Tool', shortcut: 'B' },
    { id: 'eraser', label: 'Eraser Tool', shortcut: 'E' },
  ],
  [
    { id: 'inkBottle', label: 'Ink Bottle Tool', shortcut: 'S' },
    { id: 'paintBucket', label: 'Paint Bucket Tool', shortcut: 'K' },
    { id: 'eyedropper', label: 'Eyedropper Tool', shortcut: 'I' },
  ],
  [
    { id: 'hand', label: 'Hand Tool', shortcut: 'H' },
    { id: 'zoom', label: 'Zoom Tool', shortcut: 'Z' },
    { id: 'bone', label: 'Bone Tool (rigging)', shortcut: 'M' },
  ],
]

export function Toolbar() {
  const { state, dispatch } = useStore()

  return (
    <div className="toolbar">
      <div className="tools-column">
        {toolGroups.map((group, gi) => (
          <div className="tool-group" key={gi}>
            {group.map((tool) => (
              <button
                key={tool.id}
                className={`tool-btn ${state.tool === tool.id ? 'active' : ''}`}
                title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                onClick={() => dispatch({ type: 'SET_TOOL', tool: tool.id })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  dispatch({ type: 'SET_TOOL', tool: tool.id })
                  dispatch({ type: 'SET_TOOL_OPTIONS_OPEN', open: true })
                }}
              >
                <Icon name={tool.id} size={17} />
                {state.tool === tool.id && <span className="tool-active-mark" />}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="color-controls">
        <div className="swatch-pair" title="Fill and stroke colors">
          <div className="swatch swatch-fill" style={{ background: state.fillColor }} onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'color' })} />
          <div className="swatch swatch-stroke" style={{ background: state.strokeColor }} onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'color' })} />
        </div>
        <button className="small-tool-btn" title="Swap colors" onClick={() => {
          const f = state.fillColor, s = state.strokeColor
          dispatch({ type: 'SET_FILL', color: s })
          dispatch({ type: 'SET_STROKE', color: f })
        }}><Icon name="swapColors" size={13} /></button>
        <button className="small-tool-btn" title="Reset to black and white" onClick={() => {
          dispatch({ type: 'SET_FILL', color: '#ffffff' })
          dispatch({ type: 'SET_STROKE', color: '#000000' })
        }}><Icon name="defaultColors" size={13} /></button>
      </div>
    </div>
  )
}
