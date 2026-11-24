import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore - plain JS module shared with the production server
import { albumsMiddleware } from './server/albums.js';

// Serve /api/albums/* and /albums/* from ./albums during `npm run dev` too.
const albumsDevPlugin = (): Plugin => ({
  name: 'albums-dev',
  configureServer(server) {
    server.middlewares.use(albumsMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(albumsMiddleware());
  },
});

export default defineConfig({
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), albumsDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
