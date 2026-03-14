import { spawn } from 'child_process';
import http from 'http';
import net from 'net';

/**
 * 阶段 1: 基础端口探测 (TCP)
 * 只要端口被占用，不论是否能响应 API，均视为有服务在运行或启动中，避免重复拉起导致崩溃。
 */
const checkPort = (port) => new Promise(resolve => {
    const socket = new net.Socket();
    const timeout = 1000;

    socket.setTimeout(timeout);
    socket.once('error', () => {
        socket.destroy();
        resolve(false);
    });
    socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
    });
    socket.connect(port, '127.0.0.1', () => {
        socket.destroy();
        resolve(true);
    });
});

/**
 * 阶段 2: API 健康检查
 */
const checkOllamaAPI = () => new Promise(resolve => {
    const req = http.get('http://127.0.0.1:11434/api/tags', res => {
        resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
    });
});

let ollamaProcess = null;

async function start() {
    const portInUse = await checkPort(11434);

    if (portInUse) {
        const apiOk = await checkOllamaAPI();
        if (apiOk) {
            console.log('\x1b[35m[OLLAMA]\x1b[0m 检测到 Ollama 服务已就绪 (端口 11434)。直接复用现有服务。');
        } else {
            console.log('\x1b[33m[OLLAMA]\x1b[0m 端口 11434 已被占用但 API 无响应，可能正在启动中或处于非活跃状态。跳过再次拉起以防冲突。');
        }
        // 由于 concurrently 需要进程保持运行，我们在此等待信号
        setInterval(() => { }, 3600000);
        return;
    }

    console.log('\x1b[35m[OLLAMA]\x1b[0m 正在自动启动 Ollama 服务...');

    ollamaProcess = spawn('ollama', ['serve'], {
        shell: process.platform === 'win32',
        stdio: 'inherit' // 继承输出以便用户能看到具体错误提示
    });

    ollamaProcess.on('error', (err) => {
        console.error(`\x1b[31m[OLLAMA-ERR]\x1b[0m 启动失败: ${err.message}`);
        process.exit(1);
    });

    ollamaProcess.on('close', code => {
        if (code !== 0 && code !== null) {
            console.log(`\x1b[31m[OLLAMA]\x1b[0m 进程异常退出 (退出码: ${code})。请手动检查 ollama serve 是否能正常运行。`);
        } else {
            console.log(`\x1b[35m[OLLAMA]\x1b[0m Ollama 进程正常退出。`);
        }
        process.exit(0);
    });
}

function cleanup() {
    if (ollamaProcess) {
        console.log('\n\x1b[35m[OLLAMA]\x1b[0m 正在关闭由脚本拉起的进程...');
        if (process.platform === 'win32') {
            // Windows 下使用 taskkill 确保整棵进程树被杀死
            try {
                spawn('taskkill', ['/pid', ollamaProcess.pid, '/T', '/F']);
            } catch (e) { }
        } else {
            ollamaProcess.kill('SIGTERM');
        }
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

start();
