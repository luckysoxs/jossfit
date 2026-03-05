import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/exercises': 'http://localhost:8000',
      '/routines': 'http://localhost:8000',
      '/workouts': 'http://localhost:8000',
      '/body-metrics': 'http://localhost:8000',
      '/nutrition': 'http://localhost:8000',
      '/sleep': 'http://localhost:8000',
      '/supplements': 'http://localhost:8000',
      '/goals': 'http://localhost:8000',
      '/ai': 'http://localhost:8000',
      '/dashboard': 'http://localhost:8000',
      '/store': 'http://localhost:8000',
      '/benefits': 'http://localhost:8000',
    },
  },
})
