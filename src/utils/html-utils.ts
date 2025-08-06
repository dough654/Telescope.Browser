import { telescopeLogger } from './logger.js'

export function disableScrolling() {
  const body = document.body
  const html = document.documentElement
  body.style.overflow = 'hidden'
  html.style.overflow = 'hidden'
}

export function enableScrolling() {
  const body = document.body
  const html = document.documentElement
  body.style.overflow = 'auto'
  html.style.overflow = 'auto'
}

/**
 * Returns true if the user is currently editing text in an input or textarea element
 * 'event' is the event object
 */
export function targetIsText(event: Event) {
  const target = event.target
  // Check if target is null or not an HTMLElement
  if (!(target instanceof HTMLElement)) {
    return false
  }
  // Check if the target is an input or textarea element
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    // Further check for specific types of input elements if necessary
    if (
      target instanceof HTMLInputElement &&
      (target.type === 'text' ||
        target.type === 'password' ||
        target.type === 'email' ||
        target.type === 'search')
    ) {
      // The target is a text input, textarea, etc.
      return true
    } else if (target instanceof HTMLTextAreaElement) {
      // The target is a textarea
      return true
    }
  }
  // Kind of hacky, but this is how we detect custom editors like Quill, CodeMirror, ProseMirror, Ace Editor, etc.
  const customEditors = ['ql-editor', 'CodeMirror-code', 'ProseMirror', 'ace_content']
  const isCustomEditor = customEditors.some((editor) => target.classList.contains(editor))
  if (isCustomEditor) {
    return true
  }
  if (target.isContentEditable) {
    return true
  }
  return false
}

// Truncates urls to 150 chars
export function truncateUrl(url: string) {
  if (url.length > 150) {
    return url.slice(0, 150) + '...'
  }
  return url
}

export function isRunningInIFrame() {
  return window.self !== window.top
}
