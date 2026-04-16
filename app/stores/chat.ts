import { defineStore } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { apiGet, apiPost, apiPut, API_BASE } from '~/utils/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  diff?: {
    oldValue: string
    newValue: string
    lineNumber: number
  }[]
  isLoading?: boolean
}

export interface QuickCommand {
  id: string
  label: string
  prompt: string
  icon?: string
}

export interface ChatSession {
  id: string
  projectId: string
  name: string
  messages: ChatMessage[]
  createdAt: Date
  lastActive: Date
}

// API_BASE import edildi

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as ChatMessage[],
    isLoading: false,
    totalMessageCount: 0,
    totalSessionCount: 0,
    popupAutoOpen: false,   // workspace'te mount olduğunda açılsın mı (yeni proje için)
    // Popup açık/kapalı durumu — bottom-right-bar konumlandırması için
    popupOpen: false,
    drawingPopupOpen: false,
    model: '' as string,  // Boş = backend'in default modeli kullanılır
    quickCommands: [
      {
        id: '1',
        label: 'Yükleri kontrol et',
        prompt: 'Bu modeldeki tüm yük durumlarını ve kombinasyonlarını kontrol et. TBDY 2018\'e uyumlu mu?',
        icon: 'weight',
      },
      {
        id: '2',
        label: 'Kesitleri optimize et',
        prompt: 'Kapasite oranlarına bakarak kesitleri optimize et. Hangi elemanlar küçültülebilir veya büyütülmeli?',
        icon: 'zap',
      },
      {
        id: '3',
        label: 'Deprem analizi yap',
        prompt: 'Deprem yüklerini analiz et. DD-2 için SDS ve SD1 değerlerini kontrol et.',
        icon: 'activity',
      },
      {
        id: '4',
        label: 'TBDY 2018 uyumu',
        prompt: 'Bu modeli TBDY 2018 yönetmeliğine göre kontrol et. Eksik veya hatalı parametreler var mı?',
        icon: 'check-circle',
      },
      {
        id: '5',
        label: 'Model özeti çıkar',
        prompt: 'Bu modelin detaylı özetini çıkar: düğüm sayısı, eleman sayısı, malzemeler, yükler, vb.',
        icon: 'file-text',
      },
      {
        id: '6',
        label: 'Deplasman kontrolü',
        prompt: 'Göreli kat ötelemelerini kontrol et. TBDY 2018 sınır değerlerini aşan katlar var mı?',
        icon: 'move',
      },
      {
        id: '7',
        label: 'Malzeme özellikleri',
        prompt: 'Modelde kullanılan beton ve çelik malzemelerinin özelliklerini listele.',
        icon: 'package',
      },
      {
        id: '8',
        label: 'Kritik kesitler',
        prompt: 'En yüksek kapasite oranına sahip elemanları bul ve detaylarını göster.',
        icon: 'alert-triangle',
      },
    ] as QuickCommand[],
    sessions: [] as ChatSession[],
    activeSessionId: null as string | null,
  }),

  getters: {
    activeSession(state): ChatSession | null {
      if (!state.activeSessionId) return null
      return state.sessions.find(s => s.id === state.activeSessionId) ?? null
    },

    sessionsByProject: (state) => (projectId: string): ChatSession[] => {
      return state.sessions
        .filter(s => s.projectId === projectId)
        .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
    },

    messageCount: (state) => state.messages.length,

    lastMessage: (state) => {
      return state.messages[state.messages.length - 1]
    },

    userMessages: (state) => {
      return state.messages.filter(m => m.role === 'user')
    },

    assistantMessages: (state) => {
      return state.messages.filter(m => m.role === 'assistant')
    },
  },

  actions: {
    async sendMessage(content: string) {
      const projectStore = useProjectStore()
      if (projectStore.pendingNewProjectName && !projectStore.activeProjectId) {
        const project = await projectStore.commitPendingProject()
        if (project) {
          await this.createChat(project.id)
        }
      }

      // Kullanıcı mesajı ekle
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      this.messages.push(userMessage)

      // Loading state başlat
      this.isLoading = true

      // AI mesajı placeholder
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      }
      this.messages.push(aiMessage)

      // Aktif oturum güncelle — ismi ilk mesajdan türet
      const active = this.sessions.find(s => s.id === this.activeSessionId)
      if (active) {
        active.lastActive = new Date()
        if (active.name === 'Yeni Sohbet' && content.trim()) {
          const newName = content.trim().slice(0, 40)
          active.name = newName
          // Backend'e de yaz
          const projectStore = useProjectStore()
          if (projectStore.activeProjectId) {
            apiPut(
              `/api/chat/sessions/${active.id}/rename?project_id=${projectStore.activeProjectId}`,
              { name: newName }
            ).catch(() => {})
          }
        }
      }

      // ---! Backend'e streaming istek at
      await this.streamFromBackend(aiMessage.id, content)
    },

    async streamFromBackend(messageId: string, userPrompt: string) {
      const projectStore = useProjectStore()
      const activeSession = this.sessions.find(s => s.id === this.activeSessionId)

      // Mesaj geçmişini hazırla (son 20 mesaj)
      const recentMessages = this.messages
        .filter(m => !m.isLoading)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      // ---! Dosya içeriğini al
      // 1. Editörde açık dosya varsa onu kullan
      // 2. Yoksa projedeki ilk dosyanın content'ini kullan
      let fileContext = projectStore.modifiedContent || projectStore.originalContent || ''

      if (!fileContext && projectStore.activeProject) {
        const projectFiles = projectStore.activeProject.files || []
        const firstFile = projectFiles.find(f => f.type === 'file' && f.content)
        if (firstFile?.content) {
          fileContext = firstFile.content
        }
      }

      console.log('[Chat] File context:', fileContext ? `${fileContext.length} chars` : 'yok')

      const body = {
        session_id: this.activeSessionId || 'temp',
        project_id: projectStore.activeProjectId || 'temp',
        messages: recentMessages,
        model: this.model,
        file_context: fileContext || undefined,
      }

      try {
        // Token'ı useAuth state'inden al
        const { token } = useAuth()
        const authToken = token.value

        console.log('[Chat] Streaming request:', API_BASE, 'token:', authToken ? 'present' : 'missing')

        const response = await fetch(`${API_BASE}/api/llm-proxy/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(body),
        })

        console.log('[Chat] Response status:', response.status)

        if (!response.ok) {
          throw new Error(`API hatası: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Yanıt body\'si yok')
        }

        // SSE stream oku
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            let jsonStr = line
            if (line.startsWith('data: ')) {
              jsonStr = line.slice(6)
            }

            if (!jsonStr.trim()) continue

            try {
              const parsed = JSON.parse(jsonStr)

              if (parsed.type === 'delta' && parsed.content) {
                fullContent += parsed.content
                // Mesajı güncelle
                const msgIndex = this.messages.findIndex(m => m.id === messageId)
                if (msgIndex !== -1) {
                  this.messages[msgIndex].content = fullContent
                }
              }

              // AI dosyayı güncelledi — otomatik uygula
              if (parsed.type === 'file_update' && parsed.content) {
                const projectStore = useProjectStore()
                const updatedContent = parsed.content

                // Tüm store referanslarını güncelle
                projectStore.originalContent = updatedContent
                projectStore.modifiedContent = updatedContent
                if (projectStore.currentFile) {
                  projectStore.currentFile.content = updatedContent
                }
                if (projectStore.activeProject) {
                  const file = projectStore.activeProject.files.find(
                    f => f.id === projectStore.currentFile?.id
                  )
                  if (file) file.content = updatedContent
                }

                // Backend'e kaydet
                if (projectStore.activeProjectId && projectStore.currentFile?.id) {
                  projectStore.saveFileToBackend(
                    projectStore.activeProjectId,
                    projectStore.currentFile.id,
                    updatedContent,
                  ).catch(e => console.error('[Chat] Dosya kaydetme hatası:', e))
                }

                console.log('[Chat] Dosya otomatik güncellendi:', updatedContent.length, 'karakter')
              }

              if (parsed.type === 'finish' || parsed.type === 'done') {
                if (parsed.error) {
                  const msgIndex = this.messages.findIndex(m => m.id === messageId)
                  if (msgIndex !== -1) {
                    this.messages[msgIndex].content = fullContent || `Hata: ${parsed.error}`
                  }
                }
                break
              }
            } catch {
              // JSON parse hatası, devam et
            }
          }
        }

        // Loading kapat
        const msgIndex = this.messages.findIndex(m => m.id === messageId)
        if (msgIndex !== -1) {
          this.messages[msgIndex].isLoading = false
          if (!this.messages[msgIndex].content) {
            this.messages[msgIndex].content = 'Yanıt alınamadı.'
          }
        }
      } catch (error: any) {
        console.error('Chat streaming hatası:', error)
        const msgIndex = this.messages.findIndex(m => m.id === messageId)
        if (msgIndex !== -1) {
          this.messages[msgIndex].content = `Bağlantı hatası: ${error.message}`
          this.messages[msgIndex].isLoading = false
        }
      }

      this.isLoading = false
    },

    clearMessages() {
      this.messages = []
    },

    removeMessage(id: string) {
      this.messages = this.messages.filter(m => m.id !== id)
    },

    setModel(model: string) {
      this.model = model
    },

    async hydrate() {
      // Hafif hydrate: sadece özet istatistikleri çek (tek istek).
      // Session içerikleri/mesajlar tembel yüklenir (AppSidebar ya da
      // workspace açıldığında fetchSessions + fetchMessages çağrılır).
      await this.fetchStats()
    },

    async fetchStats() {
      try {
        const stats = await apiGet<{ session_count: number; message_count: number }>(
          '/api/chat/stats',
        )
        this.totalMessageCount = stats?.message_count ?? 0
        this.totalSessionCount = stats?.session_count ?? 0
      } catch (e) {
        console.error('[Chat] fetchStats error:', e)
      }
    },

    // ---! Backend'den oturumları yükle ve isimleri düzelt
    async fetchSessions(projectId: string) {
      try {
        const sessions = await apiGet<any[]>(`/api/projects/${projectId}/chat/sessions`)
        for (const s of (sessions || [])) {
          if (!this.sessions.find(existing => existing.id === s.id)) {
            let sessionName = s.name || 'Sohbet'

            // İsim "Yeni Sohbet" ise mesajlardan türet
            if (sessionName === 'Yeni Sohbet') {
              try {
                const messages = await apiGet<any[]>(`/api/chat/sessions/${s.id}/messages?project_id=${projectId}`)
                const firstUserMsg = (messages || []).find((m: any) => m.role === 'user')
                if (firstUserMsg?.content) {
                  sessionName = firstUserMsg.content.trim().slice(0, 40)
                }
              } catch {}
            }

            this.sessions.push({
              id: s.id,
              projectId: s.project_id || projectId,
              name: sessionName,
              messages: [],
              createdAt: new Date(s.created_at),
              lastActive: new Date(s.last_active),
            })
          }
        }
      } catch (e) {
        console.error('[Chat] fetchSessions error:', e)
      }
    },

    // ---! Backend'den mesajları yükle
    async fetchMessages(projectId: string, sessionId: string) {
      try {
        const messages = await apiGet<any[]>(`/api/chat/sessions/${sessionId}/messages?project_id=${projectId}`)
        const session = this.sessions.find(s => s.id === sessionId)
        if (session) {
          session.messages = (messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at),
            diff: m.diff ? m.diff.map((d: any) => ({
              lineNumber: d.line_number ?? d.lineNumber,
              oldValue: d.old_value ?? d.oldValue,
              newValue: d.new_value ?? d.newValue,
            })) : undefined,
          }))
          if (this.activeSessionId === sessionId) {
            this.messages = session.messages
          }
        }
      } catch (e) {
        console.error('[Chat] fetchMessages error:', e)
      }
    },

    // ---! Backend'de chat oturumu oluştur
    async createChat(projectId: string, name = 'Yeni Sohbet') {
      try {
        const result = await apiPost<any>(`/api/projects/${projectId}/chat/sessions`, { name })
        const session: ChatSession = {
          id: result.id,
          projectId,
          name: result.name || name,
          messages: [],
          createdAt: new Date(result.created_at || Date.now()),
          lastActive: new Date(result.last_active || Date.now()),
        }
        this.sessions.push(session)
        this.activeSessionId = session.id
        this.messages = session.messages
        console.log('[Chat] Session created:', session.id)
        return session
      } catch (e) {
        console.error('[Chat] createChat error:', e)
        // Fallback: local session
        const session: ChatSession = {
          id: crypto.randomUUID(),
          projectId,
          name,
          messages: [],
          createdAt: new Date(),
          lastActive: new Date(),
        }
        this.sessions.push(session)
        this.activeSessionId = session.id
        this.messages = session.messages
        return session
      }
    },

    async switchChat(id: string) {
      const session = this.sessions.find(s => s.id === id)
      if (!session) return
      this.activeSessionId = id

      // Mesajlar yüklenmemişse backend'den çek
      if (session.messages.length === 0) {
        await this.fetchMessages(session.projectId, id)
      } else {
        this.messages = session.messages
      }
    },

    deleteChat(id: string) {
      this.sessions = this.sessions.filter(s => s.id !== id)
      if (this.activeSessionId === id) {
        this.activeSessionId = null
        this.messages = []
      }
    },

    renameChat(id: string, name: string) {
      const session = this.sessions.find(s => s.id === id)
      if (!session) return
      session.name = name
    },

    async ensureSessionForProject(projectId: string) {
      const active = this.activeSessionId
        ? this.sessions.find(s => s.id === this.activeSessionId)
        : null

      if (active && active.projectId === projectId) return

      // Backend'den oturumları çek
      await this.fetchSessions(projectId)

      const existing = this.sessions
        .filter(s => s.projectId === projectId)
        .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())[0]

      if (existing) {
        await this.switchChat(existing.id)
      } else {
        await this.createChat(projectId)
      }
    },
  },
})
