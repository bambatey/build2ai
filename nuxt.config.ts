import tailwindcss from "@tailwindcss/vite";
import { config } from 'dotenv';

config({ path: '/usr/local/etc/ai-ui/.env' });

export default defineNuxtConfig({
  app: {
    head: {
      title: 'AI UI',
      meta: [
        { name: 'description', content: 'AI Uygulamaları - Ödeal' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      ]
    }
  },
  devServer: {
    port: 3001,
    host: '0.0.0.0'
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: [
    '@nuxt/icon',
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@nuxt/ui',
  ],
  pinia: {
    storesDirs: ['./app/stores/**'],
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
    server: {
      // proxy: {
      //   '/api/call-center-insights': {
      //     target: 'http://localhost:8016',
      //     changeOrigin: true,
      //     rewrite: (path) => path.replace('/api/call-center-insights', '')
      //   }
      // }
    }
  },
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    }
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE
    }
  },
  experimental: {
    writeEarlyHints: false,
  }
});