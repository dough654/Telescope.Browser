import { setGlobalLogLevel } from './logger.js'

/**
 * Configure logging levels for different environments
 */
export function configureLogs() {
  // In development, show debug logs
  // In production, only show warnings and errors
  const logLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
  setGlobalLogLevel(logLevel)
  
  // Console helpers for runtime debugging
  if (typeof window !== 'undefined') {
    // @ts-expect-error Global debugging helpers
    window.telescopeDebug = () => setGlobalLogLevel('debug')
    // @ts-expect-error Global debugging helpers
    window.telescopeWarn = () => setGlobalLogLevel('warn')
    // @ts-expect-error Global debugging helpers
    window.telescopeError = () => setGlobalLogLevel('error')
  }
}

/**
 * Individual logger level configuration
 * Use this to fine-tune specific loggers if needed
 */
export function configureSpecificLoggers() {
  // Example: If you want to enable debug logging only for search but not others
  // searchLogger.setLevel('debug')
  
  // Example: Disable all keyboard logging in production
  // if (process.env.NODE_ENV === 'production') {
  //   keyboardLogger.setLevel('error')
  // }
}