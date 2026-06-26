import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Keep the warning above the previous 1200 kB threshold while letting
    // Vite/Rollup decide safe lazy-loading boundaries automatically.
    chunkSizeWarningLimit: 1600,
  },
})
