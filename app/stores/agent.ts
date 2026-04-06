import { defineStore } from 'pinia'

export type AgentStatus = 'connected' | 'disconnected' | 'connecting'

export interface DetectedProgram {
  name: string
  version: string
  format: string
  path: string
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    status: 'disconnected' as AgentStatus,
    watchFolder: '' as string,
    autoImport: true,
    lastSync: null as Date | null,
    detectedProgram: null as DetectedProgram | null,
    connectionAttempts: 0,
    maxAttempts: 3,
  }),

  getters: {
    isConnected: (state) => state.status === 'connected',
    isConnecting: (state) => state.status === 'connecting',
    isDisconnected: (state) => state.status === 'disconnected',

    statusText: (state) => {
      switch (state.status) {
        case 'connected':
          return 'Bağlı'
        case 'connecting':
          return 'Bağlanıyor...'
        case 'disconnected':
          return 'Bağlı Değil'
        default:
          return 'Bilinmiyor'
      }
    },

    statusColor: (state) => {
      switch (state.status) {
        case 'connected':
          return 'var(--accent-green)'
        case 'connecting':
          return 'var(--accent-amber)'
        case 'disconnected':
          return 'var(--accent-red)'
        default:
          return 'var(--text-muted)'
      }
    },
  },

  actions: {
    async connect() {
      if (this.status === 'connecting') return

      this.status = 'connecting'
      this.connectionAttempts++

      try {
        // Simüle edilmiş bağlantı (mock)
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Gerçek uygulamada burada agent ile WebSocket/HTTP bağlantısı kurulur
        this.status = 'connected'
        this.lastSync = new Date()
        this.connectionAttempts = 0

        console.log('Agent bağlantısı başarılı')
      } catch (error) {
        console.error('Agent bağlantı hatası:', error)

        if (this.connectionAttempts >= this.maxAttempts) {
          this.status = 'disconnected'
          this.connectionAttempts = 0
        } else {
          // Tekrar dene
          setTimeout(() => this.connect(), 3000)
        }
      }
    },

    disconnect() {
      this.status = 'disconnected'
      this.detectedProgram = null
      console.log('Agent bağlantısı kesildi')
    },

    setWatchFolder(path: string) {
      this.watchFolder = path
    },

    setAutoImport(enabled: boolean) {
      this.autoImport = enabled
    },

    detectProgram(program: DetectedProgram) {
      this.detectedProgram = program
      console.log('Program algılandı:', program.name)
    },

    async syncFiles() {
      if (this.status !== 'connected') {
        console.warn('Agent bağlı değil, senkronizasyon yapılamıyor')
        return
      }

      // Simüle edilmiş senkronizasyon
      await new Promise(resolve => setTimeout(resolve, 1000))
      this.lastSync = new Date()
      console.log('Dosyalar senkronize edildi')
    },

    async testConnection() {
      try {
        await this.connect()
        return true
      } catch (error) {
        return false
      }
    },
  },
})
