import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { useStore } from '../store'
import { findKeyframeIndex, getActiveKeyframe } from '../utils'

const CELL = 16
const LABEL_W = 174

export function Timeline() {
  const { state, dispatch } = useStore()
  const { project, currentFrame, playing } = state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; frame: number } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const next = currentFrame + 1
      if (next >= project.totalFrames) {
        if (state.loop) dispatch({ type: 'SET_CURRENT_FRAME', frame: 0 })
        else { dispatch({ type: 'SET_PLAYING', playing: false }); dispatch({ type: 'SET_CURRENT_FRAME', frame: project.totalFrames - 1 }) }
      } else dispatch({ type: 'SET_CURRENT_FRAME', frame: next })
    }, 1000 / project.fps)
    return () => window.clearInterval(id)
  }, [playing, currentFrame, project.totalFrames, project.fps, state.loop, dispatch])

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const frameFromEvent = (e: React.MouseEvent) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(project.totalFrames - 1, Math.floor((e.clientX - rect.left) / CELL)))
  }

  const scrub = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    dispatch({ type: 'SET_CURRENT_FRAME', frame: frameFromEvent(e as unknown as React.MouseEvent) })
    const move = (ev: PointerEvent) => dispatch({ type: 'SET_CURRENT_FRAME', frame: Math.max(0, Math.min(project.totalFrames - 1, Math.floor((ev.clientX - (gridRef.current?.getBoundingClientRect().left ?? 0)) / CELL))) })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const ticks = Array.from({ length: project.totalFrames }, (_, i) => i)
  const gridWidth = project.totalFrames * CELL

  return (
    <div className={`timeline ${collapsed ? 'collapsed' : ''}`}>
      <div className="timeline-toolbar">
        <div className="tl-group">
          <button className="mini-btn" title="First frame" onClick={() => dispatch({ type: 'SET_CURRENT_FRAME', frame: 0 })}><Icon name="rewind" size={13} /></button>
          <button className="mini-btn" title="Previous frame" onClick={() => dispatch({ type: 'SET_CURRENT_FRAME', frame: currentFrame - 1 })}><Icon name="stepBack" size={13} /></button>
          <button className={`mini-btn play ${playing ? 'active' : ''}`} title={playing ? 'Stop (Enter)' : 'Play (Enter)'} onClick={() => dispatch({ type: 'SET_PLAYING', playing: !playing })}>
            <Icon name={playing ? 'stop' : 'play'} size={13} />
          </button>
          <button className="mini-btn" title="Next frame" onClick={() => dispatch({ type: 'SET_CURRENT_FRAME', frame: currentFrame + 1 })}><Icon name="stepForward" size={13} /></button>
          <button className="mini-btn" title="Last frame" onClick={() => dispatch({ type: 'SET_CURRENT_FRAME', frame: project.totalFrames - 1 })}><Icon name="forward" size={13} /></button>
        </div>
        <span className="toolbar-divider" />
        <div className="tl-group">
          <label className="frame-input-label">Frame</label>
          <input className="frame-input" type="number" min="1" max={project.totalFrames} value={currentFrame + 1} onChange={(e) => dispatch({ type: 'SET_CURRENT_FRAME', frame: Number(e.target.value) - 1 })} />
        </div>
        <span className="toolbar-divider" />
        <div className="tl-group">
          <label className="frame-input-label">FPS</label>
          <input className="fps-input" type="number" min="1" max="60" value={project.fps} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'fps', value: Math.max(1, Number(e.target.value)) })} />
        </div>
        <span className="toolbar-divider" />
        <button className={`mini-btn ${state.loop ? 'active' : ''}`} title="Loop playback" onClick={() => dispatch({ type: 'TOGGLE', key: 'loop' })}><Icon name="redo" size={13} /></button>
        <button className={`mini-btn ${state.onionSkin ? 'active' : ''}`} title="Onion skin" onClick={() => dispatch({ type: 'TOGGLE', key: 'onionSkin' })}><Icon name="onion" size={14} /></button>
        <button className={`mini-btn ${state.showGrid ? 'active' : ''}`} title="Toggle grid" onClick={() => dispatch({ type: 'TOGGLE', key: 'showGrid' })}><Icon name="grid" size={13} /></button>
        <button className={`mini-btn ${state.snapToGrid ? 'active' : ''}`} title="Snap to grid" onClick={() => dispatch({ type: 'TOGGLE', key: 'snapToGrid' })}><Icon name="magnet" size={13} /></button>
        <button className={`mini-btn ${state.showBones ? 'active' : ''}`} title="Show bones" onClick={() => dispatch({ type: 'TOGGLE', key: 'showBones' })}><Icon name="bone" size={14} /></button>
        <span className="toolbar-divider" />
        <span className="zoom-label">{Math.round(state.zoom * 100)}%</span>
        <input className="zoom-slider" type="range" min="0.1" max="4" step="0.05" value={state.zoom} onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: Number(e.target.value) })} title="Stage zoom" />
        <div className="tl-spacer" />
        <div className="tl-group">
          <button className="tl-text-btn" title="Insert frame (F5)" onClick={() => dispatch({ type: 'INSERT_FRAME' })}><Icon name="plus" size={12} /> Frame</button>
          <button className="tl-text-btn" title="Insert keyframe (F6)" onClick={() => dispatch({ type: 'INSERT_KEYFRAME' })}><Icon name="plus" size={12} /> Keyframe</button>
          <button
            className="tl-text-btn pose-btn"
            title="Add pose keyframe — captures the current rig as a motion keyframe"
            onClick={() => { dispatch({ type: 'INSERT_KEYFRAME' }); dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' }); dispatch({ type: 'STATUS', message: 'Pose keyframe added' }) }}
          ><Icon name="bone" size={12} /> Pose</button>
        </div>
        <span className="toolbar-divider" />
        <button className="mini-btn" title={collapsed ? 'Expand timeline' : 'Collapse timeline'} onClick={() => setCollapsed(!collapsed)}><Icon name={collapsed ? 'chevronUp' : 'chevronDown'} size={13} /></button>
      </div>

      {!collapsed && (
        <>
          <div className="timeline-body">
            <div className="layer-panel" style={{ width: LABEL_W }}>
              <div className="layer-header" onPointerDown={scrub}>
                <span>Layer</span>
                <span className="layer-header-icons"><Icon name="eye" size={12} /><Icon name="lock" size={12} /><Icon name="onion" size={12} /></span>
              </div>
              <div className="layer-list">
                {[...project.layers].reverse().map((layer) => {
                  const selected = state.selection.layerId === layer.id
                  const hasRig = layer.frames.some((f) => f && (f.bones?.length ?? 0) > 0)
                  return (
                    <div key={layer.id} className={`layer-row ${selected ? 'selected' : ''} ${hasRig ? 'armature-layer' : ''}`} onClick={() => dispatch({ type: 'SET_SELECTION', selection: { layerId: layer.id, shapeId: null } })}>
                      <button className="layer-icon-btn" title={layer.visible ? 'Hide layer' : 'Show layer'} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { visible: !layer.visible } }) }}>
                        <Icon name={layer.visible ? 'eye' : 'eyeOff'} size={13} />
                      </button>
                      <button className="layer-icon-btn" title={layer.locked ? 'Unlock layer' : 'Lock layer'} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { locked: !layer.locked } }) }}>
                        <Icon name={layer.locked ? 'lock' : 'unlock'} size={13} />
                      </button>
                      <span className="layer-color" style={{ background: layer.color }} />
                      {hasRig && <span className="armature-badge" title="Armature layer"><Icon name="bone" size={12} /></span>}
                      <input
                        className="layer-name"
                        value={layer.name}
                        onChange={(e) => dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { name: e.target.value } })}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.currentTarget.select()}
                      />
                      <button className="layer-outline" title="Outline" onClick={(e) => e.stopPropagation()}><span /></button>
                    </div>
                  )
                })}
              </div>
              <div className="layer-actions">
                <button className="mini-btn" title="Add layer" onClick={() => dispatch({ type: 'ADD_LAYER' })}><Icon name="plus" size={13} /></button>
                <button className="mini-btn" title="Add layer folder" onClick={() => dispatch({ type: 'STATUS', message: 'Layer folders are not supported in this recreation' })}><Icon name="folder" size={13} /></button>
                <button className="mini-btn" title="Delete layer" onClick={() => state.selection.layerId && dispatch({ type: 'DELETE_LAYER', layerId: state.selection.layerId })}><Icon name="trash" size={13} /></button>
              </div>
            </div>

            <div className="timeline-scroll" ref={scrollRef}>
              <div style={{ width: gridWidth, minWidth: '100%' }}>
                <div className="frame-header" style={{ width: gridWidth }} onPointerDown={scrub}>
                  {ticks.map((f) => (
                    <div key={f} className={`frame-tick ${f % 5 === 0 ? 'major' : ''} ${f === currentFrame ? 'current' : ''}`} style={{ width: CELL }}>
                      {f % 5 === 0 ? f + 1 : ''}
                    </div>
                  ))}
                </div>
                <div className="frame-grid" ref={gridRef} style={{ width: gridWidth }} onContextMenu={(e) => {
                  e.preventDefault()
                  const frame = frameFromEvent(e)
                  dispatch({ type: 'SET_CURRENT_FRAME', frame })
                  setContextMenu({ x: e.clientX, y: e.clientY, frame })
                }}>
                  {[...project.layers].reverse().map((layer) => (
                    <div key={layer.id} className={`frame-row ${state.selection.layerId === layer.id ? 'selected' : ''} ${!layer.visible ? 'hidden-layer' : ''}`} style={{ width: gridWidth }}>
                      {layer.frames.map((kf, f) => {
                        const isKey = !!kf
                        const active = kf && f === findKeyframeIndex(layer, currentFrame)
                        const isSpan = !!getActiveKeyframe(layer, f) && !isKey
                        return (
                          <div
                            key={f}
                            className={`frame-cell ${f % 5 === 0 ? 'major' : ''} ${f === currentFrame ? 'current' : ''} ${isSpan ? 'span' : ''}`}
                            style={{ width: CELL }}
                            onPointerDown={() => {
                              dispatch({ type: 'SET_CURRENT_FRAME', frame: f })
                              dispatch({ type: 'SET_SELECTION', selection: { layerId: layer.id, shapeId: null } })
                            }}
                            onDoubleClick={() => {
                              dispatch({ type: 'SET_SELECTION', selection: { layerId: layer.id, shapeId: null } })
                              dispatch({ type: 'INSERT_KEYFRAME', frame: f })
                            }}
                          >
                            {isKey && kf && (
                              <span
                                className={`keyframe ${(kf.bones?.length ?? 0) > 0 ? 'pose' : ''} ${kf.tween !== 'none' ? `tween-${kf.tween}` : ''} ${active ? 'active' : ''}`}
                                title={`${(kf.bones?.length ?? 0) > 0 ? 'Pose' : 'Keyframe'} ${f + 1}${kf.tween !== 'none' ? ` • ${kf.tween} tween` : ''}`}
                              >
                                {(kf.bones?.length ?? 0) > 0 ? '◆' : kf.tween !== 'none' ? '◆' : '●'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div className="playhead" style={{ left: currentFrame * CELL, height: 20 + project.layers.length * 24 }} onPointerDown={scrub}>
                  <div className="playhead-head" />
                  <div className="playhead-line" />
                </div>
              </div>
            </div>
          </div>

          <div className="timeline-footer">
            <span className="tl-footer-label">Frame label</span>
            <input
              className="frame-label-input"
              placeholder="Add a frame label..."
              value={(() => {
                const layer = project.layers.find((l) => l.id === state.selection.layerId) ?? project.layers[0]
                const kf = layer ? getActiveKeyframe(layer, currentFrame) : null
                return kf?.label ?? ''
              })()}
              onChange={(e) => dispatch({ type: 'SET_KEYFRAME_LABEL', label: e.target.value })}
            />
            <span className="tl-spacer" />
            <span className="tl-footer-info">{project.totalFrames} frames</span>
          </div>
        </>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          {[
            { label: 'Insert Frame', action: () => dispatch({ type: 'INSERT_FRAME', frame: contextMenu.frame }) },
            { label: 'Remove Frame', action: () => dispatch({ type: 'REMOVE_FRAME', frame: contextMenu.frame }) },
            { label: 'Insert Keyframe', action: () => dispatch({ type: 'INSERT_KEYFRAME', frame: contextMenu.frame }) },
            { label: 'Insert Blank Keyframe', action: () => dispatch({ type: 'INSERT_KEYFRAME', blank: true, frame: contextMenu.frame }) },
            { label: 'Remove Keyframe', action: () => dispatch({ type: 'REMOVE_KEYFRAME', frame: contextMenu.frame }) },
            { separator: true },
            { label: 'Create Motion Tween', action: () => dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' }) },
            { label: 'Create Shape Tween', action: () => dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'shape' }) },
          ].map((item, i) => 'separator' in item ? <div className="menu-separator" key={i} /> : (
            <div className="menu-item" key={i} onClick={() => { item.action(); setContextMenu(null) }}>{item.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}
