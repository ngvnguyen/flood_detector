import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      },
      '/health': {
        target: 'http://localhost:8000'
      },
      '/api': {
        target: 'http://localhost:8000'
      }
    }
  }
});
