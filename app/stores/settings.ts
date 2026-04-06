import { defineStore } from 'pinia'

export interface Settings {
  language: string
  theme: string
  defaultProgram: string
  apiKey: string
  regulations: string[]
  enabledFormats: string[]
  autoSave: boolean
  showLineNumbers: boolean
  enableMinimap: boolean
  fontSize: number
  tabSize: number
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({
    language: 'tr',
    theme: 'dark',
    defaultProgram: 'sap2000',
    apiKey: '',
    regulations: ['tbdy2018', 'asce7-22'],
    enabledFormats: ['.s2k', '.e2k', '.r3d', '.std'],
    autoSave: true,
    showLineNumbers: true,
    enableMinimap: true,
    fontSize: 14,
    tabSize: 2,
  }),

  getters: {
    // API key'in maskelenmiş hali
    maskedApiKey: (state) => {
      if (!state.apiKey) return ''
      return '•'.repeat(state.apiKey.length)
    },

    // Aktif yönetmelikler
    activeRegulations: (state) => {
      const regulationNames: Record<string, string> = {
        'tbdy2018': 'TBDY 2018',
        'asce7-22': 'ASCE 7-22',
        'eurocode8': 'Eurocode 8',
        'aci318': 'ACI 318',
      }
      return state.regulations.map(r => regulationNames[r] || r)
    },

    // Desteklenen formatların sayısı
    enabledFormatsCount: (state) => state.enabledFormats.length,

    // Program adları
    programName: (state) => {
      const programs: Record<string, string> = {
        'sap2000': 'SAP2000',
        'etabs': 'ETABS',
        'risa3d': 'RISA-3D',
        'staadpro': 'STAAD Pro',
        'opensees': 'OpenSees',
        'ansys': 'ANSYS',
      }
      return programs[state.defaultProgram] || state.defaultProgram
    },
  },

  actions: {
    setLanguage(lang: string) {
      this.language = lang
    },

    setTheme(theme: string) {
      this.theme = theme
    },

    setDefaultProgram(program: string) {
      this.defaultProgram = program
    },

    setApiKey(key: string) {
      this.apiKey = key
    },

    toggleRegulation(regulation: string) {
      const index = this.regulations.indexOf(regulation)
      if (index > -1) {
        this.regulations.splice(index, 1)
      } else {
        this.regulations.push(regulation)
      }
    },

    toggleFormat(format: string) {
      const index = this.enabledFormats.indexOf(format)
      if (index > -1) {
        this.enabledFormats.splice(index, 1)
      } else {
        this.enabledFormats.push(format)
      }
    },

    setAutoSave(enabled: boolean) {
      this.autoSave = enabled
    },

    setShowLineNumbers(enabled: boolean) {
      this.showLineNumbers = enabled
    },

    setEnableMinimap(enabled: boolean) {
      this.enableMinimap = enabled
    },

    setFontSize(size: number) {
      this.fontSize = size
    },

    setTabSize(size: number) {
      this.tabSize = size
    },

    // Ayarları localStorage'a kaydet
    saveToStorage() {
      if (typeof window !== 'undefined') {
        localStorage.setItem('structai-settings', JSON.stringify(this.$state))
      }
    },

    // Ayarları localStorage'dan yükle
    loadFromStorage() {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('structai-settings')
        if (saved) {
          const settings = JSON.parse(saved)
          this.$patch(settings)
        }
      }
    },

    // Ayarları sıfırla
    resetToDefaults() {
      this.$reset()
      this.saveToStorage()
    },
  },
})
