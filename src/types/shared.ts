export type Tab = {
  id: number
  url: string
  highlightedUrl: string
  title: string
  highlightedTitle: string
  faviconUrl: string
  screenshotUrl: string
  windowId: number
}

export type SystemHealth = {
  version: number
  lastCleanup: number
  errorCount: number
  lastHealthCheck: number
}

export type ModalMode = 'tab' | 'harpoon'
export type InputMode = 'insert' | 'normal' | 'visual'
