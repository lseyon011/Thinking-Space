import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Electron and Capacitor builds use relative paths so assets load from the app dir.
// For web, use the /thinking-space/ prefix.
const buildTarget = process.env.BUILD_TARGET // 'electron' | 'capacitor' | undefined
const isLocalBuild = buildTarget === 'electron' || buildTarget === 'capacitor'

export default defineConfig({
  base: isLocalBuild ? './' : '/thinking-space/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
