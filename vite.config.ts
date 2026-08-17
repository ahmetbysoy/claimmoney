import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, cors: true },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    cors: true,
    headers: { 'X-Frame-Options': 'ALLOWALL' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react'
          if (id.includes('node_modules/framer-motion')) return 'motion'
          if (id.includes('node_modules/lightweight-charts')) return 'charts'
          if (id.includes('node_modules/canvas-confetti')) return 'confetti'
          return undefined
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
    clearMocks: true
  }
})
