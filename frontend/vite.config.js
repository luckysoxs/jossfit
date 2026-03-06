import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Fitness Jos',
        short_name: 'FitnessJos',
        description: 'Tu plataforma de entrenamiento y rendimiento',
        theme_color: '#f97316',
        background_color: '#030712',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
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
      '/notifications': 'http://localhost:8000',
    },
  },
})
