import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { mkdirSync } from 'fs';
import { logging } from '../config/index.js';

mkdirSync(logging.dir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}${metaStr}`;
});

function makeRotatingTransport(filename, level) {
  return new DailyRotateFile({
    dirname: logging.dir,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '50m',
    maxFiles: '14d',
    level,
    format: combine(timestamp(), errors({ stack: true }), logFormat),
  });
}

const logger = winston.createLogger({
  level: logging.level,
  format: combine(timestamp(), errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), logFormat),
    }),
    makeRotatingTransport('combined', 'info'),
    makeRotatingTransport('error', 'error'),
  ],
});

// Domain-specific child loggers
export const matchLogger = logger.child({ domain: 'matching' });
export const imageLogger = logger.child({ domain: 'images' });
export const cloudinaryLogger = logger.child({ domain: 'cloudinary' });
export const dbLogger = logger.child({ domain: 'database' });
export const queueLogger = logger.child({ domain: 'queue' });

// Dedicated rotating file transports for each domain
matchLogger.add(makeRotatingTransport('matching', 'debug'));
imageLogger.add(makeRotatingTransport('images', 'debug'));
cloudinaryLogger.add(makeRotatingTransport('cloudinary', 'debug'));
dbLogger.add(makeRotatingTransport('database', 'debug'));
queueLogger.add(makeRotatingTransport('queue', 'debug'));

export default logger;
