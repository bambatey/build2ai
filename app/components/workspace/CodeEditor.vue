<template>
  <div class="code-editor h-full flex flex-col bg-secondary">
    <!-- Editor Header -->
    <div class="editor-header flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)]">
      <div class="flex items-center gap-2">
        <Icon name="lucide:file-code" class="w-4 h-4 text-muted" />
        <span class="text-sm font-medium text-primary">{{ fileName || 'Dosya seçilmedi' }}</span>
        <span v-if="isDirty" class="text-xs text-accent-amber">● Kaydedilmemiş</span>
      </div>

      <div class="editor-actions flex items-center gap-2">
        <button
          v-if="showDiff"
          @click="toggleDiffMode"
          class="btn btn-ghost text-xs"
          :class="{ 'text-accent-blue': isDiffMode }"
        >
          <Icon name="lucide:git-compare" class="w-4 h-4" />
          Diff
        </button>

        <button @click="handleSave" class="btn btn-ghost text-xs" :disabled="!isDirty">
          <Icon name="lucide:save" class="w-4 h-4" />
          Kaydet
        </button>
      </div>
    </div>

    <!-- Monaco Editor -->
    <div ref="editorContainer" class="editor-container flex-1" />

    <!-- Status Bar -->
    <div class="status-bar flex items-center justify-between px-4 py-1 border-t border-[var(--border-default)] text-xs text-secondary bg-[var(--bg-primary)]">
      <div class="flex items-center gap-4">
        <span>Satır {{ cursorPosition.line }}, Sütun {{ cursorPosition.column }}</span>
        <span v-if="selectedText">{{ selectedText.length }} karakter seçili</span>
      </div>

      <div class="flex items-center gap-4">
        <span class="font-mono">{{ fileFormat || 'Plain Text' }}</span>
        <span>UTF-8</span>
        <span v-if="lineCount">{{ lineCount }} satır</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useProjectStore } from '~/stores/project'
import * as monaco from 'monaco-editor'

const projectStore = useProjectStore()

const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const isDiffMode = ref(false)
const cursorPosition = ref({ line: 1, column: 1 })
const selectedText = ref('')

const fileName = computed(() => projectStore.currentFile?.name)
const fileFormat = computed(() => projectStore.currentFile?.format)
const isDirty = computed(() => projectStore.hasChanges)
const showDiff = computed(() => projectStore.hasChanges)
const lineCount = computed(() => projectStore.modifiedContent.split('\n').length)

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  editor?.dispose()
})

// Dosya değiştiğinde editörü güncelle
watch(() => projectStore.currentFile, (newFile) => {
  if (newFile && editor) {
    editor.setValue(projectStore.modifiedContent)
  }
}, { immediate: true })

const initEditor = () => {
  if (!editorContainer.value) return

  // Custom language definition (SAP2000, ETABS, vb.)
  monaco.languages.register({ id: 'sap2000' })
  monaco.languages.setMonarchTokensProvider('sap2000', {
    tokenizer: {
      root: [
        [/\$.*$/, 'comment'],
        [/TABLE:\s+"[^"]+"/, 'keyword'],
        [/\b\d+(\.\d+)?(E[+-]?\d+)?\b/, 'number'],
        [/"[^"]*"/, 'string'],
        [/\b(Yes|No|N\.A\.)\b/, 'constant'],
      ],
    },
  })

  // Create editor
  editor = monaco.editor.create(editorContainer.value, {
    value: projectStore.modifiedContent || '',
    language: getLanguageFromFormat(fileFormat.value || ''),
    theme: 'vs-dark',
    fontSize: 13,
    fontFamily: 'JetBrains Mono, monospace',
    minimap: { enabled: true },
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    tabSize: 2,
  })

  // Listen to content changes
  editor.onDidChangeModelContent(() => {
    const newContent = editor?.getValue() || ''
    projectStore.updateFileContent(newContent)
  })

  // Listen to cursor position changes
  editor.onDidChangeCursorPosition((e) => {
    cursorPosition.value = {
      line: e.position.lineNumber,
      column: e.position.column,
    }
  })

  // Listen to selection changes
  editor.onDidChangeCursorSelection((e) => {
    const selection = editor?.getModel()?.getValueInRange(e.selection)
    selectedText.value = selection || ''
  })
}

const getLanguageFromFormat = (format: string): string => {
  const languageMap: Record<string, string> = {
    '.s2k': 'sap2000',
    '.e2k': 'sap2000',
    '.r3d': 'plaintext',
    '.std': 'plaintext',
    '.tcl': 'tcl',
    '.inp': 'plaintext',
  }
  return languageMap[format] || 'plaintext'
}

const toggleDiffMode = () => {
  isDiffMode.value = !isDiffMode.value
  // TODO: Implement diff view with Monaco Diff Editor
  console.log('Diff mode:', isDiffMode.value)
}

const handleSave = () => {
  projectStore.applyChanges()
  console.log('Dosya kaydedildi')
}
</script>

<style scoped>
.editor-container {
  position: relative;
  overflow: hidden;
}

.editor-container :deep(.monaco-editor) {
  --vscode-editor-background: var(--bg-secondary);
  --vscode-editorLineNumber-foreground: var(--text-muted);
}
</style>
