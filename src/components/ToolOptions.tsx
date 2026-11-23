import { useEffect, useRef, useState } from 'react'
import { BRUSHES, BRUSH_FAMILIES, getBrush, renderBrushPreview, type BrushFamily } from '../brushes'
import { BoneOptions } from './BoneOptions'
import { Icon } from '../Icon'
import { useStore } from '../store'
import type { ToolSettings } from '../types'

function Slider({
  label, value, min, max, step = 1, suffix = '', onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="tool-opt-slider">
      <span className="tool-opt-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} title={`${label}: ${value}${suffix}`} />
      <span className="tool-opt-value">{step < 1 ? value.toFixed(2) : Math.round(value)}{suffix}</span>
    </label>
  )
}

export function ToolOptions() {
  const { state, dispatch } = useStore()
  const { tool, toolSettings: s } = state
  const [collapsed, setCollapsed] = useState(false)
  const [family, setFamily] = useState<BrushFamily>(getBrush(s.brushId).family)
  const [search, setSearch] = useState('')
  const previewRef = useRef<HTMLCanvasElement>(null)

  const activeBrush = getBrush(s.brushId)

  useEffect(() => {
    if (previewRef.current) renderBrushPreview(previewRef.current, activeBrush, state.strokeColor)
  }, [activeBrush, state.strokeColor])

  const set = (key: keyof ToolSettings, value: number | string | boolean) => dispatch({ type: 'SET_TOOL_SETTING', key, value })

  const brushTools = tool === 'pencil' || tool === 'brush'
  const shapeTool = ['rectangle', 'oval', 'rectPrimitive', 'ovalPrimitive', 'polyStar', 'line'].includes(tool)
  const options = brushTools
    ? <>
        <canvas ref={previewRef} className="brush-preview" width={92} height={30} title={activeBrush.name} />
        <div className="tool-opt-stack">
          <div className="tool-opt-row">
            <select className="tool-opt-select" value={family} onChange={(e) => setFamily(e.target.value as BrushFamily)} title="Brush family">
              {BRUSH_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              className="tool-opt-select brush-select"
              value={s.brushId}
              onChange={(e) => set('brushId', e.target.value)}
              title="Brush preset"
            >
              {BRUSHES.filter((b) => b.family === family && (!search || b.name.toLowerCase().includes(search.toLowerCase()))).map((b) => (
                <option key={b.id} value={b.id}>{b.name.replace(`${b.family} `, '')}</option>
              ))}
            </select>
            <input className="tool-opt-search" placeholder="Find brush…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="tool-opt-row">
            <Slider label="Size" value={s.brushSize} min={1} max={80} onChange={(v) => set('brushSize', v)} suffix="px" />
            <Slider label="Opacity" value={s.brushOpacity} min={0.05} max={1} step={0.05} onChange={(v) => set('brushOpacity', v)} suffix="" />
            <Slider label="Flow" value={s.flowScale} min={0.2} max={2} step={0.05} onChange={(v) => set('flowScale', v)} />
            <Slider label="Smooth" value={s.smoothing} min={0} max={1} step={0.05} onChange={(v) => set('smoothing', v)} />
            <Slider label="Spacing" value={s.spacingScale} min={0.3} max={2} step={0.05} onChange={(v) => set('spacingScale', v)} />
            <Slider label="Scatter" value={s.scatterScale} min={0} max={3} step={0.1} onChange={(v) => set('scatterScale', v)} />
          </div>
        </div>
        <span className="tool-opt-note" title={activeBrush.description}>{BRUSHES.length} brushes · {activeBrush.family}</span>
      </>
    : tool === 'eraser'
      ? <>
          <Icon name="eraser" size={20} />
          <Slider label="Eraser size" value={s.eraserSize} min={2} max={100} onChange={(v) => set('eraserSize', v)} suffix="px" />
          <span className="tool-opt-note">Drag across a stroke to erase part of it.</span>
        </>
      : shapeTool
        ? <>
            <label className="tool-opt-color"><span>Stroke</span><input type="color" value={state.strokeColor} onChange={(e) => dispatch({ type: 'SET_STROKE', color: e.target.value })} /></label>
            <label className="tool-opt-color"><span>Fill</span><input type="color" value={state.fillColor.startsWith('#') ? state.fillColor : '#ffffff'} onChange={(e) => dispatch({ type: 'SET_FILL', color: e.target.value })} /></label>
            <Slider label="Width" value={state.strokeWidth} min={0} max={30} onChange={(v) => dispatch({ type: 'SET_STROKE_WIDTH', width: v })} suffix="px" />
            {tool === 'rectPrimitive' && <Slider label="Corner" value={s.cornerRadius} min={0} max={60} onChange={(v) => set('cornerRadius', v)} suffix="px" />}
            {tool === 'polyStar' && <>
              <Slider label="Sides" value={s.starSides} min={3} max={20} onChange={(v) => set('starSides', v)} />
              <Slider label="Inner" value={s.starInnerRadius} min={0.1} max={0.9} step={0.05} onChange={(v) => set('starInnerRadius', v)} />
            </>}
            <span className="tool-opt-note">Hold Shift for perfect squares / straight lines.</span>
          </>
        : tool === 'text'
          ? <>
              <Icon name="text" size={18} />
              <select className="tool-opt-select" value={s.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>
                {['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'].map((f) => <option key={f}>{f}</option>)}
              </select>
              <Slider label="Font size" value={s.fontSize} min={8} max={120} onChange={(v) => set('fontSize', v)} suffix="px" />
              <button className={`tool-opt-toggle ${s.bold ? 'active' : ''}`} onClick={() => set('bold', !s.bold)}><b>B</b></button>
              <button className={`tool-opt-toggle ${s.italic ? 'active' : ''}`} onClick={() => set('italic', !s.italic)}><i>I</i></button>
              <label className="tool-opt-color"><span>Color</span><input type="color" value={state.fillColor.startsWith('#') ? state.fillColor : '#000000'} onChange={(e) => dispatch({ type: 'SET_FILL', color: e.target.value })} /></label>
            </>
          : tool === 'bone'
            ? <BoneOptions compact />
            : tool === 'selection'
              ? <>
                  <Icon name="selection" size={17} />
                  <div className="tool-opt-buttons">
                    <button title="Align left" onClick={() => dispatch({ type: 'STATUS', message: 'Use the Align panel for precise alignment' })}><Icon name="alignLeft" size={14} /></button>
                    <button title="Align center" onClick={() => dispatch({ type: 'STATUS', message: 'Use the Align panel for precise alignment' })}><Icon name="alignCenter" size={14} /></button>
                    <button title="Align right" onClick={() => dispatch({ type: 'STATUS', message: 'Use the Align panel for precise alignment' })}><Icon name="alignRight" size={14} /></button>
                  </div>
                  <span className="tool-opt-note">Drag shapes to move · drag handles to resize · arrows to nudge.</span>
                </>
              : <>
                  <Icon name="settings" size={17} />
                  <span className="tool-opt-note">{tool} tool — click or drag on the stage to use it.</span>
                </>

  return (
    <div className={`tool-options ${collapsed ? 'collapsed' : ''}`}>
      <button className="tool-opt-collapse" title={collapsed ? 'Show tool options' : 'Hide tool options'} onClick={() => setCollapsed(!collapsed)}>
        <Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size={12} />
      </button>
      <button className="tool-opt-close" title="Close tool settings (or right-click a tool to reopen)" onClick={() => dispatch({ type: 'SET_TOOL_OPTIONS_OPEN', open: false })}>×</button>
      {!collapsed && <div className="tool-options-inner"><span className="tool-opt-title">{tool}</span>{options}</div>}
    </div>
  )
}
