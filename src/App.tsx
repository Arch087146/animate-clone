import { useEffect, useState } from 'react'
import { HomeScreen } from './components/HomeScreen'
import { MenuBar } from './components/MenuBar'
import { PreferencesDialog } from './components/PreferencesDialog'
import { PublishDialog } from './components/PublishDialog'
import { SimpleMode } from './components/SimpleMode'
import { RightPanel } from './components/RightPanel'
import { Stage } from './components/Stage'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { Tutorials } from './components/Tutorials'
import { exportAnimationHTML } from './io'
import { uid } from './types'
import { getActiveKeyframe } from './utils'
import { useStore } from './store'
import type { ToolId } from './types'

const toolKeys: Record<string, ToolId> = {
  v: 'selection', a: 'subselection', l: 'lasso', p: 'pen', t: 'text', n: 'line',
  r: 'rectangle', o: 'oval', y: 'pencil', b: 'brush', e: 'eraser', s: 'inkBottle',
  k: 'paintBucket', i: 'eyedropper', h: 'hand', z: 'zoom', m: 'bone',
}

/** Brief, non-blocking feedback message — replaces the old status bar. */
function StatusToast() {
  const { state } = useStore()
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!state.statusMessage) return
    setMessage(state.statusMessage)
    const timer = window.setTimeout(() => setMessage(''), 2800)
    return () => window.clearTimeout(timer)
  }, [state.statusMessage])
  if (!message) return null
  return <div className="status-toast">{message}</div>
}

export default function App() {
  const { state, dispatch } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'n' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'NEW_PROJECT' }); return }
      if (mod && key === 'x' && state.selection.shapeId && state.selection.layerId) {
        e.preventDefault()
        dispatch({ type: 'COPY_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId })
        dispatch({ type: 'DELETE_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId })
        return
      }
      if (mod && e.shiftKey && key === 'h') { e.preventDefault(); dispatch({ type: 'SET_SCREEN', screen: 'home' }); return }
      if (mod && e.shiftKey && key === 'g') { e.preventDefault(); dispatch({ type: 'SET_TUTORIALS_OPEN', open: !state.showTutorials }); return }
      if (mod && e.shiftKey && key === 'm') {
        e.preventDefault()
        dispatch({ type: 'SET_MODE', mode: state.mode === 'simple' ? 'pro' : 'simple' })
        return
      }
      if (mod && e.shiftKey && key === 'e') { e.preventDefault(); dispatch({ type: 'SET_PUBLISH_OPEN', open: true }); return }
      if (mod && key === 'u') { e.preventDefault(); dispatch({ type: 'SET_PREFERENCES_OPEN', open: true }); return }
      if (mod && key === 'enter') { e.preventDefault(); exportAnimationHTML(state.project); return }
      if (mod && key === 'c' && state.selection.shapeId && state.selection.layerId) {
        e.preventDefault(); dispatch({ type: 'COPY_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId }); return
      }
      if (mod && key === 'v') { e.preventDefault(); dispatch({ type: 'PASTE_SHAPE' }); return }
      if (mod) return

      if (state.screen !== 'editor') return

      if (key === 'f5') { e.preventDefault(); dispatch({ type: 'INSERT_FRAME' }); return }
      if (key === 'f6') { e.preventDefault(); dispatch({ type: 'INSERT_KEYFRAME' }); return }
      if (key === 'f7') { e.preventDefault(); dispatch({ type: 'INSERT_KEYFRAME', blank: true }); return }
      if (key === 'f8') {
        e.preventDefault()
        const layer = state.project.layers.find((l) => l.id === state.selection.layerId)
        const shape = getActiveKeyframe(layer ?? state.project.layers[0], state.currentFrame)?.shapes.find((s) => s.id === state.selection.shapeId)
        if (shape) dispatch({ type: 'ADD_LIBRARY_ITEM', item: { id: uid('symbol'), name: `${shape.name} Symbol`, type: 'Graphic', shapes: [{ ...shape, points: shape.points?.map((p) => ({ ...p })) }] } })
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selection.shapeId && state.selection.layerId) {
          e.preventDefault()
          dispatch({ type: 'DELETE_SHAPE', layerId: state.selection.layerId, shapeId: state.selection.shapeId })
        }
        return
      }
      if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'SET_PLAYING', playing: !state.playing }); return }
      if (e.key === 'Escape') { dispatch({ type: 'SET_SELECTION', selection: { layerId: state.selection.layerId, shapeId: null } }); return }
      if (e.key.startsWith('Arrow') && state.selection.shapeId && state.selection.layerId) {
        e.preventDefault()
        const layer = state.project.layers.find((l) => l.id === state.selection.layerId)
        const kf = layer?.frames.find((f) => f?.shapes.some((s) => s.id === state.selection.shapeId))
        const shape = kf?.shapes.find((s) => s.id === state.selection.shapeId)
        if (shape) {
          const step = e.shiftKey ? 10 : 1
          dispatch({
            type: 'UPDATE_SHAPE', layerId: state.selection.layerId, shapeId: shape.id,
            patch: {
              x: shape.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
              y: shape.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
              points: shape.points?.map((p) => ({
                x: p.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
                y: p.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
              })),
            },
          })
        }
        return
      }
      if (toolKeys[key]) { dispatch({ type: 'SET_TOOL', tool: toolKeys[key] }); return }
      if (e.key === '+' || e.key === '=') dispatch({ type: 'SET_ZOOM', zoom: state.zoom * 1.25 })
      if (e.key === '-') dispatch({ type: 'SET_ZOOM', zoom: state.zoom / 1.25 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, dispatch])

  return (
    <div className={`app-shell ${state.theme === 'dark' ? 'dark' : ''}`}>
      {state.screen === 'home' && <HomeScreen />}

      {state.screen === 'editor' && state.mode === 'simple' && <SimpleMode />}

      {state.screen === 'editor' && state.mode === 'pro' && <>
        <MenuBar />
        <div className="app-main">
          <Toolbar />
          <Stage />
          <RightPanel />
        </div>
        {state.showTimeline && <Timeline />}
      </>}

      <StatusToast />
      <Tutorials />
      <PublishDialog />
      <PreferencesDialog />
    </div>
  )
}
