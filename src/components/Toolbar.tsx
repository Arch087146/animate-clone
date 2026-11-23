import { useEffect, useRef, useState } from 'react'
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

const shapeTools: ToolId[] = ['rectangle', 'oval', 'rectPrimitive', 'ovalPrimitive', 'polyStar']
const drawingTools: ToolId[] = ['pencil', 'brush', 'eraser']
const allTools = toolGroups.flat()
const toolInfo = Object.fromEntries(allTools.map((tool) => [tool.id, tool])) as Record<ToolId, (typeof allTools)[number]>

function flyoutFor(id: ToolId): ToolId[] | null {
  if (shapeTools.includes(id)) return shapeTools
  if (drawingTools.includes(id)) return drawingTools
  return null
}

type Flyout = { tools: ToolId[]; x: number; y: number }

export function Toolbar() {
  const { state, dispatch } = useStore()
  const [flyout, setFlyout] = useState<Flyout | null>(null)
  const holdTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (suppressClick.current) {
      suppressClick.current = false
      window.setTimeout(() => { suppressClick.current = false }, 0)
    }
  }

  const openFlyout = (id: ToolId, target: HTMLElement) => {
    const tools = flyoutFor(id)
    if (!tools) return
    const rect = target.getBoundingClientRect()
    setFlyout({
      tools,
      x: rect.right + 3,
      y: Math.max(4, Math.min(rect.top, window.innerHeight - tools.length * 26 - 10)),
    })
  }

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.tool-flyout-menu')) setFlyout(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
  }, [])

  return (
    <>
      <div className="toolbar">
        <div className="tools-column">
          {toolGroups.map((group, gi) => (
            <div className="tool-group" key={gi}>
              {group.map((tool) => {
                const hasFlyout = !!flyoutFor(tool.id)
                return (
                  <button
                    key={tool.id}
                    className={`tool-btn ${state.tool === tool.id ? 'active' : ''}`}
                    title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}${hasFlyout ? ' — click-and-hold for tools' : ''}`}
                    onClick={(e) => {
                      if (suppressClick.current) {
                        suppressClick.current = false
                        e.preventDefault()
                        return
                      }
                      setFlyout(null)
                      dispatch({ type: 'SET_TOOL', tool: tool.id })
                    }}
                    onPointerDown={(e) => {
                      if (!hasFlyout || e.button !== 0) return
                      const target = e.currentTarget
                      holdTimer.current = window.setTimeout(() => {
                        suppressClick.current = true
                        openFlyout(tool.id, target)
                      }, 350)
                    }}
                    onPointerUp={cancelHold}
                    onPointerLeave={cancelHold}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      cancelHold()
                      setFlyout(null)
                      dispatch({ type: 'SET_TOOL', tool: tool.id })
                      dispatch({ type: 'SET_TOOL_OPTIONS_OPEN', open: true })
                    }}
                  >
                    <Icon name={tool.id} size={15} />
                    {hasFlyout && (
                      <span
                        className="tool-flyout-mark"
                        title="More tools"
                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); openFlyout(tool.id, e.currentTarget.parentElement as HTMLElement) }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      />
                    )}
                    {state.tool === tool.id && <span className="tool-active-mark" />}
                  </button>
                )
              })}
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

      {flyout && (
        <div className="tool-flyout-menu" style={{ left: flyout.x, top: flyout.y }} onPointerDown={(e) => e.stopPropagation()}>
          {flyout.tools.map((id) => {
            const info = toolInfo[id]
            return (
              <button
                key={id}
                className={state.tool === id ? 'active' : ''}
                title={info.label}
                onClick={() => {
                  dispatch({ type: 'SET_TOOL', tool: id })
                  setFlyout(null)
                }}
              >
                <Icon name={id} size={15} />
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
