/**
 * PM2 生产环境进程管理配置 (PM2 Ecosystem Configuration)
 * 职责：管控后端应用、Nginx 服务、定期探针及后台同步任务的生命周期。
 * 
 * 修改提示：
 * 1. 若需调整后端内存限制，请修改 apps[0].max_memory_restart。
 * 2. 环境变量通过 require('dotenv').config() 从根目录 .env 自动注入。
 * 3. 启动部署指令：pm2 start ecosystem.config.cjs --env production
 */
require('dotenv').config();

module.exports = {
    apps: [
        // 1. 后端服务 (Backend Service)
        {
            name: "ollama",
            script: "./server/index.js",
            cwd: "./",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            max_memory_restart: '1200M',
            exp_backoff_restart_delay: 100,
            env: {
                NODE_ENV: "production",
            }
        },
        // 2. Nginx 静态托管 (Frontend via Nginx)
        {
            name: "nginx",
            script: "C:\\Software Installation\\Software for learning\\nginx-1.26.3\\nginx.exe",
            args: `-c "C:\\projects\\webgis\\my_webgis_project\\ops\\sys\\nginx\\nginx_production.conf" -p "C:\\Software Installation\\Software for learning\\nginx-1.26.3\\"`,
            cwd: "C:\\Software Installation\\Software for learning\\nginx-1.26.3\\",
            instances: 1,
            exec_mode: "fork",
            autorestart: false,
            watch: false,
            env: {
                // 修复 Windows 下 Nginx 报 "invalid socket number" 错误
                NGINX: ""
            }
        },
        // 3. Cloudflare 隧道 (Security Tunnel)
        {
            name: "tunnel",
            script: "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
            args: `tunnel run --token ${process.env.CLOUDFLARE_TUNNEL_TOKEN}`,
            exec_mode: "fork",
            instances: 1,
            autorestart: true,
            exp_backoff_restart_delay: 1000,
            env: {
                // 显式传递 token，防止某些环境下 process.env 丢失
                CLOUDFLARE_TUNNEL_TOKEN: process.env.CLOUDFLARE_TUNNEL_TOKEN
            }
        },
        // 4. 状态探测器 (Status Probes)
        {
            name: "postgres",
            script: "./server/scripts/probes/status-postgres.js",
            cwd: "./",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            restart_delay: 10000,
            env: {
                NODE_ENV: process.env.NODE_ENV || "production"
            }
        },
        {
            name: "geoserver",
            script: "./server/scripts/probes/status-geoserver.js",
            cwd: "./",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            restart_delay: 10000
        },
        {
            name: "ai-service",
            script: "./server/scripts/probes/status-ollama.js",
            cwd: "./",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            restart_delay: 10000,
            env: {
                OLLAMA_URL: process.env.OLLAMA_URL || "http://localhost:11434"
            }
        }
    ]
};
