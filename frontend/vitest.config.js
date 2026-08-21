import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config aparte de vite.config.js a proposito: las pruebas no necesitan el
// plugin de PWA, que genera el service worker y hace lento cada arranque.
//
// El proyecto vive dentro de OneDrive, donde cada lectura de archivo es
// lenta y a veces falla (archivos deshidratados a marcador de nube). De ahi
// las tres decisiones de abajo: un solo proceso, dependencias pre-empacadas
// con esbuild, y tiempos de espera amplios.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.jsx'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    deps: {
      optimizer: {
        web: {
          enabled: true,
          include: ['react', 'react-dom', 'react/jsx-dev-runtime', 'lucide-react'],
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
