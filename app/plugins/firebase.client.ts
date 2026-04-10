/**
 * Firebase Client SDK — Nuxt plugin (client-only).
 * Auth instance'ını app-wide provide eder.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

export default defineNuxtPlugin(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyD1ZuIbqf2iJUOeprvItelsuD2c0-IqDc4',
    authDomain: 'build2ai.firebaseapp.com',
    projectId: 'build2ai',
    storageBucket: 'build2ai.firebasestorage.app',
    messagingSenderId: '203799446680',
    appId: '1:203799446680:web:f4b3e88e9bdf660e233ced',
    measurementId: 'G-4V165Y2QWF',
  }

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)

  return {
    provide: {
      firebaseApp: app,
      firebaseAuth: auth,
    },
  }
})
