import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: {
      // Map frontend-friendly endpoints to backend API during development
      // '/query' -> 'http://localhost:8000/api/v1/query'
      // '/ingest' -> 'http://localhost:8000/api/v1/ingest'
      '/query': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/query/, '/api/v1/query'),
      },
      '/ingest': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, '/api/v1/ingest'),
      },
      // Proxy any /api/* to backend as well
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
