import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { WindowControls } from './WindowControls'
import { openProjectFile, renderProjectFrame } from '../io'
import { getRecents, removeRecent, type RecentProject } from '../recents'
import { useStore } from '../store'
import { CANVAS_PRESETS, TEMPLATES, createTemplateProject, type CanvasPreset } from '../templates'

type Tab = 'home' | 'new' | 'open' | 'templates' | 'tutorials'

function TemplateThumb({ templateId, color }: { templateId: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const project = createTemplateProject(templateId)
    const frame = renderProjectFrame(project, Math.min(12, project.totalFrames - 1))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const scale = Math.min(canvas.width / project.width, canvas.height / project.height)
    const w = project.width * scale
    const h = project.height * scale
    ctx.drawImage(frame, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
  }, [templateId])
  return <div className="template-thumb" style={{ borderColor: color }}><canvas ref={ref} width={260} height={150} /></div>
}

export function HomeScreen() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [recents, setRecents] = useState<RecentProject[]>(() => getRecents())
  const [custom, setCustom] = useState({ width: 800, height: 600, fps: 24, frames: 72, name: 'My Animation' })
  const [templatePreset, setTemplatePreset] = useState<CanvasPreset | null>(() => {
    try {
      const saved = localStorage.getItem('animate.templatePreset')
      return saved ? JSON.parse(saved) as CanvasPreset : null
    } catch {
      return null
    }
  })

  useEffect(() => { setRecents(getRecents()) }, [state.screen])

  const create = (templateId: string, preset?: CanvasPreset, name?: string, background?: string) =>
    dispatch({ type: 'CREATE_PROJECT', templateId, preset, name, background })

  const rememberPreset = (preset: CanvasPreset | null) => {
    setTemplatePreset(preset)
    try {
      if (preset) localStorage.setItem('animate.templatePreset', JSON.stringify(preset))
      else localStorage.removeItem('animate.templatePreset')
    } catch { /* storage may be unavailable */ }
  }

  const choosePreset = (preset: CanvasPreset) => {
    rememberPreset(preset)
    create('blank', preset)
  }

  const openFile = () => openProjectFile((project) => {
    dispatch({ type: 'LOAD_PROJECT', project })
    setRecents(getRecents())
  })

  const nav: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'new', label: 'New Project', icon: 'plus' },
    { id: 'open', label: 'Open Project', icon: 'open' },
    { id: 'templates', label: 'Templates', icon: 'layers' },
    { id: 'tutorials', label: 'Learn & Guides', icon: 'book' },
  ]

  return (
    <div className="home-screen">
      <aside className="home-sidebar">
        <div className="home-brand"><Icon name="Adobe" size={24} /><span>Animate</span></div>
        <div className="home-nav-title">START</div>
        {nav.map((item) => (
          <button key={item.id} className={`home-nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            <Icon name={item.icon} size={16} /><span>{item.label}</span>
          </button>
        ))}
        <div className="home-sidebar-bottom">
          <button className="home-mode-card" onClick={() => dispatch({ type: 'SET_MODE', mode: state.mode === 'simple' ? 'pro' : 'simple' })}>
            <Icon name={state.mode === 'simple' ? 'beginner' : 'pro'} size={20} />
            <span><b>{state.mode === 'simple' ? 'Simple Mode' : 'Pro Mode'}</b><small>Switch editing style</small></span>
            <Icon name="arrowRight" size={13} />
          </button>
          <button className="home-nav-item" onClick={() => dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' })}>
            <Icon name={state.theme === 'dark' ? 'sun' : 'moon'} size={15} /><span>{state.theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </aside>

      <main className="home-main">
        <div className="home-topbar">
          <span className="home-crumb">Home / {nav.find((n) => n.id === tab)?.label}</span>
          <div className="home-topbar-actions">
            <button className="home-ghost-btn" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true })}><Icon name="help" size={14} /> Help & Guides</button>
            <WindowControls />
          </div>
        </div>

        <div className="home-scroll">
          {tab === 'home' && <>
            <section className="home-hero">
              <div className="home-hero-copy">
                <span className="home-eyebrow"><Icon name="sparkle" size={13} /> WELCOME TO ANIMATE</span>
                <h1>Make something that moves.</h1>
                <p>Draw with realistic brushes, rig characters with bones, tween between keyframes, and publish your animation — all in one place.</p>
                <div className="home-hero-actions">
                  <button className="home-primary-btn" onClick={() => create('blank')}><Icon name="plus" size={15} /> New Animation</button>
                  <button className="home-secondary-btn" onClick={openFile}><Icon name="open" size={15} /> Open Project</button>
                </div>
              </div>
              <div className="home-hero-art">
                <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                <div className="hero-badge"><Icon name="bone" size={26} /></div>
                <div className="hero-spark one"><Icon name="sparkle" size={16} /></div>
                <div className="hero-spark two"><Icon name="brush" size={18} /></div>
                <div className="hero-spark three"><Icon name="film" size={18} /></div>
              </div>
            </section>

            <div className="home-quick-grid">
              <button className="home-quick-card" onClick={() => create('blank')}>
                <span className="quick-icon blue"><Icon name="plus" size={20} /></span>
                <span><b>Blank document</b><small>550 × 400 · 24 fps</small></span>
                <Icon name="arrowRight" size={15} />
              </button>
              <button className="home-quick-card" onClick={() => create('stickman')}>
                <span className="quick-icon purple"><Icon name="bone" size={20} /></span>
                <span><b>Stick figure rig</b><small>Ready-to-pose bones</small></span>
                <Icon name="arrowRight" size={15} />
              </button>
              <button className="home-quick-card" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true })}>
                <span className="quick-icon green"><Icon name="book" size={20} /></span>
                <span><b>New here?</b><small>Start with a quick tutorial</small></span>
                <Icon name="arrowRight" size={15} />
              </button>
            </div>

            <section className="home-section">
              <div className="home-section-head"><h2>Canvas presets</h2><button onClick={() => setTab('new')}>View all <Icon name="arrowRight" size={12} /></button></div>
              <div className="preset-grid">
                {CANVAS_PRESETS.slice(0, 6).map((preset) => (
                  <button className="preset-card" key={preset.id} onClick={() => choosePreset(preset)}>
                    <Icon name={preset.icon} size={19} />
                    <b>{preset.name}</b>
                    <small>{preset.width} × {preset.height} · {preset.fps} fps</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="home-section">
              <div className="home-section-head"><h2>Start from a template</h2><button onClick={() => setTab('templates')}>View all <Icon name="arrowRight" size={12} /></button></div>
              <div className="template-grid">
                {TEMPLATES.filter((t) => t.id !== 'blank').slice(0, 3).map((template) => (
                  <button className="template-card" key={template.id} onClick={() => create(template.id, templatePreset ?? undefined)}>
                    <TemplateThumb templateId={template.id} color={template.accent} />
                    <div className="template-card-info"><b>{template.name}</b><small>{template.description}</small><span style={{ color: template.accent }}>{template.tag}</span></div>
                  </button>
                ))}
              </div>
            </section>

            {recents.length > 0 && <RecentSection recents={recents.slice(0, 4)} onOpen={(r) => {
              dispatch({ type: 'LOAD_PROJECT', project: JSON.parse(r.data) })
            }} onDelete={(id) => setRecents(removeRecent(id))} />}
          </>}

          {tab === 'new' && <>
            <div className="home-page-head"><h1>Create a new project</h1><p>Choose a canvas size to start with — you can change it later in Document properties.</p></div>
            <div className="preset-grid large">
              {CANVAS_PRESETS.map((preset) => (
                <button className="preset-card" key={preset.id} onClick={() => choosePreset(preset)}>
                  <Icon name={preset.icon} size={22} />
                  <b>{preset.name}</b>
                  <small>{preset.detail}</small>
                  <span>{preset.width} × {preset.height}</span>
                </button>
              ))}
            </div>
            <section className="home-section custom-section">
              <div className="home-section-head"><h2>Custom size</h2></div>
              <div className="custom-form">
                <label>Name<input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></label>
                <label>Width<input type="number" min="1" value={custom.width} onChange={(e) => setCustom({ ...custom, width: Number(e.target.value) })} /></label>
                <label>Height<input type="number" min="1" value={custom.height} onChange={(e) => setCustom({ ...custom, height: Number(e.target.value) })} /></label>
                <label>FPS<input type="number" min="1" max="60" value={custom.fps} onChange={(e) => setCustom({ ...custom, fps: Number(e.target.value) })} /></label>
                <label>Frames<input type="number" min="1" max="1000" value={custom.frames} onChange={(e) => setCustom({ ...custom, frames: Number(e.target.value) })} /></label>
                <button className="home-primary-btn" onClick={() => {
                  const preset: CanvasPreset = {
                    id: 'custom', name: 'Custom', detail: '', icon: 'film',
                    width: custom.width, height: custom.height, fps: custom.fps, frames: custom.frames, background: '#ffffff',
                  }
                  rememberPreset(preset)
                  create('blank', preset, custom.name || 'My Animation')
                }}>Create</button>
              </div>
            </section>
          </>}

          {tab === 'open' && <>
            <div className="home-page-head"><h1>Open a project</h1><p>Continue where you left off, or open a saved Animate JSON file.</p></div>
            <button className="home-primary-btn" onClick={openFile}><Icon name="open" size={15} /> Browse files…</button>
            <section className="home-section"><div className="home-section-head"><h2>Recent projects</h2></div>
              {recents.length ? <RecentSection recents={recents} onOpen={(r) => dispatch({ type: 'LOAD_PROJECT', project: JSON.parse(r.data) })} onDelete={(id) => setRecents(removeRecent(id))} /> : <div className="home-empty">No recent projects yet — create something and it will appear here.</div>}
            </section>
          </>}

          {tab === 'templates' && <>
            <div className="home-page-head"><h1>Templates</h1><p>Jump-start your animation with a ready-made scene you can edit freely.</p></div>
            <div className="template-canvas-picker">
              <label htmlFor="template-canvas">Canvas</label>
              <select
                id="template-canvas"
                className="template-canvas-select"
                value={templatePreset?.id ?? 'original'}
                onChange={(e) => {
                  const preset = CANVAS_PRESETS.find((p) => p.id === e.target.value)
                  rememberPreset(preset ?? null)
                }}
              >
                <option value="original">Template's original size</option>
                {CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} · {preset.width}×{preset.height}</option>)}
              </select>
              <small>Templates scale to the selected canvas.</small>
            </div>
            <div className="template-grid all">
              {TEMPLATES.map((template) => (
                <button className="template-card" key={template.id} onClick={() => create(template.id, template.id === 'blank' ? templatePreset ?? CANVAS_PRESETS[0] : templatePreset ?? undefined)}>
                  <TemplateThumb templateId={template.id} color={template.accent} />
                  <div className="template-card-info"><b>{template.name}</b><small>{template.description}</small><span style={{ color: template.accent }}>{template.tag} · {templatePreset ? `${templatePreset.width}×${templatePreset.height}` : `${template.width}×${template.height}`}</span></div>
                </button>
              ))}
            </div>
          </>}

          {tab === 'tutorials' && <>
            <div className="home-page-head"><h1>Learn & Guides</h1><p>Short, practical lessons that teach you the app as you go.</p></div>
            <div className="tutorial-grid">
              {[
                { icon: 'rocket', title: 'Your first animation', text: 'Draw a shape, add a keyframe, and watch it move.' },
                { icon: 'brush', title: 'Realistic brushes', text: 'Find 224 brushes and tune size, flow, and texture.' },
                { icon: 'bone', title: 'Stick figure rigging', text: 'Add bones and pose arms and legs without redrawing.' },
                { icon: 'onion', title: 'Smooth motion', text: 'Use onion skin and easing for natural movement.' },
                { icon: 'symbol', title: 'Symbols & library', text: 'Reuse artwork across your animation.' },
                { icon: 'export', title: 'Publishing', text: 'Export MP4, WebM, MKV, GIF, PNG sequences, HTML and more.' },
              ].map((item) => (
                <button className="tutorial-card" key={item.title} onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: true })}>
                  <Icon name={item.icon} size={22} /><b>{item.title}</b><small>{item.text}</small><span>Open guide <Icon name="arrowRight" size={12} /></span>
                </button>
              ))}
            </div>
          </>}
        </div>
      </main>
    </div>
  )
}

function RecentSection({ recents, onOpen, onDelete }: { recents: RecentProject[]; onOpen: (r: RecentProject) => void; onDelete: (id: string) => void }) {
  return (
    <div className="recent-list">
      {recents.map((item) => (
        <div className="recent-item" key={item.id}>
          <button className="recent-open" onClick={() => onOpen(item)}>
            <span className="recent-icon"><Icon name="film" size={17} /></span>
            <span className="recent-info"><b>{item.name}</b><small>{item.width} × {item.height} · {item.frames} frames · {new Date(item.savedAt).toLocaleDateString()}</small></span>
            <Icon name="arrowRight" size={14} />
          </button>
          <button className="recent-delete" title="Remove from recent" onClick={() => onDelete(item.id)}><Icon name="trash" size={13} /></button>
        </div>
      ))}
    </div>
  )
}
