import { defineStore } from 'pinia'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { apiGet, apiPost, apiPut, apiDelete, apiPostFormData } from '~/utils/api'

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
  storagePath?: string
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
    isNewProjectModalOpen: false,
    pendingNewProjectName: null as string | null,
    _loaded: false,
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
    // ---! Backend'den projeleri yükle
    async fetchProjects() {
      try {
        const projects = await apiGet<any[]>('/api/projects')
        this.projects = (projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          format: p.format || '.s2k',
          fileCount: p.file_count || 0,
          lastModified: new Date(p.updated_at || p.created_at),
          progress: p.progress || 0,
          tags: p.tags || [],
          files: [],
        }))
        this._loaded = true

        // Son projeleri güncelle (en son güncellenen ilk 10)
        this.recentProjectIds = this.projects
          .slice(0, 10)
          .map(p => p.id)

        console.log('[Project] Loaded', this.projects.length, 'projects from backend')
      } catch (e) {
        console.error('[Project] fetchProjects error:', e)
      }
    },

    // ---! Backend'den proje detayı + dosyaları yükle
    async fetchProjectDetail(projectId: string) {
      try {
        const detail = await apiGet<any>(`/api/projects/${projectId}`)
        const files: FileNode[] = (detail.files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type || 'file',
          path: f.path || '',
          format: f.format,
          size: f.size,
          lineCount: f.line_count,
          lastModified: f.last_modified ? new Date(f.last_modified) : undefined,
          storagePath: f.storage_path,
        }))

        // Mevcut projeyi güncelle
        const idx = this.projects.findIndex(p => p.id === projectId)
        if (idx !== -1) {
          this.projects[idx].files = files
          this.projects[idx].fileCount = files.length
        }

        return files
      } catch (e) {
        console.error('[Project] fetchProjectDetail error:', e)
        return []
      }
    },

    // ---! Dosya içeriğini backend'den yükle
    async fetchFileContent(projectId: string, fileId: string): Promise<string> {
      try {
        const data = await apiGet<any>(`/api/projects/${projectId}/files/${fileId}`)
        return data.content || ''
      } catch (e) {
        console.error('[Project] fetchFileContent error:', e)
        return ''
      }
    },

    // ---! Backend'e yeni proje oluştur
    async createProjectOnBackend(name: string, format: string = '.s2k', tags: string[] = []): Promise<Project | null> {
      try {
        const result = await apiPost<any>('/api/projects', { name, format, tags })
        const project: Project = {
          id: result.id,
          name: result.name,
          format: result.format || format,
          fileCount: 0,
          lastModified: new Date(),
          progress: 0,
          tags: result.tags || tags,
          files: [],
        }
        this.projects.unshift(project)
        console.log('[Project] Created on backend:', project.id)
        return project
      } catch (e) {
        console.error('[Project] createProject error:', e)
        return null
      }
    },

    // ---! Backend'e dosya yükle
    async uploadFileToBackend(projectId: string, file: File): Promise<FileNode | null> {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const result = await apiPostFormData<any>(`/api/projects/${projectId}/files/upload`, formData)
        const fileNode: FileNode = {
          id: result.id,
          name: result.name,
          type: 'file',
          path: result.path || '',
          format: result.format,
          size: result.size,
          lineCount: result.line_count,
          storagePath: result.storage_path,
        }

        // Projenin dosya listesini güncelle
        const project = this.projects.find(p => p.id === projectId)
        if (project) {
          project.files.push(fileNode)
          project.fileCount = project.files.length
        }

        console.log('[Project] File uploaded:', fileNode.name)
        return fileNode
      } catch (e) {
        console.error('[Project] uploadFile error:', e)
        return null
      }
    },

    // ---! Backend'e dosya oluştur (içerik ile)
    async createFileOnBackend(projectId: string, name: string, content: string, format: string = '.s2k'): Promise<FileNode | null> {
      try {
        const result = await apiPost<any>(`/api/projects/${projectId}/files`, { name, format, content })
        const fileNode: FileNode = {
          id: result.id,
          name: result.name,
          type: 'file',
          path: result.path || '',
          format: result.format,
          size: result.size,
          lineCount: result.line_count,
          storagePath: result.storage_path,
          content,
        }

        const project = this.projects.find(p => p.id === projectId)
        if (project) {
          project.files.push(fileNode)
          project.fileCount = project.files.length
        }

        return fileNode
      } catch (e) {
        console.error('[Project] createFile error:', e)
        return null
      }
    },

    // ---! Backend'de dosya içeriğini güncelle (save)
    async saveFileToBackend(projectId: string, fileId: string, content: string) {
      try {
        await apiPut(`/api/projects/${projectId}/files/${fileId}`, { content })
        console.log('[Project] File saved to backend')
      } catch (e) {
        console.error('[Project] saveFile error:', e)
      }
    },

    // ---! Projeyi aç — dosyalarını ve ilk dosyanın içeriğini yükle
    async openProject(id: string) {
      const project = this.projects.find(p => p.id === id)
      if (!project) return

      // Eski state'i temizle
      this.currentFile = null
      this.originalContent = ''
      this.modifiedContent = ''
      this.changes = []

      this.activeProjectId = id
      this.currentProject = project
      _persistLastProject(id)

      // Backend'den dosyaları her zaman yükle (güncel veri)
      const files = await this.fetchProjectDetail(id)
      project.files = files
      this.files = project.files

      // İlk dosyanın içeriğini yükle (3D görünüm ve chat için)
      const firstFile = project.files.find(f => f.type === 'file')
      if (firstFile) {
        await this.openFile(firstFile)
      }

      // Recents güncelle
      this.recentProjectIds = [
        id,
        ...this.recentProjectIds.filter(pid => pid !== id),
      ].slice(0, 10)
    },

    closeProject() {
      this.activeProjectId = null
      this.currentProject = null
      this.files = []
      this.currentFile = null
      _persistLastProject(null)
    },

    setCurrentProject(project: Project) {
      this.currentProject = project
      this.files = project.files
    },

    // ---! Dosyayı editörde aç — içeriği backend'den çek
    async openFile(file: FileNode, content?: string) {
      this.currentFile = file

      // İçerik verilmediyse ve storagePath varsa backend'den çek
      if (!content && file.storagePath && this.activeProjectId) {
        content = await this.fetchFileContent(this.activeProjectId, file.id)
      }

      this.originalContent = content || ''
      this.modifiedContent = content || ''
      this.changes = []

      // FileNode'a da content'i kaydet (chat'e göndermek için)
      file.content = content
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

    // ---! Save — backend'e de yaz
    async applyChanges() {
      this.originalContent = this.modifiedContent
      this.changes = []

      // Backend'e kaydet
      if (this.activeProjectId && this.currentFile?.id) {
        await this.saveFileToBackend(this.activeProjectId, this.currentFile.id, this.modifiedContent)
      }
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

    async startNewProjectDraft(name: string) {
      this.pendingNewProjectName = name.trim() || 'Yeni Proje'
      // Modal'ı burada kapatmıyoruz — commitPendingProject bitene kadar açık kalmalı
      this.activeProjectId = null
      this.currentProject = null
      this.files = []
      this.currentFile = null
    },

    async commitPendingProject(opts?: { storedAt?: string }): Promise<Project | null> {
      if (!this.pendingNewProjectName) return null

      const name = this.pendingNewProjectName
      this.pendingNewProjectName = null

      // Backend'de oluştur
      const project = await this.createProjectOnBackend(name)
      if (!project) return null

      // Boş .s2k dosyası oluştur
      const fileName = `${name}.s2k`
      const content = createEmptyS2K(name)
      await this.createFileOnBackend(project.id, fileName, content)

      // Projeyi aç
      await this.openProject(project.id)
      return project
    },

    async deleteProject(id: string) {
      try {
        await apiDelete(`/api/projects/${id}`)
      } catch (e) {
        console.error('[Project] deleteProject error:', e)
      }
      this.projects = this.projects.filter(p => p.id !== id)
      this.recentProjectIds = this.recentProjectIds.filter(pid => pid !== id)
      if (this.activeProjectId === id) {
        this.closeProject()
      }
    },

    // ---! Hydrate — Firebase Auth hazır olduktan sonra backend'den yükle
    async hydrate() {
      if (this._loaded) return

      // Firebase Auth'un current user'ı yüklemesini bekle
      const auth = getAuth()
      if (!auth.currentUser) {
        await new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe()
            resolve()
          })
        })
      }

      // Giriş yapılmışsa projeleri çek
      if (auth.currentUser) {
        await this.fetchProjects()
      }
    },

    async restoreLastProject() {
      const id = _getLastProject()
      if (!id) return
      if (this.activeProjectId === id) return
      const exists = this.projects.find(p => p.id === id)
      if (!exists) return
      await this.openProject(id)
    },
  },
})

const _LS_KEY = 'build2ai_last_project'
function _persistLastProject(id: string | null) {
  try {
    if (id) localStorage.setItem(_LS_KEY, id)
    else localStorage.removeItem(_LS_KEY)
  } catch {}
}
function _getLastProject(): string | null {
  try { return localStorage.getItem(_LS_KEY) } catch { return null }
}
