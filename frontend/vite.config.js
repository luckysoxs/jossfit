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
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
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
