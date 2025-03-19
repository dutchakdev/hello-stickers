import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import db from '../database/db';

// Define log levels
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

// Default log file path
const LOG_FILE_PATH = path.join(app.getPath('userData'), 'logs');
const LOG_FILE_NAME = 'app.log';

// Ensure log directory exists
if (!fs.existsSync(LOG_FILE_PATH)) {
  fs.mkdirSync(LOG_FILE_PATH, { recursive: true });
}

// Variable to track whether extended logging is enabled
let extendedLogsEnabled = false;

/**
 * Initialize the logger and check if extended logs are enabled
 */
export async function initLogger(): Promise<void> {
  try {
    const setting = await db.getAppSetting('extendedLogs');
    extendedLogsEnabled = setting?.value === true;
    
    // Log the initialization
    await log(LogLevel.INFO, 'Logger initialized', { extendedLogsEnabled });
  } catch (error) {
    console.error('Failed to initialize logger:', error);
  }
}

/**
 * Update logger settings based on app settings
 */
export async function updateLoggerSettings(): Promise<void> {
  try {
    const setting = await db.getAppSetting('extendedLogs');
    const wasEnabled = extendedLogsEnabled;
    extendedLogsEnabled = setting?.value === true;
    
    if (wasEnabled !== extendedLogsEnabled) {
      await log(LogLevel.INFO, 'Logger settings updated', { 
        extendedLogsEnabled, 
        previousValue: wasEnabled 
      });
    }
  } catch (error) {
    console.error('Failed to update logger settings:', error);
  }
}

/**
 * Log a message with optional metadata
 * @param level Log level
 * @param message Message to log
 * @param metadata Additional metadata to include in the log
 */
export async function log(
  level: LogLevel, 
  message: string, 
  metadata?: Record<string, any>
): Promise<void> {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Always log to console
  switch (level) {
    case LogLevel.ERROR:
      console.error(formattedMessage, metadata || '');
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, metadata || '');
      break;
    case LogLevel.DEBUG:
      console.debug(formattedMessage, metadata || '');
      break;
    default:
      console.log(formattedMessage, metadata || '');
  }
  
  // Only write to file if extended logs are enabled
  if (extendedLogsEnabled) {
    try {
      const logFilePath = path.join(LOG_FILE_PATH, LOG_FILE_NAME);
      const logEntry = {
        timestamp,
        level,
        message,
        metadata
      };
      
      // Append log to file
      fs.appendFileSync(
        logFilePath, 
        JSON.stringify(logEntry) + '\n',
        { encoding: 'utf8' }
      );
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

/**
 * Shorthand methods for different log levels
 */
export const logger = {
  info: (message: string, metadata?: Record<string, any>) => log(LogLevel.INFO, message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => log(LogLevel.WARN, message, metadata),
  error: (message: string, metadata?: Record<string, any>) => log(LogLevel.ERROR, message, metadata),
  debug: (message: string, metadata?: Record<string, any>) => log(LogLevel.DEBUG, message, metadata),
  
  /**
   * Get path to the log file
   */
  getLogFilePath: () => path.join(LOG_FILE_PATH, LOG_FILE_NAME),
  
  /**
   * Clear log file
   */
  clearLogs: async (): Promise<void> => {
    try {
      const logFilePath = path.join(LOG_FILE_PATH, LOG_FILE_NAME);
      if (fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '', { encoding: 'utf8' });
        await log(LogLevel.INFO, 'Log file cleared');
      }
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }
};

export default logger; 