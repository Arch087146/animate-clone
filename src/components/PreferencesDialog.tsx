import { useEffect } from 'react'
import { Icon } from '../Icon'
import { useStore } from '../store'

/** Animate-style Preferences dialog for the settings people change most. */
export function PreferencesDialog() {
  const { state, dispatch } = useStore()
  const { showPreferences } = state

  const close = () => dispatch({ type: 'SET_PREFERENCES_OPEN', open: false })

  useEffect(() => {
    if (!showPreferences) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPreferences])

  if (!showPreferences) return null

  const toggle = (key: 'loop' | 'onionSkin' | 'showRulers' | 'showGrid' | 'snapToGrid' | 'showBones' | 'onionKeyframesOnly' | 'showTimeline', label: string, hint: string) => (
    <label className="preference-row pref-toggle">
      <input type="checkbox" data-label={label} checked={state[key]} onChange={() => dispatch({ type: 'TOGGLE', key })} />
      <span><b>{label}</b><small>{hint}</small></span>
    </label>
  )

  return (
    <div className="modal-backdrop preferences-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="preferences-modal" role="dialog" aria-label="Preferences">
        <div className="publish-titlebar">
          <Icon name="sliders" size={15} />
          <span>Preferences</span>
          <button title="Close" onClick={close}><Icon name="close" size={13} /></button>
        </div>

        <div className="preferences-body">
          <div className="preferences-section">
            <div className="panel-subhead">Appearance</div>
            <div className="preference-row">
              <label>Theme</label>
              <div className="pref-segment">
                {(['dark', 'light'] as const).map((theme) => (
                  <button key={theme} data-label={`${theme} theme`} className={state.theme === theme ? 'active' : ''}
                    onClick={() => dispatch({ type: 'SET_THEME', theme })}>
                    <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={13} /> {theme === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>
            <div className="preference-row">
              <label>Interface</label>
              <div className="pref-segment">
                {(['simple', 'pro'] as const).map((mode) => (
                  <button key={mode} data-label={`${mode} mode`} className={state.mode === mode ? 'active' : ''}
                    onClick={() => dispatch({ type: 'SET_MODE', mode })}>
                    <Icon name={mode === 'simple' ? 'beginner' : 'pro'} size={13} /> {mode === 'simple' ? 'Simple' : 'Pro'}
                  </button>
                ))}
              </div>
            </div>
            {toggle('showTimeline', 'Show Timeline', 'Dock the timeline at the bottom of the editor.')}
          </div>

          <div className="preferences-section">
            <div className="panel-subhead">Stage</div>
            {toggle('showRulers', 'Show Rulers', 'Display rulers along the top and left edges.')}
            {toggle('showGrid', 'Show Grid', 'Overlay a 20 px grid on the stage.')}
            {toggle('snapToGrid', 'Snap to Grid', 'Align shapes to grid intersections while drawing.')}
            {toggle('showBones', 'Show Bones', 'Display the armature overlay on the stage.')}
            <div className="preference-row">
              <label htmlFor="pref-fps">Frame rate</label>
              <input id="pref-fps" type="number" min="1" max="60" value={state.project.fps}
                onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'fps', value: Math.max(1, Math.min(60, Number(e.target.value))) })} />
              <span>fps</span>
            </div>
            <div className="preference-row">
              <label htmlFor="pref-frames">Timeline length</label>
              <input id="pref-frames" type="number" min="1" max="1000" value={state.project.totalFrames}
                onChange={(e) => dispatch({ type: 'SET_PROJECT_PROP', prop: 'totalFrames', value: Number(e.target.value) })} />
              <span>frames</span>
            </div>
          </div>

          <div className="preferences-section">
            <div className="panel-subhead">Timeline &amp; Playback</div>
            {toggle('loop', 'Loop Playback', 'Restart automatically when playback reaches the end.')}
            {toggle('onionSkin', 'Onion Skin', 'Show ghosted nearby frames behind the current frame.')}
            {toggle('onionKeyframesOnly', 'Keyframes Only', 'Ghost only real keyframes instead of every frame.')}
            <div className="preference-row">
              <label htmlFor="pref-onion-range">Onion range</label>
              <input id="pref-onion-range" type="range" min="0" max="5" value={state.onionRange}
                onChange={(e) => dispatch({ type: 'SET_ONION_RANGE', range: Number(e.target.value) })} />
              <span>{state.onionRange}</span>
            </div>
            <div className="preference-row">
              <label htmlFor="pref-onion-opacity">Ghost opacity</label>
              <input id="pref-onion-opacity" type="range" min="0.02" max="0.8" step="0.02" value={state.onionOpacity}
                onChange={(e) => dispatch({ type: 'SET_ONION_OPACITY', opacity: Number(e.target.value) })} />
              <span>{Math.round(state.onionOpacity * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="publish-footer">
          <button className="wide-btn pref-reset" onClick={() => {
            dispatch({ type: 'SET_THEME', theme: 'dark' })
            dispatch({ type: 'SET_MODE', mode: 'pro' })
            if (!state.showTimeline) dispatch({ type: 'TOGGLE', key: 'showTimeline' })
            if (!state.showRulers) dispatch({ type: 'TOGGLE', key: 'showRulers' })
            if (!state.showBones) dispatch({ type: 'TOGGLE', key: 'showBones' })
            if (state.showGrid) dispatch({ type: 'TOGGLE', key: 'showGrid' })
            if (state.snapToGrid) dispatch({ type: 'TOGGLE', key: 'snapToGrid' })
            if (!state.loop) dispatch({ type: 'TOGGLE', key: 'loop' })
            if (state.onionSkin) dispatch({ type: 'TOGGLE', key: 'onionSkin' })
            if (state.onionKeyframesOnly) dispatch({ type: 'TOGGLE', key: 'onionKeyframesOnly' })
            dispatch({ type: 'SET_ONION_RANGE', range: 2 })
            dispatch({ type: 'SET_ONION_OPACITY', opacity: 0.16 })
            dispatch({ type: 'STATUS', message: 'Preferences reset to defaults' })
          }}>Reset to defaults</button>
          <div>
            <button className="publish-cancel" onClick={close}>Cancel</button>
            <button className="publish-export" onClick={close}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
