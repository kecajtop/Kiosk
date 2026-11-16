import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative, not root-absolute: the page is served under Home Assistant's
  // Ingress at a sub-path like /api/hassio_ingress/<token>/, so an absolute
  // "/assets/..." resolves to the server's real root (404, blank screen)
  // instead of the ingress-prefixed path the browser is actually at.
  base: './',
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
