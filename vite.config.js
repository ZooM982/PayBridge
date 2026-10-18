import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      // Proxy les appels /api vers le backend Express local (port 4001)
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      // Pour pointer directement vers Render en prod :
      // '/api': {
      //   target: 'https://paybridge-ilvu.onrender.com',
      //   changeOrigin: true,
      //   secure: true,
      // },
    },
  },
})
