import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    open: false,
    proxy: {
      // Lets the frontend call '/api/...' directly in dev without
      // needing VITE_API_URL set, since the backend runs on :4000.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: true,
    port: 4173
  }
})
