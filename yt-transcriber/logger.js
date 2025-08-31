import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';

const { logDirectory, level, logToConsole } = config.logging;

if (logDirectory) {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
}

const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const transports = [];

if (logToConsole) {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(), 
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      logFormat
    ),
  }));
}

if (logDirectory) {
  const today = new Date().toISOString().slice(0, 10);
  const filename = path.join(logDirectory, `${today}.log`);
  
  transports.push(new winston.transports.File({
    filename,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  }));
}

const logger = winston.createLogger({
  level: level || 'info',
  transports,
});

if (transports.length === 0) {
    logger.add(new winston.transports.Console({ silent: true }));
    console.log("Logging is disabled in config.js. No logs will be written.");
}

export default logger;