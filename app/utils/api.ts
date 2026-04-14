/**
 * Backend API helper — tüm store'lar bu fonksiyonları kullanır.
 * Token'ı doğrudan Firebase Auth'dan alır.
 *
 * Sayfa refresh sonrası Firebase auth state restore async — ilk
 * `currentUser` null olabilir. ``authReady()`` ilk auth state'i
 * (kullanıcı varsa user, yoksa null) bekleyen tek-seferlik bir
 * promise döner; aksi halde her API isteği yarış koşulundan
 * dolayı 401 alır.
 */
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

const API_BASE = import.meta.client
  ? (window as any).__NUXT__?.config?.public?.apiBase || 'https://structapp.xyz'
  : 'https://structapp.xyz'

let _authReadyPromise: Promise<User | null> | null = null

function authReady(): Promise<User | null> {
  if (_authReadyPromise) return _authReadyPromise
  _authReadyPromise = new Promise((resolve) => {
    try {
      const auth = getAuth()
      if (auth.currentUser) {
        resolve(auth.currentUser)
        return
      }
      // İlk auth state değişikliğini yakala — restore tamamlanmıştır
      const unsub = onAuthStateChanged(
        auth,
        (user) => { unsub(); resolve(user) },
        () => { resolve(null) },
      )
      // Güvenlik: 5 sn timeout — sonsuz bekleme olmasın
      setTimeout(() => resolve(null), 5000)
    } catch {
      resolve(null)
    }
  })
  return _authReadyPromise
}

async function getToken(): Promise<string | null> {
  const user = await authReady()
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    return null
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const headers = await authHeaders()
  console.log(`[API] GET ${API_BASE}${path}`, 'token:', headers.Authorization ? 'present' : 'MISSING')
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers,
  })
  console.log(`[API] GET ${path} →`, response.status)
  if (!response.ok) throw new Error(`API GET ${path}: ${response.status}`)
  const json = await response.json()
  return json.data ?? json
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const headers = await authHeaders()
  console.log(`[API] POST ${API_BASE}${path}`, 'token:', headers.Authorization ? 'present' : 'MISSING')
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  console.log(`[API] POST ${path} →`, response.status)
  if (!response.ok) {
    const text = await response.text()
    console.error(`[API] POST ${path} error:`, text)
    throw new Error(`API POST ${path}: ${response.status}`)
  }
  const json = await response.json()
  return json.data ?? json
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error(`API PUT ${path}: ${response.status}`)
  const json = await response.json()
  return json.data ?? json
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!response.ok) throw new Error(`API DELETE ${path}: ${response.status}`)
}

export async function apiPostFormData<T = any>(path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!response.ok) throw new Error(`API POST ${path}: ${response.status}`)
  const json = await response.json()
  return json.data ?? json
}

export { API_BASE }
