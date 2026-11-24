import type { CSSProperties, ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  selection: <path d="M3 1.5l4.2 11.6 1.6-4.4 4.4-1.6z" />,
  subselection: <path d="M4 2.5l5 5.5-5 5.5M9 8h4" />,
  lasso: <><path d="M8 1.5c-3.6 0-6 2.2-6 5 0 2.5 2.2 4.5 5.2 5" /><path d="M7 11.5l1 3 1.6-2.6" /><circle cx="11" cy="11" r="1.6" /></>,
  pen: <><path d="M2 14l3-1 8-8-2-2-8 8z" /><path d="M10.5 4.5l2 2M4 13l2 2" /></>,
  text: <><path d="M2 3h12M8 3v11M5 14h6" /></>,
  line: <><path d="M2 14L14 2" /><rect x="1" y="12.5" width="3" height="3" /><rect x="12" y="1.5" width="3" height="3" /></>,
  rectangle: <><rect x="2" y="3" width="12" height="10" /><rect x="1" y="2" width="3" height="3" fill="currentColor" /><rect x="12" y="2" width="3" height="3" fill="currentColor" /><rect x="1" y="11" width="3" height="3" fill="currentColor" /><rect x="12" y="11" width="3" height="3" fill="currentColor" /></>,
  oval: <><ellipse cx="8" cy="8" rx="6" ry="5" /><circle cx="2" cy="8" r="1" fill="currentColor" /><circle cx="14" cy="8" r="1" fill="currentColor" /></>,
  rectPrimitive: <><rect x="2" y="3" width="12" height="10" rx="3" /><circle cx="4" cy="5" r="1" fill="currentColor" /></>,
  ovalPrimitive: <><ellipse cx="8" cy="8" rx="6" ry="5" /><path d="M8 3v10M2 8h12" strokeDasharray="1.5 1.5" /><circle cx="8" cy="3" r="1" fill="currentColor" /></>,
  polyStar: <><path d="M8 1.5l1.8 4.3 4.7.3-3.6 3 1.2 4.5L8 11.3 4 13.6l1.2-4.5-3.6-3 4.7-.3z" /></>,
  pencil: <><path d="M2 14l1.5-4L11 2.5l2.5 2.5L6 12.5z" /><path d="M10 3.5l2.5 2.5" /></>,
  brush: <><path d="M12 1.5c1.5 0 2.5 1 2.5 2.5 0 1.7-1.6 2.5-3.4 2.5-.8 0-1.6-.2-2.1-.6L5 12l-3-1 5.6-5.8c-.3-.6-.4-1.2-.4-1.8 0-1.4 1-2.9 2.8-2.9z" /></>,
  eraser: <><path d="M6 14L1.8 9.8a2 2 0 010-2.8L8 1a2 2 0 012.8 0l3.4 3.4a2 2 0 010 2.8L9.4 14z" /><path d="M5 6l5 5" /></>,
  inkBottle: <><path d="M8 1.5c2 2.5 4 4.7 4 7.5a4 4 0 01-8 0c0-2.8 2-5 4-7.5z" /><path d="M6.5 9.5a1.5 1.5 0 001.5 1.5" /></>,
  paintBucket: <><path d="M6 1.5L12.5 8 8 12.5 1.5 6z" /><path d="M4 4l8 8" /><path d="M13 10c1.5 2 2 3 2 4a2 2 0 11-4 0c0-1 .5-2 2-4z" /></>,
  eyedropper: <><path d="M11 1.5l3.5 3.5-2 2-1-1-6 6-2.5.5.5-2.5 6-6-1-1z" /><path d="M3 14l-2 2" /></>,
  hand: <><path d="M5 8V4.5a1 1 0 012 0V8M7 7V3a1 1 0 012 0v4M9 7V4a1 1 0 012 0v4M11 7V5a1 1 0 012 0v5c0 3-2 5-5 5S4 12 4 10V8a1 1 0 012 0" /></>,
  zoom: <><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4 4M6.5 4.5v4M4.5 6.5h4" /></>,

  new: <><path d="M9 1.5H3.5v13h9V5z" /><path d="M9 1.5V5h3.5M7.7 7v4M5.7 9h4" /></>,
  open: <><path d="M1.5 4.5h5l1.5 2h6.5v7h-12z" /><path d="M1.5 4.5V3h4l1.5 1.5" /></>,
  save: <><path d="M2 2h10l2 2v10H2z" /><path d="M5 2v4h6V2M5 14v-5h6v5" /></>,
  undo: <><path d="M5 5L1.5 8.5 5 12" /><path d="M1.5 8.5h8a4 4 0 010 8H7" /></>,
  redo: <><path d="M11 5l3.5 3.5L11 12" /><path d="M14.5 8.5h-8a4 4 0 000 8H9" /></>,
  play: <path d="M3 1.5l11 6.5-11 6.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="3" y="2" width="3.5" height="12" fill="currentColor" stroke="none" /><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" stroke="none" /></>,
  rewind: <><path d="M2 2l7 6-7 6z" fill="currentColor" stroke="none" /><path d="M9 2l7 6-7 6z" fill="currentColor" stroke="none" /></>,
  forward: <><path d="M14 2L7 8l7 6z" fill="currentColor" stroke="none" /><path d="M7 2L0 8l7 6z" fill="currentColor" stroke="none" /></>,
  stop: <rect x="2.5" y="2.5" width="11" height="11" fill="currentColor" stroke="none" />,
  stepBack: <><path d="M5 2l8 6-8 6z" fill="currentColor" stroke="none" /><path d="M2 2v12" /></>,
  stepForward: <><path d="M11 2L3 8l8 6z" fill="currentColor" stroke="none" /><path d="M14 2v12" /></>,
  eye: <><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" /><circle cx="8" cy="8" r="2" /></>,
  eyeOff: <><path d="M3 3l10 10" /><path d="M5 4.5C2.6 5.9 1 8 1 8s2.5 4.5 7 4.5c1 0 2-.2 2.8-.5M11 4c.7.3 1.3.6 1.8 1M14 6c.7.8 1 2 1 2s-2.5 4.5-7 4.5" /></>,
  lock: <><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" /></>,
  unlock: <><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 014.8-1" /></>,
  plus: <path d="M8 2v12M2 8h12" />,
  minus: <path d="M2 8h12" />,
  trash: <><path d="M3 4h10M6 4V2h4v2M4 4l1 11h6l1-11" /></>,
  chevronDown: <path d="M3 6l5 5 5-5" />,
  chevronRight: <path d="M6 3l5 5-5 5" />,
  chevronUp: <path d="M3 10l5-5 5 5" />,
  onion: <><circle cx="8" cy="8" r="6" strokeDasharray="2 2" /><circle cx="8" cy="8" r="3" strokeDasharray="2 2" /><circle cx="8" cy="8" r="1" fill="currentColor" /></>,
  grid: <><path d="M1 1h14v14H1zM1 5.5h14M1 10.5h14M5.5 1v14M10.5 1v14" /></>,
  ruler: <><rect x="1" y="4" width="14" height="8" rx="1" /><path d="M4 4v3M7 4v4M10 4v3M13 4v4" /></>,
  bone: <><path d="M3.6 12.4a2 2 0 112.8-2.8l3.2-3.2a2 2 0 11-2.8-2.8l-3.2 3.2a2 2 0 110 2.8z" transform="rotate(0 8 8)" /><path d="M9.6 6a2 2 0 112.8-2.8l1.6 1.6a2 2 0 11-2.8 2.8z" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /></>,
  moon: <path d="M13 10.5A6 6 0 015.5 3a6 6 0 107.5 7.5z" />,
  sun: <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" /></>,
  symbol: <><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 6h6M5 9h6M5 12h3" /></>,
  motionPath: <><path d="M2 12C4 3 10 2 14 6" strokeDasharray="2 2" /><circle cx="2" cy="12" r="1.5" /><path d="M12 4l3 2-3 2" /></>,
  magnet: <><path d="M3 1.5v7a5 5 0 0010 0v-7h-3v7a2 2 0 01-4 0v-7z" /><path d="M3 4.5h3M10 4.5h3" /></>,
  settings: <><circle cx="8" cy="8" r="2.2" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" /></>,
  copy: <><rect x="5" y="5" width="9" height="9" /><path d="M11 5V2H2v9h3" /></>,
  paste: <><rect x="4" y="4" width="8" height="10" rx="1" /><path d="M6 4V2h4v2" /><path d="M6 8h4M6 11h4" /></>,
  duplicateFrame: <><rect x="2" y="5" width="8" height="7" /><path d="M5 5V3h8v7h-2" /><path d="M9 8.5h3M10.5 7v3" /></>,
  link: <><path d="M6.5 9.5a3 3 0 004.2 0l2-2a3 3 0 00-4.2-4.2l-1 1" /><path d="M9.5 6.5a3 3 0 00-4.2 0l-2 2a3 3 0 004.2 4.2l1-1" /></>,
  center: <><path d="M8 1v14M1 8h14" /><rect x="5" y="5" width="6" height="6" /></>,
  centerFrame: <><path d="M8 1.5v13M1.5 8h13" /><path d="M5 4L8 1.5 11 4M5 12l3 2.5 3-2.5M4 5L1.5 8 4 11M12 5l2.5 3L12 11" /></>,
  hamburger: <><path d="M2 4h12M2 8h12M2 12h12" /></>,
  swapColors: <><path d="M4 3h4v4H4zM8 9h4v4H8z" fill="currentColor" stroke="none" /><path d="M10 3.5h3M11.5 2l2 1.5-2 1.5M6 12.5H3M4.5 11l-2 1.5 2 1.5" /></>,
  defaultColors: <><rect x="2" y="2" width="8" height="8" fill="#fff" stroke="currentColor" /><rect x="6" y="6" width="8" height="8" fill="#000" stroke="currentColor" /></>,
  keyframe: <><circle cx="8" cy="8" r="3.2" fill="currentColor" stroke="none" /><path d="M2 8h2.5M11.5 8H14" /></>,
  blankKeyframe: <><circle cx="8" cy="8" r="3.2" /><path d="M2 8h2.5M11.5 8H14" /></>,
  outline: <><rect x="2" y="2" width="12" height="12" rx="1" /><rect x="4.5" y="4.5" width="7" height="7" /></>,
  rowHeight: <><path d="M2 3h12M2 8h12M2 13h12" /><path d="M4.5 2v12M11.5 2v12" strokeDasharray="1.5 2" /></>,
  alignLeft: <><path d="M2 1v14M4 4h9M4 8h6M4 12h9" /></>,
  alignCenter: <><path d="M8 1v14M3 4h10M5 8h6M3 12h10" /></>,
  alignRight: <><path d="M14 1v14M3 4h9M6 8h6M3 12h9" /></>,
  bringFront: <><rect x="5" y="5" width="8" height="8" /><path d="M3 11V3h8" /></>,
  sendBack: <><rect x="3" y="3" width="8" height="8" /><path d="M13 5v8H5" /></>,
  export: <><path d="M8 10V1M5 4l3-3 3 3" /><path d="M2 10v4h12v-4" /></>,
  image: <><rect x="1.5" y="2.5" width="13" height="11" /><circle cx="5" cy="6" r="1.3" /><path d="M2 11l4-4 3 3 2-2 3 3" /></>,
  film: <><rect x="1.5" y="3" width="13" height="10" /><path d="M4.5 3v10M11.5 3v10M1.5 5.5h3M1.5 10.5h3M11.5 5.5h3M11.5 10.5h3" /></>,
  folder: <path d="M1.5 4h5l1.5 2h6.5v8h-13z" />,
  help: <><circle cx="8" cy="8" r="6.5" /><path d="M6 6a2 2 0 114 0c0 1.5-2 1.5-2 3M8 12.5v.5" /></>,
  home: <><path d="M1.5 7.5L8 2l6.5 5.5v7h-13z" /><path d="M6 14.5v-5h4v5" /></>,
  sparkle: <><path d="M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z" /><path d="M13 11.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" /></>,
  book: <><path d="M2 2.5h5a2 2 0 012 2v9a2 2 0 00-2-2H2z" /><path d="M14 2.5H9a2 2 0 00-2 2v9a2 2 0 012-2h5z" /></>,
  rocket: <><path d="M8 1.5c3 2 4.5 5 4.5 8L8 14l-4.5-4.5c0-3 1.5-6 4.5-8z" /><circle cx="8" cy="7" r="1.6" /><path d="M5 12l-2 2.5M11 12l2 2.5M8 14v1.5" /></>,
  layers: <><path d="M8 1.5L15 5 8 8.5 1 5z" /><path d="M1 8l7 3.5L15 8M1 11l7 3.5L15 11" /></>,
  palette: <><path d="M8 1.5a6.5 6.5 0 000 13c1 0 1.5-.7 1.5-1.5 0-1 .7-1.5 1.6-1.5h1.4A2.5 2.5 0 0015 9.5c0-4-3.2-8-7-8z" /><circle cx="4.5" cy="7" r=".8" fill="currentColor" stroke="none" /><circle cx="7" cy="4.5" r=".8" fill="currentColor" stroke="none" /><circle cx="10.5" cy="5" r=".8" fill="currentColor" stroke="none" /></>,
  clock: <><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5V8l2.5 1.5" /></>,
  arrowRight: <path d="M2 8h11M9 4l4 4-4 4" />,
  check: <path d="M2.5 8.5l3.5 3.5 7.5-8" />,
  sliders: <><path d="M2 4h12M2 8h12M2 12h12" /><circle cx="5" cy="4" r="1.5" fill="#fff" /><circle cx="10" cy="8" r="1.5" fill="#fff" /><circle cx="7" cy="12" r="1.5" fill="#fff" /></>,
  lightbulb: <><path d="M8 1.5a4.5 4.5 0 00-2.5 8.2V12h5V9.7A4.5 4.5 0 008 1.5z" /><path d="M6 14h4M6.5 12h3" /></>,
  beginner: <><circle cx="8" cy="8" r="6.5" /><path d="M5.5 6.5h.01M10.5 6.5h.01M5.5 10.5c1.5 1.3 3.5 1.3 5 0" /></>,
  pro: <><path d="M8 1.5l1.8 4.2 4.7.4-3.6 3 1.2 4.5L8 11.3 4 13.6l1.2-4.5-3.6-3 4.7-.4z" /><path d="M6.5 8.5l1 1 2-2.5" /></>,
  upload: <><path d="M8 11V2M5 5l3-3 3 3" /><path d="M2 10v4h12v-4" /></>,
  close: <path d="M3 3l10 10M13 3L3 13" />,
 Adobe: <><path d="M4 1.5L1.5 14.5h2l.7-3h3l.7 3h2L8 1.5zM6 4l.8 5.5H5.2z" fill="currentColor" stroke="none" /><path d="M10.5 1.5v13h2.2c2.3 0 3.3-1.3 3.3-3.2 0-1.5-.7-2.5-1.9-2.9 1-.4 1.6-1.3 1.6-2.5 0-1.9-1.2-3.1-3.2-3.1zM12.3 3.2c1 0 1.5.5 1.5 1.4s-.5 1.4-1.5 1.4h-.5V3.2zM12.3 7.2c1.1 0 1.7.5 1.7 1.6s-.6 1.6-1.7 1.6h-.5V7.2z" fill="currentColor" stroke="none" /></>,
}

export function Icon({
  name,
  size = 16,
  style,
  className,
}: {
  name: string
  size?: number
  style?: CSSProperties
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {paths[name] ?? paths.settings}
    </svg>
  )
}
