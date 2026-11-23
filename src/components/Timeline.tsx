import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { useStore } from '../store'
import { findKeyframeIndex, getActiveKeyframe } from '../utils'

const CELL = 16
const LABEL_W = 174
const HEADER_H = 31
const ROW_HEIGHTS = [18, 24, 30]

export function Timeline() {
  const { state, dispatch } = useStore()
  const { project, currentFrame, playing } = state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; frame: number } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [customMenu, setCustomMenu] = useState(false)
  const [rowHeight, setRowHeight] = useState(24)
  const [timelineHeight, setTimelineHeight] = useState(232)
  const [visibleTools, setVisibleTools] = useState({
    frame: true, fps: true, onion: true, grid: true, snap: true, bones: true, zoom: true,
    pose: true, labels: true, tweens: true,
  })
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const layerListRef = useRef<HTMLDivElement>(null)

  const centerFrame = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    scroller.scrollTo({ left: Math.max(0, (currentFrame - 8) * CELL), behavior: 'smooth' })
  }

  const resizeTimeline = (e: React.PointerEvent) => {
    e.preventDefault()
    const center = (e.currentTarget as HTMLElement).closest('.editor-center')
    if (!center) return
    const bottom = center.getBoundingClientRect().bottom
    const move = (ev: PointerEvent) => {
      setTimelineHeight(Math.max(150, Math.min(480, Math.round(bottom - ev.clientY))))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-timeline')
    }
    document.body.classList.add('resizing-timeline')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const toggleAll = (key: 'visible' | 'locked' | 'outline') => {
    const value = !project.layers.every((layer) => layer[key])
    dispatch({ type: 'TOGGLE_ALL_LAYERS', key, value })
  }

  const cycleRowHeight = () => {
    const index = ROW_HEIGHTS.indexOf(rowHeight)
    setRowHeight(ROW_HEIGHTS[(index + 1) % ROW_HEIGHTS.length])
  }

  const customizeTools: { key: keyof typeof visibleTools; label: string }[] = [
    { key: 'frame', label: 'Frame number' },
    { key: 'fps', label: 'Frame rate' },
    { key: 'onion', label: 'Onion skin' },
    { key: 'grid', label: 'Grid' },
    { key: 'snap', label: 'Snap to grid' },
    { key: 'bones', label: 'Show bones' },
    { key: 'zoom', label: 'Zoom' },
    { key: 'pose', label: 'Pose button' },
    { key: 'labels', label: 'Frame labels' },
    { key: 'tweens', label: 'Tween spans' },
  ]

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
  const frameLabels = project.layers
    .flatMap((layer) => layer.frames.flatMap((kf, frame) => (kf?.label ? [{ frame, text: kf.label!, layerId: layer.id }] : [])))
    .slice(0, 16)

  return (
    <div
      className={`timeline ${collapsed ? 'collapsed' : ''}`}
      style={collapsed ? undefined : { height: timelineHeight, flexBasis: timelineHeight }}
    >
      {!collapsed && (
        <div className="timeline-resize-handle" title="Drag to resize timeline" onPointerDown={resizeTimeline}>
          <span />
        </div>
      )}

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
        {visibleTools.frame && <>
          <div className="tl-group">
            <label className="frame-input-label">Frame</label>
            <input className="frame-input" type="number" min="1" max={project.totalFrames} value={currentFrame + 1} onChange={(e) => dispatch({ type: 'SET_CURRENT_FRAME', frame: Number(e.target.value) - 1 })} />
          </div>
          <span className="toolbar-divider" />
        </>}
        {visibleTools.fps && <>
          <div className="tl-group">
            <label className="frame-input-label">FPS</label>
            <input className="fps-input" type="number" min="1" max="120" value={project.fps} onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'fps', value: Number(e.target.value) })} />
          </div>
          <span className="toolbar-divider" />
        </>}
        <button className={`mini-btn ${state.loop ? 'active' : ''}`} title="Loop playback" onClick={() => dispatch({ type: 'TOGGLE', key: 'loop' })}><Icon name="redo" size={13} /></button>
        {visibleTools.onion && <button className={`mini-btn ${state.onionSkin ? 'active' : ''}`} title="Onion skin" onClick={() => dispatch({ type: 'TOGGLE', key: 'onionSkin' })}><Icon name="onion" size={14} /></button>}
        {visibleTools.grid && <button className={`mini-btn ${state.showGrid ? 'active' : ''}`} title="Toggle grid" onClick={() => dispatch({ type: 'TOGGLE', key: 'showGrid' })}><Icon name="grid" size={13} /></button>}
        {visibleTools.snap && <button className={`mini-btn ${state.snapToGrid ? 'active' : ''}`} title="Snap to grid" onClick={() => dispatch({ type: 'TOGGLE', key: 'snapToGrid' })}><Icon name="magnet" size={13} /></button>}
        {visibleTools.bones && <button className={`mini-btn ${state.showBones ? 'active' : ''}`} title="Show bones" onClick={() => dispatch({ type: 'TOGGLE', key: 'showBones' })}><Icon name="bone" size={14} /></button>}
        {visibleTools.zoom && <>
          <span className="toolbar-divider" />
          <span className="zoom-label">{Math.round(state.zoom * 100)}%</span>
          <input className="zoom-slider" type="range" min="0.1" max="4" step="0.05" value={state.zoom} onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: Number(e.target.value) })} title="Stage zoom" />
        </>}
        <div className="tl-spacer" />
        <div className="tl-group">
          <button className="mini-btn" title="Insert frame (F5)" onClick={() => dispatch({ type: 'INSERT_FRAME' })}><Icon name="plus" size={13} /></button>
          <button className="mini-btn" title="Insert keyframe (F6)" onClick={() => dispatch({ type: 'INSERT_KEYFRAME' })}><Icon name="keyframe" size={13} /></button>
          <button className="mini-btn" title="Insert blank keyframe (F7)" onClick={() => dispatch({ type: 'INSERT_KEYFRAME', blank: true })}><Icon name="blankKeyframe" size={13} /></button>
          <button className="mini-btn" title="Copy frame" onClick={() => dispatch({ type: 'COPY_FRAME' })}><Icon name="copy" size={13} /></button>
          <button className="mini-btn" title="Paste frame" onClick={() => dispatch({ type: 'PASTE_FRAME' })}><Icon name="paste" size={13} /></button>
          <button className="mini-btn" title="New frame like previous" onClick={() => dispatch({ type: 'DUPLICATE_FRAME' })}><Icon name="duplicateFrame" size={13} /></button>
          {visibleTools.pose && <button
            className="mini-btn pose-btn"
            title="Add pose keyframe — captures the current rig as a motion keyframe"
            onClick={() => { dispatch({ type: 'INSERT_KEYFRAME' }); dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' }); dispatch({ type: 'STATUS', message: 'Pose keyframe added' }) }}
          ><Icon name="bone" size={13} /></button>}
        </div>
        <span className="toolbar-divider" />
        <div className="tl-customize">
          <button className={`mini-btn ${customMenu ? 'active' : ''}`} title="Customize Timeline Tools" onClick={() => setCustomMenu(!customMenu)}><Icon name="hamburger" size={14} /></button>
          {customMenu && (
            <div className="timeline-custom-menu">
              {customizeTools.map((tool) => (
                <button key={tool.key} className={visibleTools[tool.key] ? 'active' : ''} onClick={() => setVisibleTools((prev) => ({ ...prev, [tool.key]: !prev[tool.key] }))}>
                  <span className="menu-check">{visibleTools[tool.key] ? '✓' : ''}</span>{tool.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="mini-btn" title={collapsed ? 'Expand timeline' : 'Collapse timeline'} onClick={() => setCollapsed(!collapsed)}><Icon name={collapsed ? 'chevronUp' : 'chevronDown'} size={13} /></button>
      </div>

      {!collapsed && (
        <>
          <div className="timeline-body">
            <div className="layer-panel" style={{ width: LABEL_W }}>
              <div className="layer-header" style={{ height: HEADER_H }} onPointerDown={scrub}>
                <span className="layer-header-title">Layer</span>
                <span className="layer-header-icons">
                  <button title="Show/hide all layers" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleAll('visible')}><Icon name="eye" size={12} /></button>
                  <button title="Lock/unlock all layers" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleAll('locked')}><Icon name="lock" size={12} /></button>
                  <button title="Outline all layers" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleAll('outline')}><Icon name="outline" size={12} /></button>
                </span>
              </div>
              <div className="layer-list" ref={layerListRef}>
                {[...project.layers].reverse().map((layer) => {
                  const selected = state.selection.layerId === layer.id
                  const hasRig = layer.frames.some((f) => f && (f.bones?.length ?? 0) > 0)
                  const outlineTitle = layer.outline ? 'Turn off layer outlines' : 'Show layer as outlines'
                  return (
                    <div
                      key={layer.id}
                      className={`layer-row ${selected ? 'selected' : ''} ${hasRig ? 'armature-layer' : ''} ${!layer.visible ? 'hidden' : ''}`}
                      style={{ height: rowHeight }}
                      onClick={() => dispatch({ type: 'SET_SELECTION', selection: { layerId: layer.id, shapeId: null } })}
                    >
                      <span className="layer-expand"><Icon name="chevronRight" size={10} /></span>
                      <button className="layer-icon-btn" title={layer.visible ? 'Hide layer' : 'Show layer'} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { visible: !layer.visible } }) }}>
                        <Icon name={layer.visible ? 'eye' : 'eyeOff'} size={13} />
                      </button>
                      <button className="layer-icon-btn" title={layer.locked ? 'Unlock layer' : 'Lock layer'} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { locked: !layer.locked } }) }}>
                        <Icon name={layer.locked ? 'lock' : 'unlock'} size={13} />
                      </button>
                      <button
                        className={`layer-color ${layer.outline ? 'outlining' : ''}`}
                        style={{ background: layer.color }}
                        title={outlineTitle}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { outline: !layer.outline } }) }}
                      />
                      {hasRig && <span className="armature-badge" title="Armature layer"><Icon name="bone" size={12} /></span>}
                      <input
                        className="layer-name"
                        value={layer.name}
                        spellCheck={false}
                        onChange={(e) => dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { name: e.target.value } })}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        className={`layer-outline ${layer.outline ? 'active' : ''}`}
                        title={outlineTitle}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, patch: { outline: !layer.outline } }) }}
                      >
                        <span style={{ borderColor: layer.color, backgroundColor: layer.outline ? 'transparent' : layer.color }} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="layer-actions">
                <button className="mini-btn" title="Add layer" onClick={() => dispatch({ type: 'ADD_LAYER' })}><Icon name="plus" size={13} /></button>
                <button className="mini-btn" title="Add layer folder" onClick={() => dispatch({ type: 'STATUS', message: 'Layer folders are not supported in this recreation' })}><Icon name="folder" size={13} /></button>
                <button className="mini-btn" title="Delete layer" onClick={() => state.selection.layerId && dispatch({ type: 'DELETE_LAYER', layerId: state.selection.layerId })}><Icon name="trash" size={13} /></button>
                <span className="tl-spacer" />
                <button className="mini-btn" title="Move layer up" onClick={() => state.selection.layerId && dispatch({ type: 'REORDER_LAYER', layerId: state.selection.layerId, direction: 'up' })}><Icon name="chevronUp" size={12} /></button>
                <button className="mini-btn" title="Move layer down" onClick={() => state.selection.layerId && dispatch({ type: 'REORDER_LAYER', layerId: state.selection.layerId, direction: 'down' })}><Icon name="chevronDown" size={12} /></button>
              </div>
            </div>

            <div
              className="timeline-scroll"
              ref={scrollRef}
              onScroll={(e) => {
                if (layerListRef.current) layerListRef.current.scrollTop = e.currentTarget.scrollTop
              }}
            >
              <div style={{ width: gridWidth, minWidth: '100%' }}>
                <div className="frame-header" style={{ width: gridWidth, height: HEADER_H }} onPointerDown={scrub}>
                  <div className="frame-number-row">
                    {ticks.map((f) => (
                      <div key={f} className={`frame-tick ${f % 5 === 0 ? 'major' : ''} ${f === currentFrame ? 'current' : ''}`} style={{ width: CELL }}>
                        {f % 5 === 0 ? f + 1 : ''}
                      </div>
                    ))}
                  </div>
                  <div className="frame-time-row">
                    {ticks.map((f) => (
                      <div
                        key={f}
                        className={`time-cell ${f % project.fps === 0 ? 'second' : ''} ${f === currentFrame ? 'current' : ''}`}
                        style={{ width: CELL }}
                      >
                        {f % project.fps === 0 ? `0:${String(Math.floor(f / project.fps)).padStart(2, '0')}` : f % 5 === 0 ? '·' : ''}
                      </div>
                    ))}
                    {visibleTools.labels && frameLabels.map((label, i) => (
                      <div
                        key={`${label.layerId}-${label.frame}-${i}`}
                        className="frame-label-marker"
                        style={{ left: label.frame * CELL + 2 }}
                        title={`Frame ${label.frame + 1}: ${label.text}`}
                      >{label.text}</div>
                    ))}
                  </div>
                </div>
                <div className="frame-grid" ref={gridRef} style={{ width: gridWidth }} onContextMenu={(e) => {
                  e.preventDefault()
                  const frame = frameFromEvent(e)
                  dispatch({ type: 'SET_CURRENT_FRAME', frame })
                  setContextMenu({ x: e.clientX, y: e.clientY, frame })
                }}>
                  {[...project.layers].reverse().map((layer) => {
                    const keyframeFrames = layer.frames
                      .map((kf, index) => (kf ? index : -1))
                      .filter((index) => index >= 0)
                    const tweenSpans = visibleTools.tweens ? keyframeFrames.flatMap((start, index) => {
                      const kf = layer.frames[start]!
                      if (kf.tween === 'none') return []
                      const previous = index > 0 ? layer.frames[keyframeFrames[index - 1]] : null
                      // A tweened keyframe immediately after another tween is the
                      // endpoint of that span, not the start of a second bar.
                      if (previous && previous.tween !== 'none') return []
                      const next = keyframeFrames[index + 1] ?? project.totalFrames
                      return next > start ? [{ f: start, kf, left: start * CELL, width: (next - start) * CELL }] : []
                    }) : []
                    return (
                    <div key={layer.id} className={`frame-row ${state.selection.layerId === layer.id ? 'selected' : ''} ${!layer.visible ? 'hidden-layer' : ''} ${layer.outline ? 'outline-layer' : ''}`} style={{ width: gridWidth, height: rowHeight }}>
                      {tweenSpans.map((span) => (
                        <div key={`tween-${span.f}`} className={`tween-span ${span.kf.tween}`} style={{ left: span.left, width: span.width }} title={`${span.kf.tween} tween`}>
                          <span className="tween-arrow">›</span>
                        </div>
                      ))}
                      {layer.frames.map((kf, f) => {
                        const isKey = !!kf
                        const active = kf && f === findKeyframeIndex(layer, currentFrame)
                        const isSpan = !!getActiveKeyframe(layer, f) && !isKey
                        const isBlank = isKey && kf && kf.shapes.length === 0 && (kf.bones?.length ?? 0) === 0
                        return (
                          <div
                            key={f}
                            className={`frame-cell ${f % 5 === 0 ? 'major' : ''} ${f === currentFrame ? 'current' : ''} ${isSpan ? 'span' : ''}`}
                            style={{ width: CELL, height: rowHeight }}
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
                                className={`keyframe ${isBlank ? 'blank' : ''} ${(kf.bones?.length ?? 0) > 0 ? 'pose' : ''} ${kf.tween !== 'none' ? `tween-${kf.tween}` : ''} ${active ? 'active' : ''}`}
                                title={`${(kf.bones?.length ?? 0) > 0 ? 'Pose' : isBlank ? 'Blank keyframe' : 'Keyframe'} ${f + 1}${kf.tween !== 'none' ? ` • ${kf.tween} tween` : ''}`}
                              >
                                {(kf.bones?.length ?? 0) > 0 ? '◆' : kf.tween !== 'none' ? '◆' : isBlank ? '○' : '●'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    )
                  })}
                </div>
                <div className="playhead" style={{ left: currentFrame * CELL, top: HEADER_H, height: project.layers.length * rowHeight }} onPointerDown={scrub}>
                  <div className="playhead-head" />
                  <div className="playhead-line" />
                </div>
              </div>
            </div>
          </div>

          <div className="timeline-footer">
            <button className="mini-btn" title="Center frame" onClick={centerFrame}><Icon name="centerFrame" size={13} /></button>
            <span className="toolbar-divider" />
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
            <span className="tl-footer-info">Frame {currentFrame + 1} of {project.totalFrames}</span>
            <button className="mini-btn row-height-btn" title="Layer row height" onClick={cycleRowHeight}><Icon name="rowHeight" size={13} /></button>
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
            { label: 'Copy Frame', action: () => dispatch({ type: 'COPY_FRAME' }) },
            { label: 'Paste Frame', action: () => dispatch({ type: 'PASTE_FRAME' }) },
            { label: 'Duplicate Frame', action: () => dispatch({ type: 'DUPLICATE_FRAME' }) },
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
