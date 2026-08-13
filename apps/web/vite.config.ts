import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(() => ({
  // Build ID：給人/瀏覽器看的版本浮水印，部署後立即知道有沒有更新
  // 注意：esbuild define 不接受字串 literal（會被誤判 JS），所以只放識別符，值在 transformIndexHtml 注入
  define: {
    __BUILD_TIME__: 'undefined',
    __BUILD_ID__: 'undefined',
  },
  plugins: [
    {
      // 在 build 把 index.html 的 __BUILD_ID__ / __BUILD_TIME__ 換成真實值
      name: 'build-id-html-transform',
      transformIndexHtml(html) {
        const buildId = process.env.GIT_COMMIT?.slice(0, 7) || Date.now().toString(36);
        const buildTime = new Date().toISOString();
        return html
          .replace(/__BUILD_ID__/g, buildId)
          .replace(/__BUILD_TIME__/g, buildTime);
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
}));