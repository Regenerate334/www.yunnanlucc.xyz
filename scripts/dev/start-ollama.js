import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log directory and file
const logDir = path.join(__dirname, '../server/logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'ollama.log');

// Log rotation: if file exceeds 10MB, rotate it to .bak
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

try {
    if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > MAX_LOG_SIZE) {
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`\x1b[33m[OLLAMA] Log file size (${sizeMB} MB) exceeds limit. Rotating log...\x1b[0m`);

            const backupFile = path.join(logDir, 'ollama.log.bak');
            // Remove old backup if exists
            if (fs.existsSync(backupFile)) {
                fs.unlinkSync(backupFile);
            }
            // Rename current log to backup
            fs.renameSync(logFile, backupFile);
        }
    }
} catch (err) {
    console.error(`\x1b[31m[OLLAMA] Failed to rotate log file: ${err.message}\x1b[0m`);
}

const logStream = fs.createWriteStream(logFile, { flags: 'a' });

console.log('\x1b[36m[OLLAMA] Starting Ollama service...\x1b[0m');
console.log(`\x1b[90m[OLLAMA] Logs are being redirected to ${logFile}\x1b[0m`);

const ollama = spawn('ollama', ['serve'], {
    shell: true
});

// Redirect stdout and stderr to the log file
ollama.stdout.pipe(logStream);
ollama.stderr.pipe(logStream);

ollama.on('error', (err) => {
    console.error(`\x1b[31m[OLLAMA] Failed to start process: ${err.message}\x1b[0m`);
});

ollama.on('close', (code) => {
    console.log(`\x1b[33m[OLLAMA] Service stopped (exit code: ${code})\x1b[0m`);
    logStream.end();
});

// Handle termination signals to stop the child process
process.on('SIGINT', () => {
    ollama.kill('SIGINT');
});

process.on('SIGTERM', () => {
    ollama.kill('SIGTERM');
});
