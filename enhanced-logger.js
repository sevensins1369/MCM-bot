// enhanced-logger.js
const fs = require('fs');
const path = require('path');
const util = require('util');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Default configuration
const DEFAULT_CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  logDirectory: path.join(__dirname, '../logs'),
  maxLogFiles: 30, // Maximum number of log files to keep per type
  consoleOutput: true,
  fileOutput: true,
  colorize: true,
  includeTimestamp: true
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Level-specific formatting
const LEVEL_FORMAT = {
  ERROR: { prefix: 'ERROR', color: COLORS.red },
  WARN: { prefix: 'WARN', color: COLORS.yellow },
  INFO: { prefix: 'INFO', color: COLORS.green },
  DEBUG: { prefix: 'DEBUG', color: COLORS.cyan },
  TRACE: { prefix: 'TRACE', color: COLORS.magenta }
};

class Logger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentLogLevel = LOG_LEVELS[this.config.logLevel] || LOG_LEVELS.INFO;
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
    return this.config.logDirectory;
  }

  /**
   * Rotates log files to keep only the most recent ones
   * @param {string} logType - Type of log (error, warn, info, etc.)
   */
  rotateLogFiles(logType) {
    try {
      const logDir = this.config.logDirectory;
      const logFiles = fs.readdirSync(logDir)
        .filter(file => file.startsWith(`${logType}-`) && file.endsWith('.log'))
        .sort((a, b) => {
          // Sort by date in filename (descending)
          const dateA = a.replace(`${logType}-`, '').replace('.log', '');
          const dateB = b.replace(`${logType}-`, '').replace('.log', '');
          return dateB.localeCompare(dateA);
        });

      // Delete older files if we have more than the maximum
      if (logFiles.length > this.config.maxLogFiles) {
        for (let i = this.config.maxLogFiles; i < logFiles.length; i++) {
          fs.unlinkSync(path.join(logDir, logFiles[i]));
        }
      }
    } catch (error) {
      console.error(`Failed to rotate log files: ${error.message}`);
    }
  }

  /**
   * Formats a log message with appropriate styling
   * @param {string} level - Log level
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @returns {string} - Formatted log message
   */
  formatLogMessage(level, source, message, data = {}) {
    const timestamp = this.config.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
    const levelInfo = LEVEL_FORMAT[level] || LEVEL_FORMAT.INFO;
    const levelPrefix = `[${levelInfo.prefix}]`;
    
    let formattedMessage = `${timestamp}${levelPrefix} ${source}: ${message}`;
    
    // Add data if present
    if (Object.keys(data).length > 0) {
      const dataString = util.inspect(data, { depth: 4, colors: false });
      formattedMessage += `\nData: ${dataString}`;
    }
    
    // Add color if enabled
    if (this.config.colorize && this.config.consoleOutput) {
      formattedMessage = `${levelInfo.color}${formattedMessage}${COLORS.reset}`;
    }
    
    return formattedMessage;
  }

  /**
   * Writes a log entry to file
   * @param {string} level - Log level
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  writeToFile(level, source, message, data = {}) {
    if (!this.config.fileOutput) return;
    
    try {
      const logDir = this.ensureLogDirectory();
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(logDir, `${level.toLowerCase()}-${date}.log`);
      
      // Format for file (no colors)
      const timestamp = `[${new Date().toISOString()}]`;
      const levelPrefix = `[${level}]`;
      
      let logEntry = `${timestamp} ${levelPrefix} ${source}: ${message}\n`;
      
      // Add data if present
      if (Object.keys(data).length > 0) {
        const dataString = util.inspect(data, { depth: 4, colors: false });
        logEntry += `Data: ${dataString}\n`;
      }
      
      // Add stack trace for errors
      if (level === 'ERROR' && data.error && data.error.stack) {
        logEntry += `Stack: ${data.error.stack}\n`;
      }
      
      logEntry += '\n';
      
      fs.appendFileSync(logFile, logEntry);
      
      // Rotate log files if needed
      this.rotateLogFiles(level.toLowerCase());
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  /**
   * Logs a message at the specified level
   * @param {string} level - Log level
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(level, source, message, data = {}) {
    const logLevelValue = LOG_LEVELS[level];
    
    // Skip if log level is higher than current setting
    if (logLevelValue > this.currentLogLevel) {
      return;
    }
    
    // Format the message
    const formattedMessage = this.formatLogMessage(level, source, message, data);
    
    // Output to console if enabled
    if (this.config.consoleOutput) {
      if (level === 'ERROR') {
        console.error(formattedMessage);
      } else if (level === 'WARN') {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
    
    // Write to file
    this.writeToFile(level, source, message, data);
  }

  /**
   * Log an error message
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or additional data
   */
  error(source, message, error = {}) {
    const data = error instanceof Error ? { error } : error;
    this.log('ERROR', source, message, data);
  }

  /**
   * Log a warning message
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  warn(source, message, data = {}) {
    this.log('WARN', source, message, data);
  }

  /**
   * Log an info message
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  info(source, message, data = {}) {
    this.log('INFO', source, message, data);
  }

  /**
   * Log a debug message
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  debug(source, message, data = {}) {
    this.log('DEBUG', source, message, data);
  }

  /**
   * Log a trace message
   * @param {string} source - Source of the log
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  trace(source, message, data = {}) {
    this.log('TRACE', source, message, data);
  }

  /**
   * Set the current log level
   * @param {string} level - New log level
   */
  setLogLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.currentLogLevel = LOG_LEVELS[level];
      this.info('Logger', `Log level set to ${level}`);
    } else {
      this.warn('Logger', `Invalid log level: ${level}. Using INFO instead.`);
      this.currentLogLevel = LOG_LEVELS.INFO;
    }
  }
}

// Create and export a singleton instance
const logger = new Logger();

// For backward compatibility
const logError = (source, error, additionalInfo = {}) => {
  logger.error(source, error.message || 'Unknown error', { 
    ...additionalInfo, 
    error 
  });
};

const logInfo = (source, message, data = {}) => {
  logger.info(source, message, data);
};

module.exports = { 
  logger,
  logError,
  logInfo,
  LOG_LEVELS
};