<template>
  <div class="login-page">
    <!-- Sol: Form -->
    <div class="login-form-side">
      <div class="login-form-container">
        <!-- Logo -->
        <div class="login-header">
          <div class="login-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--accent-blue)"/>
              <path d="M8 22V10h6.5c1.3 0 2.3.35 3 1.05.7.7 1.05 1.55 1.05 2.55 0 .75-.2 1.4-.6 1.95-.4.55-.9.9-1.55 1.1v.1c.8.15 1.45.55 1.95 1.2.5.65.75 1.4.75 2.25 0 1.15-.4 2.1-1.2 2.85-.8.65-1.85.95-3.15.95H8zm2.8-7.2h3.3c.6 0 1.1-.18 1.45-.55.35-.37.55-.82.55-1.35 0-.55-.2-1-.55-1.35-.35-.35-.85-.55-1.45-.55H10.8v3.8zm0 5h3.6c.7 0 1.25-.2 1.65-.6.4-.4.6-.9.6-1.5s-.2-1.1-.6-1.5c-.4-.4-.95-.6-1.65-.6H10.8v4.2zM22 22l3-12h.5L22 22z" fill="white"/>
            </svg>
            <span class="login-logo-text">Build2AI</span>
          </div>
          <p class="login-subtitle">Yapısal Mühendislik AI Asistanı</p>
        </div>

        <!-- Hata mesajı -->
        <div v-if="errorMsg" class="login-error slide-in">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-red)" stroke-width="1.5"/>
            <path d="M8 4.5v4M8 10.5v.5" stroke="var(--accent-red)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ errorMsg }}
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="form-group">
            <label class="form-label">E-posta</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="ornek@email.com"
              class="input"
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Şifre</label>
            <input
              v-model="password"
              type="password"
              required
              minlength="6"
              placeholder="En az 6 karakter"
              class="input"
              autocomplete="current-password"
            />
          </div>

          <button type="submit" :disabled="loading" class="btn btn-primary login-btn">
            <svg v-if="loading" class="spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="32" stroke-dashoffset="8" stroke-linecap="round"/>
            </svg>
            {{ isSignUp ? 'Kayıt Ol' : 'Giriş Yap' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="login-divider">
          <span>veya</span>
        </div>

        <!-- Google -->
        <button @click="handleGoogleSignIn" :disabled="loading" class="btn btn-secondary login-btn">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google ile devam et
        </button>

        <!-- Toggle -->
        <p class="login-toggle">
          {{ isSignUp ? 'Zaten hesabınız var mı?' : 'Hesabınız yok mu?' }}
          <button @click="isSignUp = !isSignUp; errorMsg = ''" class="login-toggle-link">
            {{ isSignUp ? 'Giriş Yap' : 'Kayıt Ol' }}
          </button>
        </p>
      </div>
    </div>

    <!-- Sağ: Branding -->
    <div class="login-brand-side">
      <div class="login-brand-content">
        <div class="login-brand-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 20h20M5 20V8l7-5 7 5v12M9 20v-6h6v6"/>
            <rect x="9" y="9" width="6" height="4" rx="0.5"/>
          </svg>
        </div>
        <h2 class="login-brand-title">Yapısal modellerinizi<br/>AI ile analiz edin</h2>
        <p class="login-brand-desc">
          SAP2000, ETABS ve RISA-3D modellerinizi yükleyin.
          TBDY 2018 uyumluluğunu kontrol edin, kesit optimizasyonu yapın.
        </p>
        <div class="login-brand-features">
          <div class="login-feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="var(--accent-green)" stroke-width="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="var(--accent-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>TBDY 2018 & ASCE 7-22 kontrolleri</span>
          </div>
          <div class="login-feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="var(--accent-green)" stroke-width="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="var(--accent-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>AI destekli kesit optimizasyonu</span>
          </div>
          <div class="login-feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="var(--accent-green)" stroke-width="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="var(--accent-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>.s2k, .e2k, .r3d, .std dosya desteği</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})

const router = useRouter()
const { signIn, signUp, signInWithGoogle, loading, isAuthenticated } = useAuth()

const email = ref('')
const password = ref('')
const isSignUp = ref(false)
const errorMsg = ref('')

watch(isAuthenticated, (val) => {
  if (val) router.push('/')
}, { immediate: true })

async function handleSubmit() {
  errorMsg.value = ''
  const result = isSignUp.value
    ? await signUp(email.value, password.value)
    : await signIn(email.value, password.value)

  if (!result.success) {
    errorMsg.value = result.error || 'Bir hata oluştu'
  } else {
    router.push('/')
  }
}

async function handleGoogleSignIn() {
  errorMsg.value = ''
  const result = await signInWithGoogle()
  if (!result.success) {
    errorMsg.value = result.error || 'Bir hata oluştu'
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  min-height: 100vh;
  background-color: var(--bg-primary);
}

/* Sol taraf - Form */
.login-form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-form-container {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.login-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.login-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.login-logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
}

.login-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.login-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--accent-red);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.login-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: var(--border-default);
}

.login-divider span {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.login-toggle {
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.login-toggle-link {
  color: var(--accent-blue);
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 0.25rem;
  font-family: inherit;
  font-size: inherit;
  transition: color var(--transition-smooth);
}

.login-toggle-link:hover {
  color: #60a5fa;
}

/* Sağ taraf - Branding */
.login-brand-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-default);
}

.login-brand-content {
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.login-brand-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 16px;
}

.login-brand-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1.3;
}

.login-brand-desc {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.login-brand-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.login-feature {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 900px) {
  .login-brand-side {
    display: none;
  }
}
</style>
