import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    cesium()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: false, // 生产环境禁用 Source Map，防止源代码泄露
    chunkSizeWarningLimit: 2000, // 增加 chunk 大小警告限制，Cesium 较大
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ['cesium'] // 将 Cesium 拆分为独立 chunk
        }
      }
    }
  }
});