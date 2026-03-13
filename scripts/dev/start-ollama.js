import { spawn } from 'child_process';
import http from 'http';

const checkOllama = () => new Promise(resolve => {
    http.get('http://127.0.0.1:11434/api/tags', res => resolve(res.statusCode === 200))
        .on('error', () => resolve(false));
});

let ollamaProcess = null;

async function start() {
    const isRunning = await checkOllama();
    if (isRunning) {
        console.log('\x1b[35m[OLLAMA]\x1b[0m 检测到您的电脑已经运行了 Ollama (例如托盘图标)。直接复用现有服务安全连接。');
        // 保持占位，不让 concurrently 认为任务崩溃了
        setInterval(() => { }, 3600000);
        return;
    }

    console.log('\x1b[35m[OLLAMA]\x1b[0m 正在自动启动 Ollama 服务...');

    // 直接启动标准 serve，不做过度隐藏
    ollamaProcess = spawn('ollama', ['serve'], {
        shell: process.platform === 'win32'
    });

    ollamaProcess.stdout.on('data', data => {
        if (data.toString().includes('Listening on')) {
            console.log('\x1b[35m[OLLAMA]\x1b[0m 服务已启动就绪！');
        }
    });

    ollamaProcess.stderr.on('data', data => {
        if (data.toString().includes('Error:')) {
            console.error(`\x1b[31m[OLLAMA-ERR]\x1b[0m ${data}`);
        }
    });

    ollamaProcess.on('close', code => {
        console.log(`\x1b[35m[OLLAMA]\x1b[0m Ollama 进程正常退出。`);
        process.exit(0);
    });
}

function cleanup() {
    if (ollamaProcess) {
        console.log('\n\x1b[35m[OLLAMA]\x1b[0m 正在关闭由 npm 启动的 Ollama 进程...');
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', ollamaProcess.pid, '/T', '/F']);
        } else {
            ollamaProcess.kill('SIGTERM');
        }
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

start();
