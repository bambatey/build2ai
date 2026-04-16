/**
 * Yapısal analiz store — SAP2000 mantığı: analiz bir kere çalışır,
 * her tablo (displacements, reactions, modes, forces) ayrı endpoint'ten
 * lazy yüklenir. İlk tıklamada fetch, sonrasında cache'den okunur.
 */
import { defineStore } from 'pinia'

import {
  type AnalysisListItem,
  type AnalysisOptions,
  type AnalysisStatus,
  type ElementForces,
  type Mode,
  type ModelPreview,
  type NodeDisplacement,
  type Reaction,
  deleteAnalysis as apiDelete,
  getAnalysis,
  getDisplacements,
  getElementForces,
  getModes,
  getReactions,
  listAnalyses,
  previewModel,
  triggerAnalysis,
} from '~/utils/analysisApi'

type TableKind = 'displacements' | 'reactions' | 'modes' | 'forces'

interface FileAnalyses {
  history: AnalysisListItem[]
  currentId: string | null
  status: AnalysisStatus | null
  // Tablo verileri — başta boş, tab açılınca doldurulur
  displacements: NodeDisplacement[]
  reactions: Reaction[]
  modes: Mode[]
  elementForces: ElementForces[]
  // "bu analiz id'si için hangi tablolar yüklendi" cache'i
  loadedFor: Partial<Record<TableKind, string>>
  loading: Partial<Record<TableKind, boolean>>
  selectedLoadCase: string | null
  preview: ModelPreview | null
}

function emptyFileState(): FileAnalyses {
  return {
    history: [],
    currentId: null,
    status: null,
    displacements: [],
    reactions: [],
    modes: [],
    elementForces: [],
    loadedFor: {},
    loading: {},
    selectedLoadCase: null,
    preview: null,
  }
}

