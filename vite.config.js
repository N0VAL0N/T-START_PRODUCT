import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// В dev весь /api проксируется на бэкенд (server/index.mjs, порт 8787).
// Бэкенд держит токены и проксирует T-Invest + Yandex AI (нет CORS, управляемый TLS).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})