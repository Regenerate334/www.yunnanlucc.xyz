import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import viteCompression from 'vite-plugin-compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      cesium(),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 10240, // 超过 10kb 的文件才压缩
        algorithm: 'gzip',
        ext: '.gz',
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    server: {
      host: '0.0.0.0', // 允许监听所有网络接口，包括 Cloudflare 的转发
      port: 5174,
      allowedHosts: true, // 允许 Cloudflare 生成的随机域名访问
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/health': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/geoserver': {
          target: 'http://localhost:8080',
          changeOrigin: true
        }
      }
    },
    build: {
      target: 'esnext',
      sourcemap: false, // 生产环境禁用 Source Map，防止源代码泄露
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // 智能分包逻辑
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('echarts')) return 'echarts';
              if (id.includes('@turf')) return 'turf';
              if (id.includes('highlight.js') || id.includes('katex')) return 'ui-vendor';
              return 'vendor'; // 其他第三方库
            }
          }
        }
      }
    },
    esbuild: {
      // 仅在生产环境构建时剔除 console 和 debugger
      drop: mode === 'production' ? ['console', 'debugger'] : []
    }
  };
});