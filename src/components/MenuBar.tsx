import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { WindowControls } from './WindowControls'
import { exportAnimationHTML, exportJSON, exportPNG, importImages, openProjectFile } from '../io'
import { useStore } from '../store'
import { createShape, uid } from '../types'
import { getActiveKeyframe } from '../utils'

type Item =
  | { label: string; shortcut?: string; checked?: boolean; separator?: false; action?: () => void; sub?: Item[] }
  | { separator: true; label?: string }

export function MenuBar() {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState('Animation')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 's') { e.preventDefault(); exportJSON(state.project) }
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }) }
      if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); dispatch({ type: 'REDO' }) }
      if (key === 'o') { e.preventDefault(); openProjectFile((project) => dispatch({ type: 'LOAD_PROJECT', project })) }
      if (key === 'd') { e.preventDefault(); dispatch({ type: 'DUPLICATE_SHAPE', layerId: state.selection.layerId ?? state.project.layers[0].id, shapeId: state.selection.shapeId ?? '' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, dispatch])

  const breakApart = () => {
    const layer = state.project.layers.find((l) => l.id === state.selection.layerId)
    const shape = getActiveKeyframe(layer ?? state.project.layers[0], state.currentFrame)?.shapes.find((s) => s.id === state.selection.shapeId)
    if (!layer || !shape) {
      dispatch({ type: 'STATUS', message: 'Select a shape to break apart' })
      return
    }
    const { x, y, width, height } = shape
    const points = shape.type === 'line' || shape.type === 'path'
      ? shape.points ?? [{ x, y }, { x: x + width, y: y + height }]
      : [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
    dispatch({
      type: 'UPDATE_SHAPE', layerId: layer.id, shapeId: shape.id,
      patch: { type: 'path', points, closed: shape.type !== 'line', brush: undefined, text: undefined },
    })
    dispatch({ type: 'STATUS', message: `Broke apart ${shape.name} into a path` })
  }

  const applyWorkspace = (name: string) => {
    setWorkspace(name)
    const simple = name === 'Basic Functions' || name === 'Essential'
    dispatch({ type: 'SET_MODE', mode: simple ? 'simple' : 'pro' })
    const panels: Record<string, string> = {
      Designer: 'properties', Developer: 'publish', Traditional: 'library',
      Debug: 'debug', Animation: 'properties', 'Basic Functions': 'properties', Essential: 'properties',
    }
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: panels[name] ?? 'properties' })
    dispatch({ type: 'STATUS', message: `Workspace: ${name}` })
  }

  const menus: Record<string, Item[]> = {
    File: [
      { label: 'Home Screen', shortcut: 'Ctrl+Shift+H', action: () => dispatch({ type: 'SET_SCREEN', screen: 'home' }) },
      { label: 'New...', shortcut: 'Ctrl+N', action: () => dispatch({ type: 'NEW_PROJECT' }) },
      { label: 'New from Template...', action: () => dispatch({ type: 'SET_SCREEN', screen: 'home' }) },
      { label: 'Open...', shortcut: 'Ctrl+O', action: () => openProjectFile((project) => dispatch({ type: 'LOAD_PROJECT', project })) },
      { separator: true },
      { label: 'Save', shortcut: 'Ctrl+S', action: () => exportJSON(state.project) },
      { label: 'Save As...', action: () => exportJSON(state.project) },
      { label: 'Save to Computer...', action: () => exportJSON(state.project) },
      { separator: true },
      { label: 'Import', sub: [
        { label: 'Import to Stage...', action: () => importImages((images) => {
          for (const img of images) {
            const scale = Math.min((state.project.width * 0.6) / img.width, (state.project.height * 0.6) / img.height, 1)
            dispatch({ type: 'ADD_SHAPE', shape: createShape({
              name: img.name, type: 'image', imageSrc: img.src,
              x: (state.project.width - img.width * scale) / 2,
              y: (state.project.height - img.height * scale) / 2,
              width: img.width * scale, height: img.height * scale,
              fill: 'none', stroke: 'none', strokeWidth: 0,
            }) })
          }
          dispatch({ type: 'STATUS', message: `Imported ${images.length} image(s) to the stage` })
        }) },
        { label: 'Import to Library...', action: () => importImages((images) => {
          for (const img of images) {
            dispatch({ type: 'ADD_LIBRARY_ITEM', item: {
              id: uid('symbol'), name: img.name, type: 'Graphic',
              shapes: [createShape({
                name: img.name, type: 'image', imageSrc: img.src,
                x: 0, y: 0, width: img.width, height: img.height,
                fill: 'none', stroke: 'none', strokeWidth: 0,
              })],
            } })
          }
          dispatch({ type: 'STATUS', message: `Imported ${images.length} image(s) to the Library` })
        }) },
      ] },
      { label: 'Export', sub: [
        { label: 'Export Video / Publish Settings...', shortcut: 'Ctrl+Shift+E', action: () => dispatch({ type: 'SET_PUBLISH_OPEN', open: true }) },
        { label: 'Export MP4 Movie...', action: () => dispatch({ type: 'SET_PUBLISH_OPEN', open: true, format: 'mp4' }) },
        { label: 'Export WebM...', action: () => dispatch({ type: 'SET_PUBLISH_OPEN', open: true, format: 'webm' }) },
        { label: 'Export MKV...', action: () => dispatch({ type: 'SET_PUBLISH_OPEN', open: true, format: 'mkv' }) },
        { label: 'Export Animated GIF...', action: () => dispatch({ type: 'SET_PUBLISH_OPEN', open: true, format: 'gif' }) },
        { separator: true },
        { label: 'Export Image (PNG)', action: () => exportPNG(state.project, state.currentFrame) },
        { label: 'Export Animation (HTML)', action: () => exportAnimationHTML(state.project) },
        { label: 'Export Project (JSON)', action: () => exportJSON(state.project) },
      ] },
      { separator: true },
      { label: 'Publish Settings...', action: () => dispatch({ type: 'SET_PUBLISH_OPEN', open: true, format: 'mp4' }) },
      { label: 'Publish', shortcut: 'Ctrl+Enter', action: () => exportAnimationHTML(state.project) },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: () => dispatch({ type: 'UNDO' }) },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => dispatch({ type: 'REDO' }) },
      { separator: true },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => {
        if (state.selection.shapeId && state.selection.layerId) {
          dispatch({ type: 'COPY_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId })
          dispatch({ type: 'DELETE_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId })
        }
      } },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => state.selection.shapeId && state.selection.layerId && dispatch({ type: 'COPY_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId }) },
      { label: 'Paste', shortcut: 'Ctrl+V', action: () => dispatch({ type: 'PASTE_SHAPE' }) },
      { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => dispatch({ type: 'DUPLICATE_SHAPE', layerId: state.selection.layerId ?? state.project.layers[0].id, shapeId: state.selection.shapeId ?? '' }) },
      { separator: true },
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => dispatch({ type: 'STATUS', message: 'All shapes selected' }) },
      { label: 'Preferences...', shortcut: 'Ctrl+U', action: () => dispatch({ type: 'SET_PREFERENCES_OPEN', open: true }) },
    ],
    View: [
      { label: state.mode === 'simple' ? 'Switch to Pro Mode' : 'Switch to Simple Mode', shortcut: 'Ctrl+Shift+M', action: () => dispatch({ type: 'SET_MODE', mode: state.mode === 'simple' ? 'pro' : 'simple' }) },
      { separator: true },
      { label: state.theme === 'dark' ? 'Light Theme' : 'Dark Theme', action: () => dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' }) },
      { label: 'Rulers', shortcut: 'Ctrl+Shift+R', checked: state.showRulers, action: () => dispatch({ type: 'TOGGLE', key: 'showRulers' }) },
      { label: 'Grid', shortcut: 'Ctrl+\'', checked: state.showGrid, action: () => dispatch({ type: 'TOGGLE', key: 'showGrid' }) },
      { label: 'Snap to Grid', checked: state.snapToGrid, action: () => dispatch({ type: 'TOGGLE', key: 'snapToGrid' }) },
      { separator: true },
      { label: 'Zoom In', shortcut: 'Ctrl++', action: () => dispatch({ type: 'SET_ZOOM', zoom: state.zoom * 1.25 }) },
      { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => dispatch({ type: 'SET_ZOOM', zoom: state.zoom / 1.25 }) },
      { label: 'Fit in Window', action: () => dispatch({ type: 'SET_ZOOM', zoom: 0.75 }) },
      { separator: true },
      { label: 'Onion Skin', checked: state.onionSkin, action: () => dispatch({ type: 'TOGGLE', key: 'onionSkin' }) },
      { label: 'Onion Keyframes Only', checked: state.onionKeyframesOnly, action: () => dispatch({ type: 'TOGGLE', key: 'onionKeyframesOnly' }) },
    ],
    Insert: [
      { label: 'Keyframe', shortcut: 'F6', action: () => dispatch({ type: 'INSERT_KEYFRAME' }) },
      { label: 'Blank Keyframe', shortcut: 'F7', action: () => dispatch({ type: 'INSERT_KEYFRAME', blank: true }) },
      { label: 'Frame', shortcut: 'F5', action: () => dispatch({ type: 'INSERT_FRAME' }) },
      { separator: true },
      { label: 'Layer', shortcut: 'Ctrl+Shift+N', action: () => dispatch({ type: 'ADD_LAYER' }) },
      { label: 'Text', shortcut: 'T', action: () => {
        dispatch({ type: 'SET_TOOL', tool: 'text' })
      } },
    ],
    Modify: [
      { label: 'Document...', shortcut: 'Ctrl+Shift+D', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'document' }) },
      { separator: true },
      { label: 'Convert to Symbol...', shortcut: 'F8', action: () => {
        const layer = state.project.layers.find((l) => l.id === state.selection.layerId)
        const shape = getActiveKeyframe(layer ?? state.project.layers[0], state.currentFrame)?.shapes.find((s) => s.id === state.selection.shapeId)
        if (shape) dispatch({ type: 'ADD_LIBRARY_ITEM', item: { id: uid('symbol'), name: `${shape.name} Symbol`, type: 'Graphic', shapes: [{ ...shape, points: shape.points?.map((p) => ({ ...p })) }] } })
        else dispatch({ type: 'STATUS', message: 'Select a shape first' })
      } },
      { label: 'Break Apart', shortcut: 'Ctrl+B', action: breakApart },
      { separator: true },
      { label: 'Arrange', sub: [
        { label: 'Bring to Front', action: () => state.selection.shapeId && dispatch({ type: 'ARRANGE_SHAPE', layerId: state.selection.layerId!, shapeId: state.selection.shapeId, direction: 'front' }) },
        { label: 'Send to Back', action: () => state.selection.shapeId && dispatch({ type: 'ARRANGE_SHAPE', layerId: state.selection.layerId!, shapeId: state.selection.shapeId, direction: 'back' }) },
      ] },
    ],
    Timeline: [
      { label: 'Insert Frame', shortcut: 'F5', action: () => dispatch({ type: 'INSERT_FRAME' }) },
      { label: 'Remove Frame', shortcut: 'Shift+F5', action: () => dispatch({ type: 'REMOVE_FRAME' }) },
      { label: 'Insert Keyframe', shortcut: 'F6', action: () => dispatch({ type: 'INSERT_KEYFRAME' }) },
      { label: 'Insert Blank Keyframe', shortcut: 'F7', action: () => dispatch({ type: 'INSERT_KEYFRAME', blank: true }) },
      { label: 'Remove Keyframe', shortcut: 'Shift+F6', action: () => dispatch({ type: 'REMOVE_KEYFRAME' }) },
      { separator: true },
      { label: 'Create Motion Tween', action: () => dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' }) },
      { label: 'Create Shape Tween', action: () => dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'shape' }) },
      { separator: true },
      { label: 'Onion Skin', checked: state.onionSkin, action: () => dispatch({ type: 'TOGGLE', key: 'onionSkin' }) },
    ],
    Commands: [
      { label: 'Manage Commands...', action: () => dispatch({ type: 'STATUS', message: 'Manage Commands' }) },
      { label: 'Add Motion Tween', action: () => dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' }) },
    ],
    Control: [
      { label: state.playing ? 'Stop' : 'Play', shortcut: 'Enter', action: () => dispatch({ type: 'SET_PLAYING', playing: !state.playing }) },
      { label: 'Loop Playback', checked: state.loop, action: () => dispatch({ type: 'TOGGLE', key: 'loop' }) },
      { separator: true },
      { label: 'Test Movie', shortcut: 'Ctrl+Enter', action: () => exportAnimationHTML(state.project) },
      { label: 'Test Scene', shortcut: 'Ctrl+Alt+Enter', action: () => dispatch({ type: 'SET_PLAYING', playing: true }) },
    ],
    Debug: [
      { label: 'Debug Movie', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'debug' }) },
      { label: 'Begin Remote Debug Session', action: () => {
        dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'debug' })
        dispatch({ type: 'STATUS', message: 'Local inspector open — remote debugging needs a paired device' })
      } },
    ],
    Window: [
      { label: 'Properties', checked: state.activePanel === 'properties', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'properties' }) },
      { label: 'Library', checked: state.activePanel === 'library', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'library' }) },
      { label: 'Color', checked: state.activePanel === 'color', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'color' }) },
      { label: 'Swatches', checked: state.activePanel === 'swatches', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'swatches' }) },
      { label: 'Align', checked: state.activePanel === 'align', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'align' }) },
      { label: 'Info', checked: state.activePanel === 'info', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'info' }) },
      { label: 'Transform', checked: state.activePanel === 'transform', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'transform' }) },
      { label: 'Motion Presets', checked: state.activePanel === 'motionPresets', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'motionPresets' }) },
      { label: 'Debug', checked: state.activePanel === 'debug', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'debug' }) },
      { separator: true },
      { label: 'Timeline', checked: state.showTimeline, action: () => dispatch({ type: 'TOGGLE', key: 'showTimeline' }) },
    ],
    Help: [
      { label: 'Tutorials & Guides', shortcut: 'Ctrl+Shift+G', action: () => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true }) },
      { label: 'Getting Started', action: () => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true }) },
      { label: 'Keyboard Shortcuts', action: () => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true }) },
      { separator: true },
      { label: 'Animate Help', action: () => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true }) },
      { separator: true },
      { label: 'About Animate', action: () => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'about' }) },
    ],
  }

  const renderItem = (item: Item, i: number) => {
    if ('separator' in item && item.separator) return <div className="menu-separator" key={i} />
    const hasSub = 'sub' in item && item.sub?.length
    return (
      <div
        className={`menu-item ${hasSub ? 'has-sub' : ''}`}
        data-label={item.label}
        key={i}
        onClick={(e) => {
          e.stopPropagation()
          if (hasSub) return
          item.action?.()
          setOpen(null)
        }}
      >
        <span className="menu-check">{item.checked ? '✓' : ''}</span>
        <span className="menu-label">{item.label}</span>
        {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
        {hasSub && <Icon name="chevronRight" size={12} />}
        {hasSub && (
          <div className="submenu">
            {item.sub!.map((sub, j) => renderItem(sub, j))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-top" ref={ref}>
      <div className="menu-bar">
        <button
          className="adobe-mark"
          title="Home screen"
          aria-label="Home screen"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'home' })}
        >
          <Icon name="Adobe" size={17} />
        </button>
        {Object.keys(menus).map((name) => (
          <div
            key={name}
            className={`menu-trigger ${open === name ? 'active' : ''}`}
            onClick={() => setOpen(open === name ? null : name)}
            onMouseEnter={() => open && setOpen(name)}
          >
            {name}
            {open === name && <div className="dropdown-menu">{menus[name].map(renderItem)}</div>}
          </div>
        ))}

        <div className="doc-tabs">
          <div className="doc-tab active" title={state.project.name}>
            <Icon name="film" size={13} />
            <span className="doc-tab-name">{state.project.name}*</span>
            <button className="tab-close" title="Close document" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'home' })}>×</button>
          </div>
          <button className="new-tab" title="New document" onClick={() => dispatch({ type: 'NEW_PROJECT' })}>+</button>
        </div>

        <div className="menu-tail">
          <select className="workspace-select" value={workspace} onChange={(e) => applyWorkspace(e.target.value)} title="Workspace">
            {['Animation', 'Designer', 'Developer', 'Traditional', 'Basic Functions', 'Debug', 'Essential'].map((w) => <option key={w}>{w}</option>)}
          </select>
          <button className="top-icon-btn" title="Tutorials & guides (Ctrl+Shift+G)" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true })}><Icon name="book" size={15} /></button>
          <button className="top-icon-btn" title={state.mode === 'simple' ? 'Switch to Pro Mode' : 'Switch to Simple Mode'} onClick={() => dispatch({ type: 'SET_MODE', mode: state.mode === 'simple' ? 'pro' : 'simple' })}><Icon name={state.mode === 'simple' ? 'pro' : 'beginner'} size={15} /></button>
          <button className="top-icon-btn" title={state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' })}>
            <Icon name={state.theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>
          <WindowControls />
        </div>
      </div>
    </div>
  )
}

export function insertTextShape(dispatch: ReturnType<typeof useStore>['dispatch'], state: ReturnType<typeof useStore>['state']) {
  dispatch({
    type: 'ADD_SHAPE',
    shape: createShape({
      id: uid('shape'),
      name: 'Text',
      type: 'text',
      x: state.project.width / 2 - 60,
      y: state.project.height / 2 - 20,
      width: 120,
      height: 34,
      text: 'Your text here',
      fontSize: 28,
      fill: state.fillColor,
    }),
  })
}
