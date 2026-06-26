import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunkGroups = [
  {
    name: 'react-vendor',
    packages: ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'],
  },
  {
    name: 'mui-vendor',
    packages: ['@mui', '@emotion'],
  },
  {
    name: 'query-vendor',
    packages: ['@tanstack/react-query', 'axios'],
  },
  {
    name: 'charts-vendor',
    packages: ['apexcharts', 'react-apexcharts'],
  },
  {
    name: 'maps-vendor',
    packages: ['leaflet', 'react-leaflet'],
  },
  {
    name: 'forms-vendor',
    packages: ['react-hook-form', '@mui/x-date-pickers'],
  },
  {
    name: 'realtime-vendor',
    packages: ['socket.io-client', '@react-oauth/google'],
  },
  {
    name: 'utils-vendor',
    packages: [
      'date-fns',
      'file-saver',
      'lodash.debounce',
      'lottie-react',
      'moment',
      'papaparse',
      'qs',
      'react-barcode',
      'react-dropzone',
      'react-hotkeys-hook',
      'react-icons',
    ],
  },
] as const

const manualChunks = (id: string) => {
  if (!id.includes('node_modules')) {
    return undefined
  }

  const normalizedId = id.replace(/\\/g, '/')

  for (const group of vendorChunkGroups) {
    if (group.packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`))) {
      return group.name
    }
  }

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
