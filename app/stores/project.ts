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

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    files: [] as FileNode[],
    currentFile: null as FileNode | null,
    originalContent: '',
    modifiedContent: '',
    changes: [] as Change[],
  }),

  getters: {
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
      this.projects.push(project)
    },

    deleteProject(id: string) {
      this.projects = this.projects.filter(p => p.id !== id)
    },
  },
})
