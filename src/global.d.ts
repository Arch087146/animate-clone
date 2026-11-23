interface ExportVideoPayload {
  name: string
  format: string
  fps: number
  width: number
  height: number
  quality: number
  scale: number
  loop: number
  frames: ArrayBuffer[]
}

interface ExportVideoResult {
  cancelled: boolean
  path?: string
  message?: string
}

interface ElectronAPI {
  isElectron: boolean
  minimize: () => void
  maximize: () => void
  close: () => void
  exportVideo: (payload: ExportVideoPayload) => Promise<ExportVideoResult>
  onExportProgress: (callback: (fraction: number) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
