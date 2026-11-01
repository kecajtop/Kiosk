import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Lets `npm run dev` use the "ESPHome Files" feature against a locally
    // running backend (`ESPHOME_DIR=... node server/index.js`, default :8099).
    proxy: {
      '/api': 'http://localhost:8099'
    }
  },
  build: {
    outDir: 'dist'
  }
})
