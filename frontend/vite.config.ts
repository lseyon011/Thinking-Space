import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// When building for Electron, use relative paths so assets load from the app dir.
// For web, use the /ltm-pilot/ prefix.
const isElectronBuild = process.env.BUILD_TARGET === 'electron'

export default defineConfig({
  base: isElectronBuild ? './' : '/ltm-pilot/',
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
