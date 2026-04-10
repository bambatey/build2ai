/**
 * Global auth middleware.
 * Login sayfası hariç tüm sayfalarda auth kontrolü yapar.
 * Firebase Auth state yüklenene kadar bekler.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Login sayfasını koru(ma)
  if (to.path === '/login') return

  const { isAuthenticated, initialized } = useAuth()

  // Firebase auth state henüz yüklenmediyse bekle
  if (!initialized.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(initialized, (val) => {
        if (val) {
          stop()
          resolve()
        }
      })
    })
  }

  // Giriş yapılmamışsa login'e yönlendir
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
