/**
 * Backend API helper — tüm store'lar bu fonksiyonları kullanır.
 * Token'ı doğrudan Firebase Auth'dan alır.
 */
import { getAuth } from 'firebase/auth'

const API_BASE = import.meta.client
  ? (window as any).__NUXT__?.config?.public?.apiBase || 'https://structapp.xyz'
  : 'https://structapp.xyz'

async function getToken(): Promise<string | null> {
  try {
    const auth = getAuth()
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken()
    }
  } catch {}
  return null
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
  console.log(`[API] GET ${path}`, 'token:', headers.Authorization ? 'present' : 'MISSING')
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
  console.log(`[API] POST ${path}`, 'token:', headers.Authorization ? 'present' : 'MISSING')
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
