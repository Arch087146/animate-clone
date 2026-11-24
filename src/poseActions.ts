import type { Action } from './store'

type PoseDispatch = (action: Action) => void

/** Faster poses leave fewer frames between keyframes, so the rig moves quicker. */
export const poseStepFrames = (speed: number) =>
  Math.max(2, Math.round(12 / Math.max(0.25, speed || 1)))

/** Insert a motion pose keyframe and move the playhead to the next pose position. */
export function addPose(options: {
  dispatch: PoseDispatch
  currentFrame: number
  totalFrames: number
  speed: number
}) {
  const { dispatch, currentFrame, totalFrames, speed } = options
  dispatch({ type: 'INSERT_KEYFRAME' })
  dispatch({ type: 'SET_KEYFRAME_TWEEN', tween: 'motion' })

  const next = Math.min(Math.max(0, totalFrames - 1), currentFrame + poseStepFrames(speed))
  if (next !== currentFrame) dispatch({ type: 'SET_CURRENT_FRAME', frame: next })
  dispatch({ type: 'STATUS', message: `Pose added · next at frame ${next + 1}` })
  return next
}
