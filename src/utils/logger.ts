import log from 'loglevel'

type LogPrefix = 'TELESCOPE' | 'CONTENT' | 'SERVICE_WORKER' | 'SEARCH' | 'MODAL' | 'KEYBOARD' | 'TABS' | 'HARPOON'

const createLogger = (prefix: LogPrefix) => {
  const logger = log.getLogger(prefix)
  
  // Set default log level based on environment
  const defaultLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
  logger.setLevel(defaultLevel)
  
  // Override log level from localStorage if available (for runtime debugging)
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedLevel = localStorage.getItem(`telescope-log-level-${prefix}`)
    if (storedLevel) {
      logger.setLevel(storedLevel as log.LogLevelDesc)
    }
  }
  
  return {
    debug: (message: string, ...args: unknown[]) => logger.debug(`[${prefix}] ${message}`, ...args),
    info: (message: string, ...args: unknown[]) => logger.info(`[${prefix}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => logger.warn(`[${prefix}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => logger.error(`[${prefix}] ${message}`, ...args),
    setLevel: (level: log.LogLevelDesc) => {
      logger.setLevel(level)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`telescope-log-level-${prefix}`, level.toString())
      }
    }
  }
}

// Export individual loggers for different parts of the app
export const telescopeLogger = createLogger('TELESCOPE')
export const contentLogger = createLogger('CONTENT')
export const serviceWorkerLogger = createLogger('SERVICE_WORKER')
export const searchLogger = createLogger('SEARCH')
export const modalLogger = createLogger('MODAL')
export const keyboardLogger = createLogger('KEYBOARD')
export const tabsLogger = createLogger('TABS')
export const harpoonLogger = createLogger('HARPOON')

// Helper function to set log level for all loggers
export const setGlobalLogLevel = (level: log.LogLevelDesc) => {
  telescopeLogger.setLevel(level)
  contentLogger.setLevel(level)
  serviceWorkerLogger.setLevel(level)
  searchLogger.setLevel(level)
  modalLogger.setLevel(level)
  keyboardLogger.setLevel(level)
  tabsLogger.setLevel(level)
  harpoonLogger.setLevel(level)
}

// Expose global function for easy debugging in console
if (typeof window !== 'undefined') {
  // @ts-expect-error Global function for debugging
  window.telescopeSetLogLevel = setGlobalLogLevel
}