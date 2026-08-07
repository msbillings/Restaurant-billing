import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'msbillings - Restaurant POS',
        short_name: 'msbillings',
        description: 'Enterprise Restaurant Billing & POS System',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache all JS, CSS, HTML, and font files — exclude large animation frames from precache
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}', 'assets/*.png'],
        globIgnores: ['assets/frame-*.png'],
        // Increase the file size limit to 5 MB to handle larger assets
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Runtime caching for API calls
        runtimeCaching: [
          {
            // Cache GET requests to the API (menu, categories, etc.)
            urlPattern: /\/api\/(menu|categories|floors|config)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    watch: {
      ignored: ['**/android/**', '**/ios/**', '**/dist/**']
    }
  },
  optimizeDeps: {
    exclude: [],
    entries: ['index.html', 'src/**/*.{js,jsx,ts,tsx}']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['lucide-react'],
          'utils-vendor': ['axios']
        }
      }
    }
  }
})
