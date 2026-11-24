import { useState } from 'react'
import { Icon } from '../Icon'
import { useStore } from '../store'

interface Tutorial {
  id: string
  title: string
  icon: string
  time: string
  level: string
  intro: string
  steps: string[]
  tip: string
  try?: 'stickman' | 'bouncing' | 'blank' | 'logo'
  tool?: 'pencil' | 'brush' | 'bone' | 'selection'
}

const TUTORIALS: Tutorial[] = [
  {
    id: 'first', title: 'Your first animation', icon: 'rocket', time: '3 min', level: 'Beginner',
    intro: 'Make a shape move across the stage using two keyframes and a motion tween.',
    steps: [
      'Choose “New Animation” on the home screen to open a blank document.',
      'Pick the Oval tool from the toolbar and drag on the stage to draw a ball.',
      'In the timeline, click frame 1, then press F6 to add a keyframe at frame 20.',
      'Move the ball to a new position with the Selection tool.',
      'Select frame 1, choose Motion Tween in the Properties panel, then press Enter to play.',
    ],
    tip: 'Turn on the onion skin button above the stage to see where your shape was in the previous frames.',
    try: 'blank',
  },
  {
    id: 'brushes', title: 'Draw with 37 CC0 Krita brushes', icon: 'brush', time: '4 min', level: 'Beginner',
    intro: 'The pencil and brush tools use presets from David Revoy’s CC0 Krita brush bundle.',
    steps: [
      'Select the Pencil (Y) or Brush (B) tool. The options bar appears under the stage toolbar.',
      'Click the brush preview to open the preset picker, then choose a category: Lineart, Essentials, Glazing, Textured, Water or Effects.',
      'Pick a preset from the grid and watch the live preview change.',
      'Set Size, Opacity, Flow, Spacing and Scatter with the sliders.',
      'Drag on the stage. Strokes keep their brush settings when you save and reopen the project.',
    ],
    tip: 'Use the Smooth slider to clean up shaky freehand lines without changing your drawing style.',
    try: 'blank', tool: 'brush',
  },
  {
    id: 'bones', title: 'Stick figure rigging with bones', icon: 'bone', time: '5 min', level: 'Intermediate',
    intro: 'Add a skeleton to a stick figure so you can pose limbs instead of redrawing them.',
    steps: [
      'Open the “Stick Figure Rig” template — it already has a skeleton attached to the artwork.',
      'Select the Bone tool (M) and drag a joint of a leg or arm to rotate it. Children follow automatically.',
      'To create a new bone, drag from the end of an existing bone — it becomes a child.',
      'Select a shape and a bone, then use Attach in the Bone properties section to bind them.',
      'Add a keyframe later in the timeline and pose the rig again to animate the movement.',
    ],
    tip: 'Press F6 to add a pose keyframe. The armature interpolates between poses on a motion tween.',
    try: 'stickman', tool: 'bone',
  },
  {
    id: 'onion', title: 'Smooth motion with onion skin', icon: 'onion', time: '3 min', level: 'Beginner',
    intro: 'Onion skin shows nearby frames so you can draw natural in-betweens.',
    steps: [
      'Click the onion skin icon above the stage to turn it on.',
      'Set how many frames to show and their opacity in the Onion Skin properties section.',
      'Red Previous frames appear before the playhead; green Next frames appear after it.',
      'Draw or reposition your shape between the ghost images.',
    ],
    tip: 'Combine onion skin with the Smooth brush setting for clean frame-by-frame animation.',
    try: 'bouncing',
  },
  {
    id: 'symbols', title: 'Symbols and the Library', icon: 'symbol', time: '3 min', level: 'Intermediate',
    intro: 'Turn artwork into reusable symbols and place instances anywhere on the stage.',
    steps: [
      'Draw a shape and select it with the Selection tool.',
      'Press F8 (or choose Modify → Convert to Symbol) to create a Graphic symbol.',
      'Open the Library panel and double-click a symbol to place a copy on the stage.',
      'Delete a symbol from the Library with the × button on its row.',
    ],
    tip: 'Symbols are saved inside the project file, so they travel with your animation.',
  },
  {
    id: 'publish', title: 'Export and publish', icon: 'export', time: '3 min', level: 'Beginner',
    intro: 'Share your animation as MP4, WebM, MKV, GIF, an image sequence, or a self-contained HTML page.',
    steps: [
      'Click Export in the top-right (or press Ctrl+Shift+E) to open Publish Settings.',
      'Pick a format: MP4 for sharing, WebM for the web, MKV for editing, GIF or APNG for looping art, or PNG sequence for compositing.',
      'Set quality, scale and frame rate, then click Export and choose where to save the file.',
      'File → Save (Ctrl+S) writes the full project as JSON you can reopen later.',
      'The Publish button runs the quick HTML export directly.',
    ],
    tip: 'Video exports use the exact stage size and frame rate set in Document properties. MKV, MOV and AVI require the bundled encoder.',
  },
  {
    id: 'simple', title: 'Simple Mode for beginners', icon: 'beginner', time: '2 min', level: 'Beginner',
    intro: 'Simple Mode hides the advanced panels and gives you big, friendly controls.',
    steps: [
      'Use the mode button on the home screen, or the “Pro Mode / Simple Mode” button in the editor.',
      'Pick a tool from the big buttons on the left: Select, Draw, Fill, Text, Erase, or Bones.',
      'Choose a brush from the friendly chips and drag on the stage.',
      'Use “+ Add pose” in the bottom bar to make the next keyframe, then press Play.',
      'Switch back to Pro Mode whenever you want the full timeline and panels.',
    ],
    tip: '“Make it move” on a selected shape adds a motion tween automatically.',
  },
  {
    id: 'shortcuts', title: 'Keyboard shortcuts', icon: 'help', time: 'Reference', level: 'All',
    intro: 'Work faster with the shortcuts used throughout the app.',
    steps: [
      'Tools: V select · A subselect · L lasso · P pen · T text · N line · R rectangle · O oval · Y pencil · B brush · E eraser · S ink bottle · K paint bucket · I eyedropper · H hand · Z zoom · M bones.',
      'Timeline: F5 insert frame · F6 keyframe · F7 blank keyframe · F8 convert to symbol · Enter play/pause.',
      'Editing: Ctrl+Z undo · Ctrl+Shift+Z redo · Ctrl+C copy · Ctrl+V paste · Ctrl+D duplicate · Delete remove.',
      'View: Ctrl+S save · Ctrl+O open · Ctrl+Enter publish · Ctrl++ / Ctrl+- zoom · Esc deselect.',
    ],
    tip: 'Hold Shift while drawing rectangles or lines to constrain to perfect squares and 45° angles.',
  },
]

