import { defineStore } from 'pinia'

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  format?: string
  size?: number
  lineCount?: number
  lastModified?: Date
  children?: FileNode[]
  content?: string
}

export interface Project {
  id: string
  name: string
  format: string
  fileCount: number
  lastModified: Date
  progress: number
  tags: string[]
  files: FileNode[]
}

export interface Change {
  id: string
  type: 'add' | 'delete' | 'modify'
  lineNumber: number
  oldContent: string
  newContent: string
  timestamp: Date
}

const STORAGE_KEY = 'structai:project-state'

/**
 * Create a minimal but valid SAP2000 .s2k text with empty geometry tables.
 * Used as the starting file for newly created projects.
 */
function createEmptyS2K(projectName: string): string {
  return [
    `$ File: ${projectName}.s2k`,
    '$ Program: SAP2000',
    '$ Version: 26.0.0',
    '$ Units: kN, m, C',
    '',
    'TABLE:  "PROGRAM INFORMATION"',
    '   ProgramName=SAP2000   Version=26.0.0',
    '',
    'TABLE:  "JOINT COORDINATES"',
    '',
    'TABLE:  "CONNECTIVITY - FRAME"',
    '',
    'TABLE:  "CONNECTIVITY - AREA"',
    '',
    'END TABLE DATA',
    '',
  ].join('\n')
}

interface PersistedState {
  activeProjectId: string | null
  recentProjectIds: string[]
}

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return { activeProjectId: null, recentProjectIds: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { activeProjectId: null, recentProjectIds: [] }
    return JSON.parse(raw)
  } catch {
    return { activeProjectId: null, recentProjectIds: [] }
  }
}

function persist(state: PersistedState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    activeProjectId: null as string | null,
    recentProjectIds: [] as string[],
    files: [] as FileNode[],
    currentFile: null as FileNode | null,
    originalContent: '',
    modifiedContent: '',
    changes: [] as Change[],
    // Yeni proje akışı
    isNewProjectModalOpen: false,
    pendingNewProjectName: null as string | null,
  }),

  getters: {
    activeProject(state): Project | null {
      if (!state.activeProjectId) return null
      return state.projects.find(p => p.id === state.activeProjectId) ?? null
    },

    recentProjects(state): Project[] {
      return state.recentProjectIds
        .map(id => state.projects.find(p => p.id === id))
        .filter((p): p is Project => !!p)
    },

    changeStats: (state) => {
      const added = state.changes.filter(c => c.type === 'add').length
      const deleted = state.changes.filter(c => c.type === 'delete').length
      const modified = state.changes.filter(c => c.type === 'modify').length
      return { added, deleted, modified }
    },

    hasChanges: (state) => state.changes.length > 0,

    currentFileInfo: (state) => {
      if (!state.currentFile) return null
      return {
        name: state.currentFile.name,
        format: state.currentFile.format,
        size: state.currentFile.size,
        lineCount: state.currentFile.lineCount,
        lastModified: state.currentFile.lastModified,
      }
    },
  },

  actions: {
    hydrate() {
      const persisted = loadPersisted()
      this.activeProjectId = persisted.activeProjectId
      this.recentProjectIds = persisted.recentProjectIds
    },

    persistState() {
      persist({
        activeProjectId: this.activeProjectId,
        recentProjectIds: this.recentProjectIds,
      })
    },

    openProject(id: string) {
      const project = this.projects.find(p => p.id === id)
      if (!project) return

      this.activeProjectId = id
      this.currentProject = project
      this.files = project.files

      // Update recents (most recent first, max 10)
      this.recentProjectIds = [
        id,
        ...this.recentProjectIds.filter(pid => pid !== id),
      ].slice(0, 10)

      this.persistState()
    },

    closeProject() {
      this.activeProjectId = null
      this.currentProject = null
      this.files = []
      this.currentFile = null
      this.persistState()
    },

    setCurrentProject(project: Project) {
      this.currentProject = project
      this.files = project.files
    },

    openFile(file: FileNode, content: string) {
      this.currentFile = file
      this.originalContent = content
      this.modifiedContent = content
      this.changes = []
    },

    updateFileContent(content: string) {
      this.modifiedContent = content
    },

    addChange(change: Omit<Change, 'id' | 'timestamp'>) {
      this.changes.push({
        ...change,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      })
    },

    revertToOriginal() {
      this.modifiedContent = this.originalContent
      this.changes = []
    },

    applyChanges() {
      this.originalContent = this.modifiedContent
      this.changes = []
    },

    addProject(project: Project) {
      if (this.projects.find(p => p.id === project.id)) return
      this.projects.push(project)
    },

    requestNewProject() {
      this.isNewProjectModalOpen = true
    },

    cancelNewProject() {
      this.isNewProjectModalOpen = false
    },

    startNewProjectDraft(name: string) {
      this.pendingNewProjectName = name.trim() || 'Yeni Proje'
      this.isNewProjectModalOpen = false
      // Aktif projeyi temizle ki workspace boş açılsın
      this.activeProjectId = null
      this.currentProject = null
      this.files = []
      this.currentFile = null
      this.persistState()
    },

    /**
     * Bekleyen taslak proje varsa, onu gerçek bir projeye çevirir
     * ve aktif yapar. İlk mesaj gönderildiğinde çağrılır.
     */
    commitPendingProject(): Project | null {
      if (!this.pendingNewProjectName) return null
      const id = crypto.randomUUID()
      const name = this.pendingNewProjectName
      const fileName = `${name}.s2k`
      const project: Project = {
        id,
        name,
        format: '.s2k',
        fileCount: 1,
        lastModified: new Date(),
        progress: 0,
        tags: [],
        files: [
          {
            id: crypto.randomUUID(),
            name: fileName,
            type: 'file',
            path: `/${name}/${fileName}`,
            format: '.s2k',
            size: 0,
            lastModified: new Date(),
            content: createEmptyS2K(name),
          },
        ],
      }
      this.addProject(project)
      this.openProject(id)
      this.pendingNewProjectName = null
      return project
    },

    deleteProject(id: string) {
      this.projects = this.projects.filter(p => p.id !== id)
      this.recentProjectIds = this.recentProjectIds.filter(pid => pid !== id)
      if (this.activeProjectId === id) {
        this.closeProject()
      } else {
        this.persistState()
      }
    },
  },
})
