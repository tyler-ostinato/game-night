import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Test mode (npm run dev:test) talks to the test API on 3002.
const apiPort = process.env.API_PORT ?? '3001'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': `http://localhost:${apiPort}` } },
})
