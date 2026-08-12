/**
 * Sistema de logging centralizado
 * Útil para debugging y monitoring en producción
 */

import { LOG_LEVEL_MAP, LOG_LEVELS } from './constants.js';

const CURRENT_LOG_LEVEL = LOG_LEVEL_MAP[process.env.LOG_LEVEL || 'info'] || LOG_LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, message, data = null) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('debug', message, data));
    }
  },

  info: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      console.log(formatMessage('info', message, data));
    }
  },

  warn: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('warn', message, data));
    }
  },

  error: (message, error = null) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      const errorData = error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : null;
      console.error(formatMessage('error', message, errorData));
    }
  }
};
