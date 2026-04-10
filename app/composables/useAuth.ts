/**
 * Auth composable — Firebase Auth + Backend API entegrasyonu.
 *
 * Akış:
 * 1. Firebase Auth ile sign in (email/password veya Google)
 * 2. Firebase ID token al
 * 3. Backend'e POST /api/auth/login ile gönder
 * 4. Token'ı tüm API isteklerinde Authorization header'ına ekle
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { apiHandler } from '../../shared/services/api-service'

interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  initialized: boolean
}

const state = reactive<AuthState>({
  user: null,
  token: null,
  loading: false,
  initialized: false,
})

let listenerAttached = false

export function useAuth() {
  const { $firebaseAuth } = useNuxtApp()

  // ---! Firebase auth state listener (tek sefer bağla)
  if (!listenerAttached && $firebaseAuth) {
    listenerAttached = true
    onAuthStateChanged($firebaseAuth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken()
        state.user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }
        state.token = token
        apiHandler.setToken(token)

        // Login sonrası projeleri yükle
        try {
          const { useProjectStore } = await import('~/stores/project')
          const projectStore = useProjectStore()
          await projectStore.fetchProjects()
        } catch (e) {
          console.error('[Auth] Failed to load projects:', e)
        }
      } else {
        state.user = null
        state.token = null
        apiHandler.setToken(null)
      }
      state.initialized = true
    })
  }

  // ---! Email/Password ile kayıt ol
  async function signUp(email: string, password: string) {
    state.loading = true
    try {
      const credential = await createUserWithEmailAndPassword($firebaseAuth, email, password)
      const token = await credential.user.getIdToken()
      state.token = token

      // Backend'e kaydet
      await loginToBackend(token)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: getErrorMessage(error.code) }
    } finally {
      state.loading = false
    }
  }

  // ---! Email/Password ile giriş yap
  async function signIn(email: string, password: string) {
    state.loading = true
    try {
      const credential = await signInWithEmailAndPassword($firebaseAuth, email, password)
      const token = await credential.user.getIdToken()
      state.token = token

      await loginToBackend(token)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: getErrorMessage(error.code) }
    } finally {
      state.loading = false
    }
  }

  // ---! Google ile giriş yap
  async function signInWithGoogle() {
    state.loading = true
    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup($firebaseAuth, provider)
      const token = await credential.user.getIdToken()
      state.token = token

      await loginToBackend(token)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: getErrorMessage(error.code) }
    } finally {
      state.loading = false
    }
  }

  // ---! Çıkış yap
  async function signOut() {
    await firebaseSignOut($firebaseAuth)
    state.user = null
    state.token = null
  }

  // ---! Token yenile (1 saatte bir expire olur)
  async function refreshToken(): Promise<string | null> {
    if (!$firebaseAuth.currentUser) return null
    const token = await $firebaseAuth.currentUser.getIdToken(true)
    state.token = token
    return token
  }

  // ---! Backend'e login isteği at
  async function loginToBackend(token: string) {
    try {
      const config = useRuntimeConfig()
      const baseUrl = config.public.apiBase || 'http://localhost:8000'
      const resp = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: token }),
      })
      if (!resp.ok) {
        console.error('Backend login failed:', resp.status)
      }
    } catch (e) {
      console.error('Backend login error:', e)
    }
  }

  // ---! Firebase hata mesajlarını Türkçeleştir
  function getErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor',
      'auth/invalid-email': 'Geçersiz e-posta adresi',
      'auth/operation-not-allowed': 'Bu giriş yöntemi devre dışı',
      'auth/weak-password': 'Şifre en az 6 karakter olmalı',
      'auth/user-disabled': 'Bu hesap devre dışı bırakılmış',
      'auth/user-not-found': 'Kullanıcı bulunamadı',
      'auth/wrong-password': 'Hatalı şifre',
      'auth/invalid-credential': 'Hatalı e-posta veya şifre',
      'auth/too-many-requests': 'Çok fazla başarısız deneme. Lütfen bekleyin',
      'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı',
    }
    return messages[code] || 'Bir hata oluştu'
  }

  return {
    user: computed(() => state.user),
    token: computed(() => state.token),
    loading: computed(() => state.loading),
    initialized: computed(() => state.initialized),
    isAuthenticated: computed(() => !!state.user),

    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshToken,
  }
}
