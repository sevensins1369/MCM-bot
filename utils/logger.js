// utils/logger.js
const fs = require('fs');
const path = require('path');

function ensureLogDirectory() {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

function logError(source, error, additionalInfo = {}) {
  const logDir = ensureLogDirectory();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logDir, `errors-${date}.log`);
  
  const logEntry = `[${new Date().toISOString()}] ${source}: ${error.message}\n` +
                   `Additional Info: ${JSON.stringify(additionalInfo)}\n` +
                   `${error.stack}\n\n`;
  
  fs.appendFileSync(logFile, logEntry);
  console.error(`Error in ${source}:`, error);
}

function logInfo(source, message, data = {}) {
  const logDir = ensureLogDirectory();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logDir, `info-${date}.log`);
  
  const logEntry = `[${new Date().toISOString()}] ${source}: ${message}\n` +
                   `Data: ${JSON.stringify(data)}\n\n`;
  
  fs.appendFileSync(logFile, logEntry);
  console.log(`[INFO] ${source}: ${message}`);
}

module.exports = { logError, logInfo };