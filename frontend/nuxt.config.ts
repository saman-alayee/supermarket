// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  ssr: false,

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    '@nuxt/icon',
  ],

  // Keep URLs without trailing slash (matches links + avoids nginx dir redirects)
  router: {
    options: {
      strict: false,
    },
  },

  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/'],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      title: 'KIAA KALA',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'فروشگاه اینترنتی KIAA KALA - خرید آنلاین و ارسال به درب منزل' },
        { name: 'theme-color', content: '#16a34a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      style: [
        {
          innerHTML:
            'body{margin:0;background:#f9fafb}#__nuxt:empty{display:flex;min-height:100vh;align-items:center;justify-content:center}#__nuxt:empty::after{content:"";width:2.5rem;height:2.5rem;border:3px solid #16a34a;border-top-color:transparent;border-radius:9999px;animation:kk-spin .8s linear infinite}@keyframes kk-spin{to{transform:rotate(360deg)}}',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/pwa-192.png' },
        {
          rel: 'stylesheet',
          href: 'https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.css',
        },
      ],
      script: [
        {
          src: 'https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.js',
          defer: true,
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  icon: {
    size: '20px',
    class: 'icon',
    mode: 'svg',
    serverBundle: {
      collections: ['lucide', 'heroicons'],
    },
  },

  runtimeConfig: {
    public: {
      // Local: set NUXT_PUBLIC_API_BASE in .env (http://localhost:3001/api)
      // Production: usually /api behind nginx
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
      neshanApiKey: process.env.NUXT_PUBLIC_NESHAN_API_KEY || '',
    },
  },

  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/',
      name: 'KIAA KALA',
      short_name: 'KIAA KALA',
      description: 'فروشگاه اینترنتی KIAA KALA',
      theme_color: '#16a34a',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'fa',
      dir: 'rtl',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,ttf}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: /\/api\/(categories|products)/,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },

  compatibilityDate: '2024-12-01',
});
