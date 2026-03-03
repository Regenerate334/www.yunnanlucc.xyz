import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import logger from './config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.info('[SERVER] Starting server initialization...');

// Run init-ai.js first
const initAI = spawn('node', [path.join(__dirname, 'init-ai.js')], {
    stdio: 'inherit',
    shell: true
});

initAI.on('close', (code) => {
    logger.info(`[SERVER] AI initialization completed (exit code: ${code})`);

    // After AI initialization, start the main server
    logger.info('[SERVER] Starting main server...');
    const server = spawn('node', [path.join(__dirname, 'index.js')], {
        stdio: 'inherit',
        shell: true
    });

    server.on('close', (serverCode) => {
        logger.error(`[SERVER] Server stopped (exit code: ${serverCode})`);
        process.exit(serverCode);
    });

    // Forward signals to child process
    process.on('SIGINT', () => {
        server.kill('SIGINT');
    });
    process.on('SIGTERM', () => {
        server.kill('SIGTERM');
    });
});
