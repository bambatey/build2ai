import tailwindcss from "@tailwindcss/vite";
import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Önce sistem geneli config (düşük öncelik)
config({ path: '/usr/local/etc/ai-ui/.env' });
// Sonra proje yerel .env (yüksek öncelik — yerel dev için kritik)
config({ path: resolve(__dirname, '.env'), override: true });

console.log('[nuxt.config] NUXT_PUBLIC_API_BASE =', process.env.NUXT_PUBLIC_API_BASE);

export default defineNuxtConfig({
  app: {
    head: {
      title: 'Build2AI',
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
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
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
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'https://structapp.xyz'
    }
  },
  experimental: {
    writeEarlyHints: false,
  }
});