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
  getDisplacements,
  getElementForces,
  getModes,
  getReactions,
  listAnalyses,
  previewModel,
  triggerAnalysis,
} from '~/utils/analysisApi'

interface FileAnalyses {
  history: AnalysisListItem[]
  currentId: string | null
  status: AnalysisStatus | null
  displacements: NodeDisplacement[]
  reactions: Reaction[]
  modes: Mode[]
  elementForces: ElementForces[]
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
    selectedLoadCase: null,
    preview: null,
  }
}

export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    /** fileId → analiz durumu */
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
        const set = new Set<string>()
        s.displacements.forEach(d => set.add(d.load_case))
        s.reactions.forEach(r => set.add(r.load_case))
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
        if (status.status === 'completed') {
          await this.loadResults(projectId, fileId, status.analysis_id)
        }
      } catch (e: any) {
        console.error('[Analysis] run error:', e)
        this.runningError = e?.message ?? 'Analiz başarısız'
      } finally {
        this.isRunning = false
      }
    },

    async loadResults(projectId: string, fileId: string, analysisId: string) {
      const state = this._ensure(fileId)
      const [disps, reacts, modes, forces] = await Promise.all([
        getDisplacements(projectId, fileId, analysisId),
        getReactions(projectId, fileId, analysisId),
        getModes(projectId, fileId, analysisId).catch(() => [] as Mode[]),
        getElementForces(projectId, fileId, analysisId).catch(
          () => [] as ElementForces[],
        ),
      ])
      state.displacements = disps
      state.reactions = reacts
      state.modes = modes
      state.elementForces = forces
      if (!state.selectedLoadCase) {
        const cases = [...new Set(disps.map(d => d.load_case))].sort()
        state.selectedLoadCase = cases[0] ?? null
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
          // En yeni analizi otomatik seç
          state.currentId = state.history[0]!.analysis_id
          await this.loadResults(projectId, fileId, state.currentId)
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
          state.elementForces = []
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
