import { useStore } from '../store'
import type { Bone } from '../types'
import { getActiveKeyframe } from '../utils'
import { Icon } from '../Icon'

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="bone-num">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/** Animate-style bone properties, shared by the tool options bar and Properties panel. */
export function BoneOptions({ embedded = false, compact = false }: { embedded?: boolean; compact?: boolean }) {
  const { state, dispatch } = useStore()
  const { project, currentFrame, selection } = state
  const layer = project.layers.find((l) => l.id === selection.layerId) ?? project.layers[0]
  const kf = layer ? getActiveKeyframe(layer, currentFrame) : null
  const bones = kf?.bones ?? []
  const bone: Bone | undefined = bones.find((b) => b.id === selection.boneId)
  const shapeCount = bone ? (kf?.shapes ?? []).filter((s) => s.boneId === bone.id).length : 0

  const set = (patch: Partial<Bone>) => {
    if (bone) dispatch({ type: 'SET_BONE_PROP', boneId: bone.id, patch })
  }
  const addPose = () => {
    dispatch({ type: 'INSERT_KEYFRAME' })
    dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' })
    dispatch({ type: 'STATUS', message: 'Pose keyframe added' })
  }

  if (compact) {
    return (
      <>
        <Icon name="bone" size={18} />
        <label className="tool-opt-check"><input type="checkbox" checked={state.showBones} onChange={() => dispatch({ type: 'TOGGLE', key: 'showBones' })} /> Show bones</label>
        <button className="bone-quick" onClick={addPose}><Icon name="plus" size={13} /> Add pose</button>
        <button className="bone-quick" onClick={() => dispatch({ type: 'BIND_SHAPES_TO_BONES' })}><Icon name="layers" size={13} /> Bind artwork</button>
        <span className="tool-opt-note">
          {bone ? `${bone.name} · full rig controls in Properties` : 'Drag to draw · tail joint adds a child · Alt for free bone'}
        </span>
      </>
    )
  }

  return (
    <div className={`bone-options ${embedded ? 'embedded' : ''}`}>
      <div className="bone-options-toolbar">
        <button className={`bone-quick ${state.tool === 'bone' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_TOOL', tool: 'bone' })}>
          <Icon name="bone" size={14} /> Bone tool
        </button>
        <button className="bone-quick" onClick={addPose}><Icon name="plus" size={13} /> Add pose</button>
        <button className="bone-quick" onClick={() => dispatch({ type: 'BIND_SHAPES_TO_BONES' })}><Icon name="layers" size={13} /> Bind artwork</button>
        <label className="bone-quick check"><input type="checkbox" checked={state.showBones} onChange={() => dispatch({ type: 'TOGGLE', key: 'showBones' })} /> Show bones</label>
      </div>

      {!bone ? (
        <div className="bone-empty">
          <Icon name="bone" size={22} />
          <div>
            <b>Draw a skeleton</b>
            <p>Drag on the stage to make a bone. Drag from a bone's tail joint to chain a child. Hold <kbd>Alt</kbd> for a free bone.</p>
          </div>
        </div>
      ) : (
        <div className="bone-editor">
          <div className="bone-editor-head">
            <span className="bone-swatch" />
            <input value={bone.name} onChange={(e) => set({ name: e.target.value })} />
            <span className="bone-meta">
              {Math.round(Math.hypot(bone.x2 - bone.x1, bone.y2 - bone.y1))} px ·{' '}
              {Math.round((Math.atan2(bone.y2 - bone.y1, bone.x2 - bone.x1) * 180) / Math.PI)}°
            </span>
          </div>

          <div className="bone-editor-grid">
            <div className="bone-group">
              <div className="bone-group-title">Joint</div>
              <label className="bone-check"><input type="checkbox" checked={bone.connected !== false} onChange={(e) => set({ connected: e.target.checked })} /> Connected to parent</label>
              <label className="bone-check"><input type="checkbox" checked={!!bone.locked} onChange={(e) => set({ locked: e.target.checked })} /> Lock bone</label>
              <div className="bone-hint">Tail joint → chain child · head → move · body → rotate · <kbd>Shift</kbd> snaps 15°</div>
            </div>

            <div className="bone-group">
              <div className="bone-group-title">Rotation constraint</div>
              <label className="bone-check"><input type="checkbox" checked={!!bone.rotationEnabled} onChange={(e) => set({ rotationEnabled: e.target.checked })} /> Enable limits</label>
              <div className="bone-num-row">
                <NumberField label="Min" value={bone.rotationMin ?? -90} min={-360} max={0} onChange={(v) => set({ rotationMin: v, rotationEnabled: true })} />
                <NumberField label="Max" value={bone.rotationMax ?? 90} min={0} max={360} onChange={(v) => set({ rotationMax: v, rotationEnabled: true })} />
              </div>
              <label className="bone-range"><span>Ease</span><input type="range" min={-1} max={1} step={0.1} value={bone.ease ?? 0} onChange={(e) => set({ ease: Number(e.target.value) })} /></label>
            </div>

            <div className="bone-group">
              <div className="bone-group-title">Translation constraint</div>
              <label className="bone-check"><input type="checkbox" checked={!!bone.translateXEnabled} onChange={(e) => set({ translateXEnabled: e.target.checked })} /> Limit X</label>
              <div className="bone-num-row">
                <NumberField label="Min" value={bone.translateXMin ?? -100} min={-project.width} max={0} onChange={(v) => set({ translateXMin: v, translateXEnabled: true })} />
                <NumberField label="Max" value={bone.translateXMax ?? 100} min={0} max={project.width} onChange={(v) => set({ translateXMax: v, translateXEnabled: true })} />
              </div>
              <label className="bone-check"><input type="checkbox" checked={!!bone.translateYEnabled} onChange={(e) => set({ translateYEnabled: e.target.checked })} /> Limit Y</label>
              <div className="bone-num-row">
                <NumberField label="Min" value={bone.translateYMin ?? -100} min={-project.height} max={0} onChange={(v) => set({ translateYMin: v, translateYEnabled: true })} />
                <NumberField label="Max" value={bone.translateYMax ?? 100} min={0} max={project.height} onChange={(v) => set({ translateYMax: v, translateYEnabled: true })} />
              </div>
            </div>
          </div>

          <div className="bone-editor-actions">
            <button disabled={!selection.shapeId} onClick={() => selection.shapeId && dispatch({ type: 'ATTACH_SHAPE', shapeId: selection.shapeId, boneId: bone.id })}>
              <Icon name="link" size={12} /> Attach selected shape
            </button>
            <button onClick={() => dispatch({ type: 'BIND_SHAPES_TO_BONES' })}>Auto-bind artwork</button>
            <button className="danger" onClick={() => dispatch({ type: 'DELETE_BONE', boneId: bone.id })}><Icon name="trash" size={12} /> Delete</button>
            <span className="bone-attached">{shapeCount} bound shape{shapeCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
