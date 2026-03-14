import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Ensure env vars are loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const logDir = path.join(__dirname, '../logs');
const logLevel = process.env.LOG_LEVEL || 'info';

// Custom format for console logging with colors and alignment
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // 让等级固定宽度对齐，并转换为大写增加专业感
        const levelTag = level.toUpperCase().padEnd(7);
        let logMsg = `[${timestamp}] ${levelTag}: ${message}`;

        if (stack) logMsg += `\n${stack}`;
        if (Object.keys(meta).length > 0) {
            logMsg += `\n${JSON.stringify(meta, null, 2)}`;
        }
        return logMsg;
    })
);

// File format: readable text instead of JSON
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMsg = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
        if (stack) logMsg += `\nStack: ${stack}`;
        if (Object.keys(meta).length > 0) logMsg += `\nMeta: ${JSON.stringify(meta)}`;
        return logMsg;
    })
);

const logger = winston.createLogger({
    level: logLevel === 'silent' ? 'error' : logLevel,
    silent: logLevel === 'silent',
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat,
            handleExceptions: true,
        }),
        // Daily rotate file transport for general logs (info and above)
        new winston.transports.DailyRotateFile({
            dirname: logDir,
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: fileFormat,
            auditFile: path.join(logDir, '.audit.json'), // Consolidate audit info
            level: 'info', // Always log info + error to file regardless of console setting usually
        }),
        // Separate error log
        new winston.transports.DailyRotateFile({
            dirname: logDir,
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
            format: fileFormat,
            auditFile: path.join(logDir, '.error-audit.json'), // Separate audit for errors
        }),
    ],
    exitOnError: false,
});

// Create a stream object with a 'write' function that will be used by morgan or custom middleware
logger.stream = {
    write: function (message) {
        logger.info(message.trim());
    },
};

export default logger;
