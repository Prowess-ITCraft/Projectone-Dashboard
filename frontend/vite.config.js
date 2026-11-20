import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The app calls the API at /api on its own address, so the session cookie is first-party. Locally the dev server
// forwards those calls to the API (API_PROXY_TARGET, default http://localhost:9666); a host does the same with a rewrite.
const apiProxy = {
  target: process.env.API_PROXY_TARGET || 'http://localhost:9666',
  changeOrigin: false,
  rewrite: (path) => path.replace(/^\/api/, ''),
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // the dev server may read the repository root, where the private samples folder sits next to this app
  server: { port: 9555, strictPort: true, fs: { allow: ['..'] }, proxy: { '/api': apiProxy } },
  preview: { port: 9555, strictPort: true, proxy: { '/api': apiProxy } },
  // the libraries change rarely, so they get their own file, cached across releases, and the app file stays small
  build: {
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion', '@phosphor-icons/react'] } },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
