/**
 * Thin client for the local Build2AI agent.
 *
 * The agent runs on http://127.0.0.1:7117 on the user's machine and
 * exposes a sandboxed view of one folder. This composable provides a
 * reactive snapshot of the connection state plus typed helpers for the
 * HTTP endpoints. It also keeps an SSE subscription open while the
 * agent is reachable so the UI can react to filesystem events without
 * polling.
 *
 * Designed as a singleton — call ``useAgent()`` from any component;
 * shared state lives in module scope.
 */

import { ref, computed, readonly } from 'vue'

export interface AgentFile {
  name: string
  path: string // relative to the agent root, forward slashes
  type: 'file' | 'folder'
  size: number | null
  modified: string | null
  is_text: boolean
}

export interface AgentEvent {
  type: 'created' | 'modified' | 'deleted' | 'moved' | 'hello' | 'ping'
  path?: string
  destPath?: string
  ts: number
}

const DEFAULT_BASE = 'http://127.0.0.1:7117'

const baseUrl = ref(DEFAULT_BASE)
const connected = ref(false)
const checking = ref(false)
const root = ref<string | null>(null)
const entries = ref<AgentFile[]>([])
const lastError = ref<string | null>(null)
const lastEvent = ref<AgentEvent | null>(null)

let eventSource: EventSource | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

const eventListeners = new Set<(e: AgentEvent) => void>()

async function request<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl.value}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Non-JSON body — keep as text in the error path below.
  }
  if (!res.ok) {
    const msg = (data && data.error) || text || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

async function checkHealth(): Promise<boolean> {
  if (checking.value) return connected.value
  checking.value = true
  try {
    await request('/health')
    connected.value = true
    lastError.value = null
    return true
  } catch (err: any) {
    connected.value = false
    lastError.value = err?.message ?? String(err)
    return false
  } finally {
    checking.value = false
  }
}

async function fetchConfig(): Promise<void> {
  try {
    const data = await request<{ root: string | null }>('/config')
    root.value = data.root
  } catch (err: any) {
    lastError.value = err?.message ?? String(err)
  }
}

async function refreshFiles(): Promise<void> {
  try {
    const data = await request<{ root: string | null; entries: AgentFile[] }>(
      '/files',
    )
    root.value = data.root
    entries.value = data.entries.filter(e => e.type === 'file')
  } catch (err: any) {
    lastError.value = err?.message ?? String(err)
    entries.value = []
  }
}

async function readFile(path: string): Promise<string> {
  const data = await request<{ path: string; content: string }>(
    `/file?path=${encodeURIComponent(path)}`,
  )
  return data.content
}

async function writeFile(path: string, content: string): Promise<AgentFile> {
  const data = await request<{ file: AgentFile }>('/file', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  })
  return data.file
}

async function deleteFile(path: string): Promise<void> {
  await request(`/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

async function convertSdb(path: string): Promise<void> {
  await request('/convert/sdb', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

async function setRoot(newRoot: string | null): Promise<void> {
  const data = await request<{ root: string | null }>('/config', {
    method: 'POST',
    body: JSON.stringify({ root: newRoot }),
  })
  root.value = data.root
  await refreshFiles()
}

function openEventStream() {
  closeEventStream()
  if (typeof window === 'undefined') return
  try {
    const es = new EventSource(`${baseUrl.value}/events`)
    es.onmessage = (e: MessageEvent) => {
      try {
        const payload: AgentEvent = JSON.parse(e.data)
        lastEvent.value = payload
        if (payload.type !== 'ping' && payload.type !== 'hello') {
          // A real change → refresh listing in the background.
          refreshFiles()
        }
        eventListeners.forEach(fn => {
          try {
            fn(payload)
          } catch {
            // ignore listener errors
          }
        })
      } catch {
        // ignore malformed events
      }
    }
    es.onerror = () => {
      // The browser will auto-reconnect; flip connected so the UI
      // shows a yellow/red state until /health succeeds again.
      connected.value = false
    }
    eventSource = es
  } catch {
    eventSource = null
  }
}

function closeEventStream() {
  if (eventSource) {
    try {
      eventSource.close()
    } catch {
      // ignore
    }
    eventSource = null
  }
}

let initialised = false

/**
 * Initialise the singleton. Idempotent — first call sets up polling
 * + SSE; later calls just hand back the shared state.
 */
function init() {
  if (initialised) return
  initialised = true
  if (typeof window === 'undefined') return

  const tick = async () => {
    const ok = await checkHealth()
    if (ok) {
      if (root.value === null) await fetchConfig()
      if (entries.value.length === 0) await refreshFiles()
      if (!eventSource) openEventStream()
    } else {
      closeEventStream()
    }
  }

  // First check immediately, then poll. Slow down when agent is not available.
  tick()
  let failCount = 0
  const startPolling = () => {
    pollTimer = setInterval(async () => {
      const ok = await checkHealth()
      if (ok) {
        failCount = 0
        if (root.value === null) await fetchConfig()
        if (entries.value.length === 0) await refreshFiles()
        if (!eventSource) openEventStream()
      } else {
        closeEventStream()
        failCount++
        // After 3 failures, slow down to 30s to reduce console noise
        if (failCount === 3 && pollTimer) {
          clearInterval(pollTimer)
          pollTimer = setInterval(() => tick(), 30000)
        }
      }
    }, 4000)
  }
  startPolling()

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer)
    closeEventStream()
  })
}

export function useAgent() {
  init()
  return {
    // state
    baseUrl: readonly(baseUrl),
    connected: readonly(connected),
    checking: readonly(checking),
    root: readonly(root),
    entries: readonly(entries),
    lastError: readonly(lastError),
    lastEvent: readonly(lastEvent),

    // derived
    hasRoot: computed(() => !!root.value),
    fileCount: computed(() => entries.value.length),

    // actions
    checkHealth,
    refreshFiles,
    readFile,
    writeFile,
    deleteFile,
    convertSdb,
    setRoot,
    onEvent(fn: (e: AgentEvent) => void) {
      eventListeners.add(fn)
      return () => eventListeners.delete(fn)
    },
  }
}
