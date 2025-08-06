import { writable } from 'svelte/store'

export type WhichKeyHint = {
  key: string
  description: string
}

export const isWhichKeyVisible = writable(false)
export const whichKeyHints = writable<WhichKeyHint[]>([])

let whichKeyTimeout: NodeJS.Timeout | null = null

export function showWhichKey(hints: WhichKeyHint[]) {
  whichKeyHints.set(hints)
  isWhichKeyVisible.set(true)
}

export function hideWhichKey() {
  isWhichKeyVisible.set(false)
  whichKeyHints.set([])
  if (whichKeyTimeout) {
    clearTimeout(whichKeyTimeout)
    whichKeyTimeout = null
  }
}

export function scheduleWhichKey(hints: WhichKeyHint[], delay: number = 500) {
  hideWhichKey()

  whichKeyTimeout = setTimeout(() => {
    showWhichKey(hints)
  }, delay)
}