export function Tutorials() {
  const { state, dispatch } = useStore()
  const [active, setActive] = useState(TUTORIALS[0].id)
  const tutorial = TUTORIALS.find((t) => t.id === active) ?? TUTORIALS[0]

  if (!state.showTutorials) return null

  const tryIt = () => {
    if (tutorial.try) dispatch({ type: 'CREATE_PROJECT', templateId: tutorial.try })
    if (tutorial.tool && ['pencil', 'brush', 'bone', 'selection'].includes(tutorial.tool)) {
      dispatch({ type: 'SET_TOOL', tool: tutorial.tool as 'pencil' | 'brush' | 'bone' | 'selection' })
    }
    dispatch({ type: 'SET_TUTORIALS_OPEN', open: false })
  }

  return (
    <div className="tutorial-overlay" onMouseDown={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: false })}>
      <div className="tutorial-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tutorial-sidebar">
          <div className="tutorial-sidebar-head"><Icon name="book" size={18} /><span>Tutorials & Guides</span></div>
          <div className="tutorial-sidebar-list">
            {TUTORIALS.map((item) => (
              <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)}>
                <Icon name={item.icon} size={15} />
                <span><b>{item.title}</b><small>{item.level} · {item.time}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="tutorial-content">
          <button className="tutorial-close" title="Close" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: false })}>×</button>
          <div className="tutorial-heading">
            <span className="tutorial-level">{tutorial.level}</span>
            <h1>{tutorial.title}</h1>
            <p>{tutorial.intro}</p>
          </div>
          <ol className="tutorial-steps">
            {tutorial.steps.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}
          </ol>
          <div className="tutorial-tip"><Icon name="lightbulb" size={15} /><span><b>Pro tip:</b> {tutorial.tip}</span></div>
          <div className="tutorial-actions">
            {tutorial.try && <button className="home-primary-btn" onClick={tryIt}><Icon name="rocket" size={14} /> Try it now</button>}
            <button className="home-secondary-btn" onClick={() => dispatch({ type: 'SET_TUTORIALS_OPEN', open: false })}>Back to Animate</button>
          </div>
        </div>
      </div>
    </div>
  )
}
