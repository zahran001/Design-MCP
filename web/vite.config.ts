import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA talks to the Express API (npm run serve, default :3001). In dev we
// proxy /api there so the browser sees a single origin (no CORS dance).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