export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    byFile: {} as Record<string, FileAnalyses>,
    isRunning: false,
    runningError: '' as string,
  }),

  getters: {
    current(state) {
      return (fileId: string): FileAnalyses => {
        return state.byFile[fileId] ?? emptyFileState()
      }
    },

    availableLoadCases() {
      return (fileId: string): string[] => {
        const s = this.current(fileId)
        // Öncelik: summary.available_cases (tablo yüklenmesini beklemez).
        const fromSummary = s.status?.summary?.available_cases ?? []
        if (fromSummary.length > 0) return [...fromSummary].sort()
        // Fallback: yüklenmiş tablolardan türetilir.
        const set = new Set<string>()
        s.displacements.forEach(d => set.add(d.load_case))
        s.reactions.forEach(r => set.add(r.load_case))
        s.elementForces.forEach(f => set.add(f.load_case))
        return [...set].sort()
      }
    },

    filteredDisplacements() {
      return (fileId: string): NodeDisplacement[] => {
        const s = this.current(fileId)
        if (!s.selectedLoadCase) return s.displacements
        return s.displacements.filter(d => d.load_case === s.selectedLoadCase)
      }
    },

    filteredReactions() {
      return (fileId: string): Reaction[] => {
        const s = this.current(fileId)
        if (!s.selectedLoadCase) return s.reactions
        return s.reactions.filter(r => r.load_case === s.selectedLoadCase)
      }
    },

    filteredElementForces() {
      return (fileId: string): ElementForces[] => {
        const s = this.current(fileId)
        if (!s.selectedLoadCase) return s.elementForces
        return s.elementForces.filter(f => f.load_case === s.selectedLoadCase)
      }
    },

    isTableLoading() {
      return (fileId: string, kind: TableKind): boolean => {
        return !!this.current(fileId).loading[kind]
      }
    },

    isTableLoaded() {
      return (fileId: string, kind: TableKind): boolean => {
        const s = this.current(fileId)
        return s.currentId != null && s.loadedFor[kind] === s.currentId
      }
    },
  },

  actions: {
    _ensure(fileId: string): FileAnalyses {
      if (!this.byFile[fileId]) {
        this.byFile[fileId] = emptyFileState()
      }
      return this.byFile[fileId]!
    },

    async run(projectId: string, fileId: string, options: AnalysisOptions = {}) {
      this.isRunning = true
      this.runningError = ''
      const state = this._ensure(fileId)

      try {
        const status = await triggerAnalysis(projectId, fileId, options)
        state.status = status
        state.currentId = status.analysis_id
        // Yeni analiz — tüm tablo cache'lerini sıfırla
        state.displacements = []
        state.reactions = []
        state.modes = []
        state.elementForces = []
        state.loadedFor = {}
        // Case seçicisini mümkünse summary'den ayarla
        const available = status.summary?.available_cases ?? []
        if (available.length > 0 && !available.includes(state.selectedLoadCase ?? '')) {
          state.selectedLoadCase = available[0] ?? null
        }
        // History'e ekle
        await this.refreshHistory(projectId, fileId)
      } catch (e: any) {
        console.error('[Analysis] run error:', e)
        this.runningError = e?.message ?? 'Analiz başarısız'
      } finally {
        this.isRunning = false
      }
    },

    /** Sadece status + history yükle, tablo verilerini çekme. */
    async selectAnalysis(projectId: string, fileId: string, analysisId: string) {
      const state = this._ensure(fileId)
      if (state.currentId === analysisId && state.status) return
      state.currentId = analysisId
      // Tablo cache'lerini sıfırla (yeni analize geçildi)
      state.displacements = []
      state.reactions = []
      state.modes = []
      state.elementForces = []
      state.loadedFor = {}
      try {
        state.status = await getAnalysis(projectId, fileId, analysisId)
        const available = state.status?.summary?.available_cases ?? []
        if (available.length > 0 && !available.includes(state.selectedLoadCase ?? '')) {
          state.selectedLoadCase = available[0] ?? null
        }
      } catch (e) {
        console.error('[Analysis] selectAnalysis error:', e)
      }
    },

    async loadDisplacements(projectId: string, fileId: string, analysisId: string) {
      const state = this._ensure(fileId)
      if (state.loadedFor.displacements === analysisId) return
      if (state.loading.displacements) return
      state.loading.displacements = true
      try {
        state.displacements = await getDisplacements(projectId, fileId, analysisId)
        state.loadedFor.displacements = analysisId
      } catch (e) {
        console.error('[Analysis] loadDisplacements error:', e)
        state.displacements = []
      } finally {
        state.loading.displacements = false
      }
    },

    async loadReactions(projectId: string, fileId: string, analysisId: string) {
      const state = this._ensure(fileId)
      if (state.loadedFor.reactions === analysisId) return
      if (state.loading.reactions) return
      state.loading.reactions = true
      try {
        state.reactions = await getReactions(projectId, fileId, analysisId)
        state.loadedFor.reactions = analysisId
      } catch (e) {
        console.error('[Analysis] loadReactions error:', e)
        state.reactions = []
      } finally {
        state.loading.reactions = false
      }
    },

    async loadModes(projectId: string, fileId: string, analysisId: string) {
      const state = this._ensure(fileId)
      if (state.loadedFor.modes === analysisId) return
      if (state.loading.modes) return
      state.loading.modes = true
      try {
        state.modes = await getModes(projectId, fileId, analysisId)
        state.loadedFor.modes = analysisId
      } catch (e) {
        console.error('[Analysis] loadModes error:', e)
        state.modes = []
      } finally {
        state.loading.modes = false
      }
    },

    /** Kesit tesirleri: case başına fetch — tüm case'leri çekmek 46 MB+
     * yük ve 90 sn gecikme üretiyor. Cache key ``${analysisId}:${case||_all}``.
     */
    async loadForces(
      projectId: string,
      fileId: string,
      analysisId: string,
      loadCase?: string | null,
    ) {
      const state = this._ensure(fileId)
      const key = `${analysisId}:${loadCase ?? '_all'}`
      if (state.loadedFor.forces === key) return
      if (state.loading.forces) return
      state.loading.forces = true
      try {
        state.elementForces = await getElementForces(
          projectId, fileId, analysisId, loadCase ?? undefined,
        )
        state.loadedFor.forces = key
      } catch (e) {
        console.error('[Analysis] loadForces error:', e)
        state.elementForces = []
      } finally {
        state.loading.forces = false
      }
    },

    async loadPreview(projectId: string, fileId: string) {
      const state = this._ensure(fileId)
      try {
        state.preview = await previewModel(projectId, fileId)
      } catch (e: any) {
        console.error('[Analysis] preview error:', e)
        this.runningError = e?.message ?? 'Önizleme alınamadı'
      }
      return state.preview
    },

    async refreshHistory(projectId: string, fileId: string) {
      const state = this._ensure(fileId)
      try {
        state.history = await listAnalyses(projectId, fileId)
        if (!state.currentId && state.history.length > 0) {
          // En yeni analizi otomatik seç (ama tablo yükleme — lazy)
          const latestId = state.history[0]!.analysis_id
          await this.selectAnalysis(projectId, fileId, latestId)
        }
      } catch (e) {
        console.error('[Analysis] refreshHistory error:', e)
      }
    },

    setLoadCase(fileId: string, loadCase: string | null) {
      const state = this._ensure(fileId)
      state.selectedLoadCase = loadCase
    },

    async remove(projectId: string, fileId: string, analysisId: string) {
      try {
        await apiDelete(projectId, fileId, analysisId)
        const state = this._ensure(fileId)
        state.history = state.history.filter(h => h.analysis_id !== analysisId)
        if (state.currentId === analysisId) {
          state.currentId = null
          state.status = null
          state.displacements = []
          state.reactions = []
          state.modes = []
          state.elementForces = []
          state.loadedFor = {}
        }
      } catch (e) {
        console.error('[Analysis] remove error:', e)
      }
    },

    reset(fileId: string) {
      delete this.byFile[fileId]
    },
  },
})
