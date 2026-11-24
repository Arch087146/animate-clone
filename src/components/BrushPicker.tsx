import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BRUSHES,
  BRUSH_CATEGORIES,
  brushCategory,
  matchesBrushQuery,
  renderBrushPreview,
  type BrushPreset,
} from '../brushes'
import { Icon } from '../Icon'

const ALL = 'All brushes'

export interface BrushPickerPosition {
  top: number
  left: number
  width: number
  height: number
}

function shortName(brush: BrushPreset) {
  return brush.name.replace(/^Krita CC0 · /, '').replace(/^CC0 /, '')
}

function BrushTile({
  brush,
  color,
  active,
  onPick,
}: {
  brush: BrushPreset
  color: string
  active: boolean
  onPick: (id: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) renderBrushPreview(canvasRef.current, brush, color)
  }, [brush, color])

  return (
    <button
      className={`brush-tile ${active ? 'selected' : ''}`}
      data-active={active ? 'true' : undefined}
      title={brush.name}
      onClick={() => onPick(brush.id)}
    >
      <span className="brush-tile-preview">
        <canvas ref={canvasRef} width={150} height={46} />
        {brush.params.stampImage
          ? <img className="brush-tip-image" src={brush.params.stampImage} alt="" />
          : <span className="brush-tip-image brush-tip-fallback">{brush.params.cleanStroke ? '✎' : 'S'}</span>}
      </span>
      <span className="brush-tile-name">{shortName(brush)}</span>
      <span className="brush-tile-meta">{brushCategory(brush)}</span>
    </button>
  )
}

export function BrushPicker({
  activeBrush,
  color,
  dark,
  position,
  onPick,
  onClose,
}: {
  activeBrush: BrushPreset
  color: string
  dark: boolean
  position: BrushPickerPosition
  onPick: (id: string) => void
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState(() => brushCategory(activeBrush))
  const [query, setQuery] = useState('')

  // Search is global by default: typing "pen" should not be trapped in Water.
  const matched = useMemo(() => BRUSHES.filter((brush) => matchesBrushQuery(brush, query)), [query])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const brush of matched) {
      const name = brushCategory(brush)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    const ordered: string[] = BRUSH_CATEGORIES.filter((name) => counts.has(name))
    const extras = [...counts.keys()].filter((name) => !ordered.includes(name)).sort()
    return [
      { name: ALL, count: matched.length },
      ...ordered.map((name) => ({ name, count: counts.get(name) ?? 0 })),
      ...extras.map((name) => ({ name, count: counts.get(name) ?? 0 })),
    ]
  }, [matched])

  const visible = useMemo(() => (
    category === ALL ? matched : matched.filter((brush) => brushCategory(brush) === category)
  ), [matched, category])

  const stats = useMemo(() => ({
    krita: BRUSHES.filter((brush) => brush.family === 'Krita CC0').length,
    gimp: BRUSHES.filter((brush) => brush.family === 'CC0').length,
    builtin: BRUSHES.filter((brush) => brush.family === 'Built-in').length,
    tips: new Set(BRUSHES.map((brush) => brush.params.stampImage).filter(Boolean)).size,
  }), [])

  const resetFilters = () => {
    setQuery('')
    setCategory(ALL)
  }

  const updateQuery = (value: string) => {
    setQuery(value)
    if (value.trim()) setCategory(ALL)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeBrush.id, category, query])

  return createPortal(
    <>
      <div className="brush-picker-backdrop" onMouseDown={onClose} />
      <div
        className={`brush-picker ${dark ? 'dark' : ''}`}
        ref={rootRef}
        style={position}
        role="dialog"
        aria-label="Brush presets"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="brush-picker-header">
          <span className="brush-picker-heading"><Icon name="brush" size={16} /> Brush presets</span>
          <input
            className="brush-picker-search"
            placeholder="Search pens, pencils, brushes…"
            aria-label="Search brush presets"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            autoFocus
            spellCheck={false}
          />
          <button className="brush-picker-close" title="Close brush presets" onClick={onClose}>
            <Icon name="close" size={12} />
          </button>
        </div>

        <div className="brush-picker-categories">
          {categories.map((item) => (
            <button
              key={item.name}
              className={`brush-picker-category ${category === item.name ? 'active' : ''}`}
              onClick={() => setCategory(item.name)}
            >
              <span>{item.name}</span>
              <span className="brush-picker-count">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="brush-picker-main">
          <div className="brush-picker-toolbar">
            <strong>{query.trim() ? 'Search results' : category}</strong>
            <span>{visible.length} shown</span>
            {query.trim() && <span className="brush-picker-hint">all categories</span>}
            {(query.trim() || category !== ALL) && (
              <button className="brush-picker-reset" onClick={resetFilters}>Reset</button>
            )}
            <span className="brush-picker-legend"><i className="legend-tip" /> real tip image</span>
          </div>
          <div className="brush-picker-grid" ref={gridRef}>
            {visible.map((brush) => (
              <BrushTile
                key={brush.id}
                brush={brush}
                color={color}
                active={brush.id === activeBrush.id}
                onPick={onPick}
              />
            ))}
            {!visible.length && (
              <div className="brush-picker-empty">
                <strong>{query.trim() ? `No brushes match “${query}”.` : `No brushes in ${category}.`}</strong>
                <button onClick={resetFilters}>Clear search and filters</button>
              </div>
            )}
          </div>
          <div className="brush-picker-footer">
            <div className="brush-picker-selected">
              <strong>{activeBrush.name}</strong>
              <span>{activeBrush.description}</span>
            </div>
            <span className="brush-picker-stats">
              {stats.krita} Krita presets · {stats.gimp} GIMP tips · {stats.builtin} built-in pens · {stats.tips} unique masks
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
