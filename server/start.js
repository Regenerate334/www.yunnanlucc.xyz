import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[36m[SERVER] Starting server initialization...\x1b[0m');

// Run init-ai.js first
const initAI = spawn('node', [path.join(__dirname, 'init-ai.js')], {
    stdio: 'inherit',
    shell: true
});

initAI.on('close', (code) => {
    console.log(`\x1b[36m[SERVER] AI initialization completed (exit code: ${code})\x1b[0m`);

    // After AI initialization, start the main server
    console.log('\x1b[36m[SERVER] Starting main server...\x1b[0m');
    const server = spawn('node', [path.join(__dirname, 'index.js')], {
        stdio: 'inherit',
        shell: true
    });

    server.on('close', (serverCode) => {
        console.log(`\x1b[31m[SERVER] Server stopped (exit code: ${serverCode})\x1b[0m`);
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
