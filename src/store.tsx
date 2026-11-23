import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
import {
  createInitialProject,
  createKeyframe,
  createLayer,
  createShape,
  createToolSettings,
  type AppMode,
  type AppScreen,
  type AppState,
  type Bone,
  type Keyframe,
  type Layer,
  type LibraryItem,
  type Point,
  type Project,
  type Selection,
  type Shape,
  type ToolId,
  type ToolSettings,
  uid,
} from './types'
import { normalizeProject, preloadProjectImages } from './io'
import { addRecent } from './recents'
import { createTemplateProject, type CanvasPreset } from './templates'
import { distanceToSegment, findKeyframeIndex, getActiveKeyframe } from './utils'

export type Action =
  | { type: 'SET_TOOL'; tool: ToolId }
  | { type: 'SET_FILL'; color: string }
  | { type: 'SET_STROKE'; color: string }
  | { type: 'SET_STROKE_WIDTH'; width: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; pan: Point }
  | { type: 'SET_CURRENT_FRAME'; frame: number }
  | { type: 'SET_SELECTION'; selection: Selection }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'TOGGLE'; key: 'loop' | 'onionSkin' | 'showRulers' | 'showGrid' | 'snapToGrid' | 'showBones' | 'onionKeyframesOnly' | 'showTimeline' }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }
  | { type: 'SET_MODE'; mode: AppMode }
  | { type: 'SET_SCREEN'; screen: AppScreen }
  | { type: 'SET_TUTORIALS_OPEN'; open: boolean }
  | { type: 'SET_TOOL_OPTIONS_OPEN'; open: boolean }
  | { type: 'SET_PUBLISH_OPEN'; open: boolean; format?: string }
  | { type: 'SET_PREFERENCES_OPEN'; open: boolean }
  | { type: 'SET_TOOL_SETTING'; key: keyof ToolSettings; value: number | string | boolean }
  | { type: 'CREATE_PROJECT'; templateId: string; preset?: CanvasPreset; name?: string; background?: string }
  | { type: 'SET_ONION_RANGE'; range: number }
  | { type: 'SET_ONION_OPACITY'; opacity: number }
  | { type: 'SET_ACTIVE_PANEL'; panel: string }
  | { type: 'SET_SELECTED_FRAMES'; frames: number[] }
  | { type: 'MARK_SAVED' }
  | { type: 'STATUS'; message: string }
  | { type: 'BEGIN_TRANSFORM' }
  | { type: 'END_TRANSFORM' }
  | { type: 'ADD_SHAPE'; shape: Shape }
  | { type: 'UPDATE_SHAPE'; layerId: string; shapeId: string; patch: Partial<Shape> }
  | { type: 'DELETE_SHAPE'; layerId: string; shapeId: string }
  | { type: 'DUPLICATE_SHAPE'; layerId: string; shapeId: string }
  | { type: 'ARRANGE_SHAPE'; layerId: string; shapeId: string; direction: 'front' | 'back' }
  | { type: 'COPY_SHAPE'; layerId: string; shapeId: string }
  | { type: 'PASTE_SHAPE' }
  | { type: 'ADD_BONE'; bone: Bone }
  | { type: 'SET_BONES'; bones: Bone[]; shapePatches?: { id: string; patch: Partial<Shape> }[] }
  | { type: 'DELETE_BONE'; boneId: string }
  | { type: 'SET_BONE_PROP'; boneId: string; patch: Partial<Bone> }
  | { type: 'BIND_SHAPES_TO_BONES' }
  | { type: 'ATTACH_SHAPE'; shapeId: string; boneId: string | null }
  | { type: 'ADD_LIBRARY_ITEM'; item: LibraryItem }
  | { type: 'DELETE_LIBRARY_ITEM'; itemId: string }
  | { type: 'PLACE_LIBRARY_ITEM'; itemId: string }
  | { type: 'ADD_LAYER' }
  | { type: 'DELETE_LAYER'; layerId: string }
  | { type: 'UPDATE_LAYER'; layerId: string; patch: Partial<Layer> }
  | { type: 'TOGGLE_ALL_LAYERS'; key: 'visible' | 'locked' | 'outline'; value: boolean }
  | { type: 'REORDER_LAYER'; layerId: string; direction: 'up' | 'down' }
  | { type: 'DUPLICATE_LAYER'; layerId: string }
  | { type: 'INSERT_KEYFRAME'; blank?: boolean; frame?: number }
  | { type: 'REMOVE_KEYFRAME'; frame?: number }
  | { type: 'INSERT_FRAME'; frame?: number }
  | { type: 'REMOVE_FRAME'; frame?: number }
  | { type: 'CLEAR_KEYFRAMES' }
  | { type: 'SET_KEYFRAME_TWEEN'; tween: Keyframe['tween'] }
  | { type: 'SET_KEYFRAME_EASE'; ease: number }
  | { type: 'SET_KEYFRAME_LABEL'; label: string }
  | { type: 'SET_PROJECT_PROP'; prop: keyof Project; value: string | number }
  | { type: 'LOAD_PROJECT'; project: Project }
  | { type: 'NEW_PROJECT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

interface Store {
  state: AppState
  past: Project[]
  future: Project[]
  historyLocked: boolean
  transformBase: Project | null
}

const initialState: AppState = {
  theme: (localStorage.getItem('animate-theme') as 'dark' | 'light') || 'dark',
  mode: (localStorage.getItem('animate-mode') as AppMode) || 'simple',
  screen: 'home' as AppScreen,
  toolSettings: createToolSettings(),
  showTutorials: false,
  showToolOptions: false,
  showPublish: false,
  showPreferences: false,
  publishFormat: 'mp4',
  showTimeline: true,
  project: createInitialProject(),
  currentFrame: 0,
  tool: 'selection',
  selection: { layerId: null, shapeId: null },
  fillColor: '#1473e6',
  strokeColor: '#000000',
  strokeWidth: 1,
  zoom: 1,
  pan: { x: 0, y: 0 },
  playing: false,
  loop: true,
  onionSkin: false,
  showRulers: true,
  showGrid: false,
  snapToGrid: false,
  showBones: true,
  onionRange: 2,
  onionOpacity: 0.16,
  onionKeyframesOnly: false,
  clipboard: [],
  activePanel: 'properties',
  selectedFrames: [],
  statusMessage: 'Ready',
  dirty: false,
}

const cloneShapes = (shapes: Shape[]): Shape[] =>
  shapes.map((s) => ({ ...s, points: s.points?.map((p) => ({ ...p })) }))

const cloneBones = (bones: Bone[] = []): Bone[] => bones.map((b) => ({ ...b }))

function ensureKeyframe(project: Project, layer: Layer, frame: number): { layer: Layer; keyframe: Keyframe } | null {
  if (layer.locked || frame < 0 || frame >= project.totalFrames) return null
  const existing = layer.frames[frame]
  if (existing) return { layer, keyframe: existing }

  const idx = findKeyframeIndex(layer, frame)
  const previous = idx >= 0 ? layer.frames[idx] : null
  const keyframe = createKeyframe(frame, previous ? cloneShapes(previous.shapes) : [], previous ? cloneBones(previous.bones) : [])
  if (previous) {
    keyframe.tween = previous.tween
    keyframe.ease = previous.ease
    keyframe.label = previous.label
  }
  const newFrames = [...layer.frames]
  if (previous) {
    newFrames[previous.start] = { ...previous, duration: Math.max(1, frame - previous.start) }
  }
  newFrames[frame] = keyframe
  return { layer: { ...layer, frames: newFrames }, keyframe }
}

function mapLayer(project: Project, layerId: string, fn: (layer: Layer) => Layer): Project {
  return { ...project, layers: project.layers.map((l) => (l.id === layerId ? fn(l) : l)) }
}

function mutate(store: Store, updater: (project: Project, state: AppState) => Project, status?: string): Store {
  const nextProject = updater(store.state.project, store.state)
  if (nextProject === store.state.project) return store
  // During a drag, only the first real mutation becomes an undo step.
  const alreadyRecorded = store.historyLocked && store.transformBase !== store.state.project
  const past = store.historyLocked
    ? (alreadyRecorded ? store.past : [...store.past, store.transformBase ?? store.state.project].slice(-100))
    : [...store.past, store.state.project].slice(-100)
  return {
    ...store,
    past,
    future: [],
    state: {
      ...store.state,
      project: nextProject,
      statusMessage: status ?? store.state.statusMessage,
      dirty: true,
    },
  }
}

function withClampedFrame(store: Store, reset = false): Store {
  const max = Math.max(0, store.state.project.totalFrames - 1)
  const frame = reset ? 0 : Math.min(max, Math.max(0, store.state.currentFrame))
  if (store.state.currentFrame === frame && store.state.selectedFrames.length === 0) return store
  return { ...store, state: { ...store.state, currentFrame: frame, selectedFrames: [] } }
}

function resizeFrames(project: Project, totalFrames: number): Project {
  return {
    ...project,
    totalFrames,
    layers: project.layers.map((l) => {
      const frames = Array(totalFrames).fill(null) as (Keyframe | null)[]
      l.frames.forEach((kf, i) => {
        if (kf && i < totalFrames) frames[i] = kf
      })
      return { ...l, frames }
    }),
  }
}

function reducer(store: Store, action: Action): Store {
  const { state } = store
  const p = state.project

  switch (action.type) {
    case 'SET_TOOL':
      return { ...store, state: { ...state, tool: action.tool, statusMessage: `${action.tool} tool` } }
    case 'SET_FILL':
      return { ...store, state: { ...state, fillColor: action.color } }
    case 'SET_STROKE':
      return { ...store, state: { ...state, strokeColor: action.color } }
    case 'SET_STROKE_WIDTH':
      return { ...store, state: { ...state, strokeWidth: action.width } }
    case 'SET_ZOOM':
      return { ...store, state: { ...state, zoom: Math.max(0.1, Math.min(8, action.zoom)) } }
    case 'SET_PAN':
      return { ...store, state: { ...state, pan: action.pan } }
    case 'SET_CURRENT_FRAME':
      return {
        ...store,
        state: {
          ...state,
          currentFrame: Math.max(0, Math.min(p.totalFrames - 1, Math.round(action.frame))),
          selectedFrames: [],
        },
      }
    case 'SET_SELECTION':
      return { ...store, state: { ...state, selection: action.selection } }
    case 'SET_PLAYING':
      return { ...store, state: { ...state, playing: action.playing } }
    case 'TOGGLE':
      return { ...store, state: { ...state, [action.key]: !state[action.key] } }
    case 'SET_THEME':
      localStorage.setItem('animate-theme', action.theme)
      return { ...store, state: { ...state, theme: action.theme } }
    case 'SET_MODE':
      localStorage.setItem('animate-mode', action.mode)
      return { ...store, state: { ...state, mode: action.mode, statusMessage: action.mode === 'simple' ? 'Simple mode' : 'Pro mode' } }
    case 'SET_SCREEN':
      return { ...store, state: { ...state, screen: action.screen } }
    case 'SET_TUTORIALS_OPEN':
      return { ...store, state: { ...state, showTutorials: action.open } }
    case 'SET_TOOL_OPTIONS_OPEN':
      return { ...store, state: { ...state, showToolOptions: action.open } }

    case 'SET_PUBLISH_OPEN':
      return { ...store, state: { ...state, showPublish: action.open, publishFormat: action.open ? (action.format ?? 'mp4') : state.publishFormat } }
    case 'SET_PREFERENCES_OPEN':
      return { ...store, state: { ...state, showPreferences: action.open } }
    case 'SET_TOOL_SETTING':
      return { ...store, state: { ...state, toolSettings: { ...state.toolSettings, [action.key]: action.value } as ToolSettings } }
    case 'CREATE_PROJECT': {
      const project = createTemplateProject(action.templateId, action.preset)
      if (action.name) project.name = action.name
      if (action.background) project.backgroundColor = action.background
      addRecent(project)
      return {
        ...store,
        past: [],
        future: [],
        state: {
          ...state,
          project,
          screen: 'editor',
          currentFrame: 0,
          selection: { layerId: project.layers[0]?.id ?? null, shapeId: null, boneId: null },
          statusMessage: `Created ${project.name}`,
          dirty: false,
        },
      }
    }
    case 'SET_ONION_RANGE':
      return { ...store, state: { ...state, onionRange: Math.max(0, Math.min(5, action.range)) } }
    case 'SET_ONION_OPACITY':
      return { ...store, state: { ...state, onionOpacity: Math.max(0.02, Math.min(0.8, action.opacity)) } }
    case 'SET_ACTIVE_PANEL':
      return { ...store, state: { ...state, activePanel: action.panel } }
    case 'SET_SELECTED_FRAMES':
      return { ...store, state: { ...state, selectedFrames: action.frames } }
    case 'MARK_SAVED':
      return { ...store, state: { ...state, dirty: false } }
    case 'STATUS':
      return { ...store, state: { ...state, statusMessage: action.message } }
    case 'BEGIN_TRANSFORM':
      return {
        ...store,
        historyLocked: true,
        transformBase: p,
        future: [],
      }
    case 'END_TRANSFORM':
      return { ...store, historyLocked: false, transformBase: null }

    case 'ADD_SHAPE': {
      const layerId = state.selection.layerId ?? p.layers[0]?.id ?? null
      const next = mutate(
        store,
        (project) => {
          const targetId = state.selection.layerId ?? project.layers[0]?.id
          const layer = project.layers.find((l) => l.id === targetId)
          if (!layer) return project
          const ensured = ensureKeyframe(project, layer, state.currentFrame)
          if (!ensured) return project
          return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layer.id ? ensured.layer : l)) }, layer.id, (l) => ({
            ...l,
            frames: l.frames.map((f, i) =>
              i === state.currentFrame && f ? { ...f, shapes: [...f.shapes, action.shape] } : f,
            ),
          }))
        },
        `Added ${action.shape.name}`,
      )
      if (next.state.project === p) return next
      return {
        ...next,
        state: { ...next.state, selection: { layerId, shapeId: action.shape.id } },
      }
    }

    case 'UPDATE_SHAPE':
      return mutate(store, (project) => {
        const layer = project.layers.find((l) => l.id === action.layerId)
        if (!layer) return project
        const frame = state.currentFrame
        const activeIndex = findKeyframeIndex(layer, frame)
        const active = activeIndex >= 0 ? layer.frames[activeIndex] : null
        let workingLayer = layer
        if (!active || !active.shapes.some((s) => s.id === action.shapeId)) {
          const ensured = ensureKeyframe(project, layer, frame)
          if (!ensured) return project
          workingLayer = ensured.layer
        }
        return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layer.id ? workingLayer : l)) }, layer.id, (l) => ({
          ...l,
          frames: l.frames.map((f, i) =>
            i === frame && f
              ? { ...f, shapes: f.shapes.map((s) => (s.id === action.shapeId ? { ...s, ...action.patch } : s)) }
              : f,
          ),
        }))
      })

    case 'DELETE_SHAPE':
      return mutate(
        store,
        (project) =>
          mapLayer(project, action.layerId, (l) => ({
            ...l,
            frames: l.frames.map((f) => (f ? { ...f, shapes: f.shapes.filter((s) => s.id !== action.shapeId) } : f)),
          })),
        'Deleted shape',
      )

    case 'DUPLICATE_SHAPE':
      return mutate(store, (project) => {
        const layer = project.layers.find((l) => l.id === action.layerId)
        const idx = state.currentFrame
        const active = layer ? getActiveKeyframe(layer, idx) : null
        const shape = active?.shapes.find((s) => s.id === action.shapeId)
        if (!layer || !shape) return project
        const copy: Shape = {
          ...shape,
          id: uid('shape'),
          name: `${shape.name} copy`,
          x: shape.x + 16,
          y: shape.y + 16,
          points: shape.points?.map((pt) => ({ x: pt.x + 16, y: pt.y + 16 })),
        }
        const ensured = ensureKeyframe(project, layer, idx)
        if (!ensured) return project
        return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layer.id ? ensured.layer : l)) }, layer.id, (l) => ({
          ...l,
          frames: l.frames.map((f, i) => (i === idx && f ? { ...f, shapes: [...f.shapes, copy] } : f)),
        }))
      }, 'Duplicated shape')

    case 'ARRANGE_SHAPE':
      return mutate(store, (project) =>
        mapLayer(project, action.layerId, (l) => ({
          ...l,
          frames: l.frames.map((f) => {
            if (!f) return f
            const index = f.shapes.findIndex((s) => s.id === action.shapeId)
            if (index < 0) return f
            const shapes = [...f.shapes]
            const [shape] = shapes.splice(index, 1)
            shapes.splice(action.direction === 'front' ? shapes.length : 0, 0, shape)
            return { ...f, shapes }
          }),
        })),
      )

    case 'COPY_SHAPE': {
      const layer = p.layers.find((l) => l.id === action.layerId)
      const kf = layer ? getActiveKeyframe(layer, state.currentFrame) : null
      const shape = kf?.shapes.find((s) => s.id === action.shapeId)
      if (!shape) return store
      return { ...store, state: { ...state, clipboard: cloneShapes([shape]), statusMessage: `Copied ${shape.name}` } }
    }

    case 'PASTE_SHAPE': {
      const layerId = state.selection.layerId ?? p.layers[0]?.id
      const layer = p.layers.find((l) => l.id === layerId)
      if (!layer || !state.clipboard.length) return store
      const copies = state.clipboard.map((s) => ({
        ...cloneShapes([s])[0],
        id: uid('shape'),
        name: `${s.name} copy`,
        x: s.x + 20,
        y: s.y + 20,
        points: s.points?.map((pt) => ({ x: pt.x + 20, y: pt.y + 20 })),
      }))
      const next = mutate(store, (project) => {
        const target = project.layers.find((l) => l.id === layerId)
        if (!target) return project
        const ensured = ensureKeyframe(project, target, state.currentFrame)
        if (!ensured) return project
        return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layerId ? ensured.layer : l)) }, layerId, (l) => ({
          ...l,
          frames: l.frames.map((f, i) => (i === state.currentFrame && f ? { ...f, shapes: [...f.shapes, ...copies] } : f)),
        }))
      }, `Pasted ${copies.length} shape(s)`)
      if (next.state.project === p) return next
      return { ...next, state: { ...next.state, selection: { layerId, shapeId: copies[0].id } } }
    }

    case 'ADD_BONE': {
      const layerId = state.selection.layerId ?? p.layers[0]?.id
      const layer = p.layers.find((l) => l.id === layerId)
      if (!layer || layer.locked) return store
      const next = mutate(store, (project) => {
        const target = project.layers.find((l) => l.id === layerId)
        if (!target) return project
        const ensured = ensureKeyframe(project, target, state.currentFrame)
        if (!ensured) return project
        return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layerId ? ensured.layer : l)) }, layerId, (l) => ({
          ...l,
          frames: l.frames.map((f, i) => (i === state.currentFrame && f ? { ...f, bones: [...(f.bones ?? []), action.bone] } : f)),
        }))
      }, `Added bone ${action.bone.name}`)
      return {
        ...next,
        state: { ...next.state, selection: { layerId, shapeId: null, boneId: action.bone.id } },
      }
    }

    case 'SET_BONES':
      return mutate(store, (project) => {
        const layerId = state.selection.layerId ?? project.layers[0]?.id
        const layer = project.layers.find((l) => l.id === layerId)
        if (!layer) return project
        let working = layer
        const active = layer.frames[state.currentFrame]
        if (!active) {
          const ensured = ensureKeyframe(project, layer, state.currentFrame)
          if (!ensured) return project
          working = ensured.layer
        }
        const patchMap = new Map((action.shapePatches ?? []).map((sp) => [sp.id, sp.patch]))
        return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layerId ? working : l)) }, layerId, (l) => ({
          ...l,
          frames: l.frames.map((f, i) =>
            i === state.currentFrame && f
              ? {
                  ...f,
                  bones: action.bones,
                  shapes: f.shapes.map((s) => (patchMap.has(s.id) ? { ...s, ...patchMap.get(s.id) } : s)),
                }
              : f,
          ),
        }))
      })

    case 'DELETE_BONE': {
      const next = mutate(store, (project) => {
        const layerId = state.selection.layerId ?? project.layers[0]?.id
        return mapLayer(project, layerId, (l) => ({
          ...l,
          frames: l.frames.map((f) => {
            if (!f) return f
            const removed = (f.bones ?? []).find((b) => b.id === action.boneId)
            return {
              ...f,
              bones: (f.bones ?? [])
                .filter((b) => b.id !== action.boneId)
                .map((b) => (b.parentId === action.boneId ? { ...b, parentId: removed?.parentId ?? null } : b)),
              shapes: f.shapes.map((s) => (s.boneId === action.boneId ? { ...s, boneId: null } : s)),
            }
          }),
        }))
      }, 'Deleted bone')
      return { ...next, state: { ...next.state, selection: { layerId: next.state.selection.layerId, shapeId: null, boneId: null } } }
    }

    case 'SET_BONE_PROP':
      return mutate(store, (project) => ({
        ...project,
        layers: project.layers.map((l) => ({
          ...l,
          frames: l.frames.map((f) => f ? {
            ...f,
            bones: (f.bones ?? []).map((b) => (b.id === action.boneId ? { ...b, ...action.patch } : b)),
          } : f),
        })),
      }), `Updated ${action.patch.name ?? 'bone'} properties`)

    case 'BIND_SHAPES_TO_BONES': {
      const layerId = state.selection.layerId ?? p.layers[0]?.id
      const layer = p.layers.find((l) => l.id === layerId)
      const kf = layer ? getActiveKeyframe(layer, state.currentFrame) : null
      const bones = kf?.bones ?? []
      if (!layer || !bones.length) return store
      const maxArea = p.width * p.height * 0.35
      const map = new Map<string, string>()
      for (const shape of kf?.shapes ?? []) {
        if (shape.width * shape.height > maxArea) continue
        const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
        let best: { id: string; d: number } | null = null
        for (const bone of bones) {
          const d = distanceToSegment(center, { x: bone.x1, y: bone.y1 }, { x: bone.x2, y: bone.y2 })
          if (!best || d < best.d) best = { id: bone.id, d }
        }
        if (best && best.d < Math.max(p.width, p.height) * 0.3) map.set(shape.id, best.id)
      }
      const next = mutate(store, (project) => mapLayer(project, layerId, (l) => ({
        ...l,
        frames: l.frames.map((f) => f ? {
          ...f,
          shapes: f.shapes.map((s) => map.has(s.id) ? { ...s, boneId: map.get(s.id) } : s),
        } : f),
      })), `Bound ${map.size} shape(s) to bones`)
      return next
    }

    case 'ATTACH_SHAPE':
      return mutate(store, (project) => {
        const layerId = state.selection.layerId ?? project.layers[0]?.id
        return mapLayer(project, layerId, (l) => ({
          ...l,
          frames: l.frames.map((f) =>
            f ? { ...f, shapes: f.shapes.map((s) => (s.id === action.shapeId ? { ...s, boneId: action.boneId } : s)) } : f,
          ),
        }))
      }, action.boneId ? 'Attached shape to bone' : 'Detached shape from bone')

    case 'ADD_LIBRARY_ITEM':
      return mutate(store, (project) => ({ ...project, library: [...(project.library ?? []), action.item] }), `Created symbol ${action.item.name}`)

    case 'DELETE_LIBRARY_ITEM':
      return mutate(store, (project) => ({ ...project, library: (project.library ?? []).filter((i) => i.id !== action.itemId) }), 'Deleted symbol')

    case 'PLACE_LIBRARY_ITEM': {
      const item = (p.library ?? []).find((i) => i.id === action.itemId)
      const layerId = state.selection.layerId ?? p.layers[0]?.id
      if (!item || !layerId) return store
      const copies = item.shapes.map((s) => ({
        ...cloneShapes([s])[0],
        id: uid('shape'),
        name: `${item.name} instance`,
        x: s.x + 40,
        y: s.y + 40,
        points: s.points?.map((pt) => ({ x: pt.x + 40, y: pt.y + 40 })),
      }))
      const next = mutate(store, (project) => {
        const layer = project.layers.find((l) => l.id === layerId)
        if (!layer) return project
        const ensured = ensureKeyframe(project, layer, state.currentFrame)
        if (!ensured) return project
        return mapLayer({ ...project, layers: project.layers.map((l) => (l.id === layerId ? ensured.layer : l)) }, layerId, (l) => ({
          ...l,
          frames: l.frames.map((f, i) => (i === state.currentFrame && f ? { ...f, shapes: [...f.shapes, ...copies] } : f)),
        }))
      }, `Placed ${item.name}`)
      if (next.state.project === p) return next
      return { ...next, state: { ...next.state, selection: { layerId, shapeId: copies[0]?.id ?? null } } }
    }

    case 'ADD_LAYER': {
      const newLayer = createLayer(`Layer ${p.layers.length + 1}`, p.totalFrames, p.layers.length)
      const targetIndex = p.layers.findIndex((l) => l.id === state.selection.layerId)
      const insertAt = targetIndex >= 0 ? targetIndex + 1 : p.layers.length
      const layers = [...p.layers]
      layers.splice(insertAt, 0, newLayer)
      const next = mutate(store, (project) => ({ ...project, layers }), 'Added layer')
      return {
        ...next,
        state: { ...next.state, selection: { layerId: newLayer.id, shapeId: null } },
      }
    }

    case 'DELETE_LAYER': {
      if (p.layers.length <= 1) return store
      const layers = p.layers.filter((l) => l.id !== action.layerId)
      const next = mutate(store, (project) => ({ ...project, layers }), 'Deleted layer')
      return {
        ...next,
        state: {
          ...next.state,
          selection:
            state.selection.layerId === action.layerId ? { layerId: layers[0]?.id ?? null, shapeId: null } : state.selection,
        },
      }
    }

    case 'UPDATE_LAYER':
      return mutate(store, (project) => mapLayer(project, action.layerId, (l) => ({ ...l, ...action.patch })))

    case 'TOGGLE_ALL_LAYERS':
      return mutate(store, (project) => ({
        ...project,
        layers: project.layers.map((layer) => ({ ...layer, [action.key]: action.value })),
      }), `${action.value ? 'Enabled' : 'Disabled'} ${action.key} for all layers`)

    case 'REORDER_LAYER': {
      const index = p.layers.findIndex((l) => l.id === action.layerId)
      const target = index + (action.direction === 'up' ? 1 : -1)
      if (index < 0 || target < 0 || target >= p.layers.length) return store
      const layers = [...p.layers]
      const [moved] = layers.splice(index, 1)
      layers.splice(target, 0, moved)
      return mutate(store, (project) => ({ ...project, layers }), 'Reordered layer')
    }

    case 'DUPLICATE_LAYER': {
      const index = p.layers.findIndex((l) => l.id === action.layerId)
      if (index < 0) return store
      const source = p.layers[index]
      const copy: Layer = {
        ...source,
        id: uid('layer'),
        name: `${source.name} copy`,
        frames: source.frames.map((f) =>
          f
            ? {
                ...f,
                id: uid('kf'),
                shapes: cloneShapes(f.shapes).map((s) => ({ ...s, id: uid('shape') })),
                bones: cloneBones(f.bones),
              }
            : null,
        ),
      }
      const layers = [...p.layers]
      layers.splice(index + 1, 0, copy)
      return mutate(store, (project) => ({ ...project, layers }), 'Duplicated layer')
    }

    case 'INSERT_KEYFRAME': {
      const frame = action.frame ?? state.currentFrame
      return mutate(store, (project) => {
        const layerId = state.selection.layerId ?? project.layers[0]?.id
        const layer = project.layers.find((l) => l.id === layerId)
        if (!layer || layer.locked || frame < 0 || frame >= project.totalFrames) return project
        const idx = findKeyframeIndex(layer, frame)
        const previous = idx >= 0 ? layer.frames[idx] : null
        let nextStart = project.totalFrames
        for (let i = frame + 1; i < layer.frames.length; i++) {
          if (layer.frames[i]) { nextStart = i; break }
        }
        const shapes = action.blank ? [] : previous ? cloneShapes(previous.shapes) : []
        const bones = action.blank ? [] : previous ? cloneBones(previous.bones) : []
        const frames = [...layer.frames]
        // A blank keyframe ends the previous span just like a normal keyframe.
        if (previous && previous.start < frame) {
          frames[previous.start] = { ...previous, duration: frame - previous.start, tween: 'none' }
        }
        const keyframe = createKeyframe(frame, shapes, bones)
        keyframe.tween = action.blank ? 'none' : previous?.tween ?? 'none'
        keyframe.ease = previous?.ease ?? 0
        keyframe.duration = Math.max(1, nextStart - frame)
        frames[frame] = keyframe
        return mapLayer(project, layer.id, (l) => ({ ...l, frames }))
      }, `Inserted ${action.blank ? 'blank keyframe' : 'keyframe'} at ${frame + 1}`)
    }

    case 'REMOVE_KEYFRAME': {
      const frame = action.frame ?? state.currentFrame
      return mutate(store, (project) => {
        const layerId = state.selection.layerId ?? project.layers[0]?.id
        const layer = project.layers.find((l) => l.id === layerId)
        if (!layer || !layer.frames[frame] || frame === 0) return project
        const frames = [...layer.frames]
        frames[frame] = null
        let nextIdx = -1
        for (let i = frame + 1; i < frames.length; i++) if (frames[i]) { nextIdx = i; break }
        const prevIdx = findKeyframeIndex({ ...layer, frames }, frame - 1)
        if (prevIdx >= 0) {
          const prev = frames[prevIdx]!
          frames[prevIdx] = { ...prev, duration: Math.max(1, (nextIdx >= 0 ? nextIdx : project.totalFrames) - prev.start) }
        }
        return mapLayer(project, layer.id, (l) => ({ ...l, frames }))
      }, 'Removed keyframe')
    }

    case 'INSERT_FRAME': {
      const frame = action.frame ?? state.currentFrame
      return mutate(store, (project) => {
        if (frame >= project.totalFrames) return project
        const layers = project.layers.map((l) => {
          const newFrames: (Keyframe | null)[] = Array(project.totalFrames + 1).fill(null)
          for (let i = 0; i < l.frames.length; i++) {
            const to = i >= frame ? i + 1 : i
            const kf = l.frames[i]
            newFrames[to] = kf ? { ...kf, start: kf.start >= frame ? kf.start + 1 : kf.start, duration: kf.duration + (kf.start < frame && kf.start + kf.duration > frame ? 1 : 0) } : null
          }
          return { ...l, frames: newFrames }
        })
        return { ...project, totalFrames: project.totalFrames + 1, layers }
      }, `Inserted frame at ${frame + 1}`)
    }

    case 'REMOVE_FRAME': {
      const frame = action.frame ?? state.currentFrame
      return withClampedFrame(mutate(store, (project) => {
        if (project.totalFrames <= 1 || frame >= project.totalFrames) return project
        const layers = project.layers.map((l) => {
          const newFrames: (Keyframe | null)[] = Array(project.totalFrames - 1).fill(null)
          for (let i = 0; i < l.frames.length; i++) {
            if (i === frame) continue
            const to = i > frame ? i - 1 : i
            const kf = l.frames[i]
            newFrames[to] = kf
              ? { ...kf, start: kf.start > frame ? kf.start - 1 : kf.start, duration: Math.max(1, kf.duration - (kf.start < frame && kf.start + kf.duration > frame ? 1 : 0)) }
              : null
          }
          return { ...l, frames: newFrames }
        })
        return { ...project, totalFrames: project.totalFrames - 1, layers }
      }, `Removed frame at ${frame + 1}`))
    }

    case 'CLEAR_KEYFRAMES':
      return withClampedFrame(mutate(store, (project) => ({
        ...project,
        layers: project.layers.map((l) => {
          const frames = l.frames.map((f, i) => (i === 0 ? createKeyframe(0, f ? cloneShapes(f.shapes) : [], f ? cloneBones(f.bones) : []) : null))
          return { ...l, frames }
        }),
      }), 'Cleared keyframes'), true)

    case 'SET_KEYFRAME_TWEEN':
    case 'SET_KEYFRAME_EASE':
    case 'SET_KEYFRAME_LABEL':
      return mutate(store, (project) => {
        const layerId = state.selection.layerId ?? project.layers[0]?.id
        const layer = project.layers.find((l) => l.id === layerId)
        if (!layer) return project
        const idx = findKeyframeIndex(layer, state.currentFrame)
        if (idx < 0) return project
        const frames = [...layer.frames]
        const kf = frames[idx]!
        frames[idx] = {
          ...kf,
          ...(action.type === 'SET_KEYFRAME_TWEEN' ? { tween: action.tween } : {}),
          ...(action.type === 'SET_KEYFRAME_EASE' ? { ease: action.ease } : {}),
          ...(action.type === 'SET_KEYFRAME_LABEL' ? { label: action.label } : {}),
        }
        return mapLayer(project, layer.id, (l) => ({ ...l, frames }))
      })

    case 'SET_PROJECT_PROP':
      return withClampedFrame(mutate(store, (project) => {
        if (action.prop === 'totalFrames') {
          const total = Math.round(Math.max(1, Math.min(1000, Number(action.value) || 1)))
          return { ...resizeFrames(project, total), totalFrames: total }
        }
        if (action.prop === 'fps') {
          return { ...project, fps: Math.round(Math.max(1, Math.min(120, Number(action.value) || 24))) }
        }
        if (action.prop === 'width' || action.prop === 'height') {
          const size = Math.round(Math.max(1, Math.min(8192, Number(action.value) || 1)))
          return { ...project, [action.prop]: size }
        }
        return { ...project, [action.prop]: action.value }
      }))

    case 'LOAD_PROJECT': {
      const project = normalizeProject(action.project)
      void preloadProjectImages(project)
      addRecent(project)
      return {
        ...store,
        past: [],
        future: [],
        state: {
          ...state,
          screen: 'editor' as AppScreen,
          project,
          currentFrame: 0,
          selection: { layerId: project.layers[0]?.id ?? null, shapeId: null },
          statusMessage: `Opened ${project.name}`,
          dirty: false,
        },
      }
    }

    case 'NEW_PROJECT': {
      const project = createInitialProject()
      addRecent(project)
      return {
        ...store,
        past: [],
        future: [],
        state: {
          ...state,
          screen: 'editor' as AppScreen,
          project,
          currentFrame: 0,
          selection: { layerId: null, shapeId: null },
          statusMessage: 'New project',
          dirty: false,
        },
      }
    }

    case 'UNDO': {
      if (!store.past.length) return store
      const previous = store.past[store.past.length - 1]
      return {
        ...store,
        past: store.past.slice(0, -1),
        future: [p, ...store.future].slice(0, 100),
        state: { ...state, project: previous, statusMessage: 'Undo', dirty: true },
      }
    }

    case 'REDO': {
      if (!store.future.length) return store
      const next = store.future[0]
      return {
        ...store,
        past: [...store.past, p].slice(-100),
        future: store.future.slice(1),
        state: { ...state, project: next, statusMessage: 'Redo', dirty: true },
      }
    }

    default:
      return store
  }
}

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(reducer, { state: initialState, past: [], future: [], historyLocked: false, transformBase: null })
  const value = useMemo(() => ({ state: store.state, dispatch }), [store.state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
