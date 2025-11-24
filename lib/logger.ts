/**
 * Centralized logging utility
 * Only logs to console in development, errors always logged
 */

type LogLevel = 'log' | 'warn' | 'error' | 'debug'

function shouldLog(level: LogLevel): boolean {
  if (level === 'error') return true // Always log errors
  if (typeof window === 'undefined') {
    // Server-side: only log in development
    return process.env.NODE_ENV === 'development'
  }
  // Client-side: only log in development
  return process.env.NODE_ENV === 'development'
}

export const logger = {
  log: (...args: unknown[]) => {
    if (shouldLog('log')) {
      console.log('[LOG]', ...args)
    }
  },
  
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args)
    }
  },
  
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args)
  },
  
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('[DEBUG]', ...args)
    }
  },
}


