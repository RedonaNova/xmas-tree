import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, run the API server too (`npm start` with a DATABASE_URL);
// /api and /images are proxied to it.
const API_TARGET = process.env.API_TARGET || 'http://localhost:8080';

export default defineConfig({
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': API_TARGET,
      '/images': API_TARGET,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
