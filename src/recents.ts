import type { Project } from './types'

const KEY = 'animate-recent-projects'
const MAX = 8

export interface RecentProject {
  id: string
  name: string
  width: number
  height: number
  frames: number
  savedAt: number
  data: string
}

export function getRecents(): RecentProject[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentProject[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function addRecent(project: Project): RecentProject[] {
  const entry: RecentProject = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: project.name,
    width: project.width,
    height: project.height,
    frames: project.totalFrames,
    savedAt: Date.now(),
    data: JSON.stringify(project),
  }
  const next = [entry, ...getRecents().filter((r) => r.name !== project.name)].slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full — ignore */ }
  return next
}

export function removeRecent(id: string): RecentProject[] {
  const next = getRecents().filter((r) => r.id !== id)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearRecents() {
  localStorage.removeItem(KEY)
}
