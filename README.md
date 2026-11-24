# Animate — Desktop App

A Windows desktop recreation of Adobe Animate's interface and animation workflow, built with React + Electron. It ships as a real app window — no browser chrome, no web server required.

## Run the app

- **Portable (no install):** `release\Animate-Portable.exe`
- **Installer:** `release\Animate Setup 1.0.0.exe`

The installer creates Start Menu and Desktop shortcuts.

## Development

```bash
npm install
node node_modules/electron/install.js   # needed if install scripts are blocked
npm run start        # launch the desktop app from source
npm run build        # typecheck + production bundle
npm run dist         # rebuild and repackage into release/
```

## What's included

### Workspace
- Native app window with custom dark title bar and window controls
- Animate-style menu bar, document tab, narrow tool rail, stage with rulers, properties panel, docked timeline
- Dark theme by default (toggle in the title bar); layout and theme are remembered
- **Home screen** with recent projects, six canvas presets, three project templates, a New Animation flow and a guides/tutorials library
- **Simple Mode** — a beginner-friendly workspace with large tool buttons, brush chips, color swatches and a live “How to…” hint for the active tool
- **Pro Mode** — the full Animate-like editing workspace
- **Preferences** (`Ctrl+U`) for theme, interface mode, stage display, onion skinning and playback defaults
- Window menu can show/hide the docked Timeline; workspace presets switch panels and mode

### Drawing & tools
- 20 tools: selection, subselection, lasso, pen, text, line, rectangle/oval, primitives, poly-star, pencil, brush, eraser, ink bottle, paint bucket, eyedropper, hand, zoom and **bone**
- **37 CC0 brush presets** imported from David Revoy’s Krita 2025-01 bundle, with 22 real grayscale tip images. Krita-style picker with categories, search and live previews plus adjustable size, opacity, flow, spacing, scatter and smoothing. Attribution is in `NOTICE.md`.
- Contextual tool options bar with full per-tool settings
- Font family, size, bold/italic controls for text
- Real eraser dragging, pen paths, lasso selection, eyedropper color picking

### Animation
- Layers, frames, keyframes, blank keyframes, frame spans, labels, playback, FPS, looping
- Onion skinning with adjustable range and opacity, including **keyframes-only** ghosting
- Motion and shape tweens with easing, plus a Motion Presets panel with one-click easing styles
- Properties, Library, Color, Swatches, Align, Info, Transform, Document, Publish, Motion Presets, Debug and About panels
- Library search, real symbol creation/folders, double-click placement, shape search/filtering
- Transform panel with relative scaling, rotation and working horizontal/vertical flips
- Break Apart turns text, primitives and images into editable paths; Share copies project JSON to the clipboard
- New/Open/Save (JSON), real image import to Stage or Library, undo/redo, keyboard shortcuts

### Publish & export
- Animate-style **Publish Settings** dialog (`Ctrl+Shift+E` or the Export button)
- Real video output through the bundled FFmpeg encoder: **MP4 (H.264), WebM (VP9), MKV, QuickTime MOV, AVI**
- Animation image output: **Animated GIF, Animated PNG, PNG image sequence**, and **sprite sheet + JSON atlas**
- Document output: self-contained animated **HTML** and editable project **JSON**
- Quality, scale, frame rate, loop count and optional bone-overlay controls; live progress while encoding
- Browser preview falls back to `MediaRecorder` when running outside Electron

### Bone rigging (armature / IK)
- Draw bones on the stage; drag from a bone's **tail joint** to chain connected children, or hold **Alt** to create a free (unconnected) bone
- Grab a bone's **head joint** to translate it, or its **body** to rotate it; connected children and bound artwork follow. **Shift** snaps rotation to 15° increments
- Bones can also be posed with the Selection tool, just like Animate
- Animate-style Bone properties panel: name, length, angle, connected/locked state, rotation limits, X/Y translation limits, per-bone easing
- Bind artwork to bones automatically (nearest-bone assignment) or attach the selected shape manually
- Add pose keyframes from the tool bar, Properties panel or timeline; pose keyframes and armature layers get distinct visuals in the timeline
- Rig poses interpolate between keyframes with per-bone easing

### Keyboard shortcuts
| Key | Action |
| --- | --- |
| `V` / `A` | Selection / Subselection |
| `Y` / `B` | Pencil / Brush |
| `R` / `O` | Rectangle / Oval |
| `M` | Bone tool |
| `E` | Eraser |
| `F5` / `F6` / `F7` | Insert frame / keyframe / blank keyframe |
| `F8` | Convert selected shape to a symbol |
| `Enter` | Play / stop |
| `Ctrl+N` | New project |
| `Ctrl+S` | Save project JSON |
| `Ctrl+O` | Open project JSON |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / cut / paste shape |
| `Ctrl+D` | Duplicate shape |
| `Ctrl+B` | Break apart selection |
| `Ctrl+U` | Preferences |
| `Ctrl+Shift+E` | Publish Settings / video export |
| `Ctrl+Shift+M` | Toggle Simple / Pro mode |
| `Ctrl+Shift+H` | Home screen |
| `Ctrl+Shift+G` | Tutorials & guides |
