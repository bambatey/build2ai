<template>
  <div
    class="file-drop-zone"
    :class="{
      'is-dragging': isDragging,
      'has-file': hasFile,
    }"
    @drop.prevent="handleDrop"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="handleDragEnter"
    @dragleave.prevent="handleDragLeave"
    @click="triggerFileInput"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="acceptedFormats.join(',')"
      class="hidden"
      @change="handleFileSelect"
    />

    <div class="drop-zone-content">
      <div class="icon-container mb-4">
        <Icon
          :name="isDragging ? 'lucide:file-down' : 'lucide:upload-cloud'"
          class="w-12 h-12 text-[var(--accent-blue)]"
        />
      </div>

      <div class="text-content text-center">
        <p class="text-lg font-medium text-primary mb-2">
          {{ isDragging ? 'Dosyayı buraya bırakın' : 'Dosya yükle' }}
        </p>
        <p class="text-sm text-secondary">
          {{ isDragging ? '' : 'Tıklayın veya dosyayı sürükleyin' }}
        </p>
        <p class="text-xs text-muted mt-2">
          Desteklenen formatlar: {{ acceptedFormats.join(', ') }}
        </p>
      </div>
    </div>

    <!-- Progress Bar (loading state) -->
    <div v-if="isUploading" class="progress-bar mt-4">
      <div class="progress-fill" :style="{ width: `${uploadProgress}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    acceptedFormats?: string[]
    maxSize?: number // MB
  }>(),
  {
    acceptedFormats: () => ['.s2k', '.e2k', '.r3d', '.std', '.tcl', '.inp'],
    maxSize: 10,
  }
)

const emit = defineEmits<{
  fileSelected: [file: File]
  error: [message: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const hasFile = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)

const handleDragOver = () => {
  isDragging.value = true
}

const handleDragEnter = () => {
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  // Sadece drop zone'dan tamamen çıkıldığında isDragging'i false yap
  if (e.target === e.currentTarget) {
    isDragging.value = false
  }
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const processFile = async (file: File) => {
  // Format kontrolü
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!props.acceptedFormats.includes(fileExt)) {
    emit('error', `Desteklenmeyen dosya formatı: ${fileExt}`)
    return
  }

  // Boyut kontrolü
  const fileSizeMB = file.size / (1024 * 1024)
  if (fileSizeMB > props.maxSize) {
    emit('error', `Dosya boyutu ${props.maxSize}MB'den büyük olamaz`)
    return
  }

  // Simüle edilmiş yükleme
  hasFile.value = true
  isUploading.value = true
  uploadProgress.value = 0

  // Progress animasyonu
  const interval = setInterval(() => {
    uploadProgress.value += 10
    if (uploadProgress.value >= 100) {
      clearInterval(interval)
      isUploading.value = false
      emit('fileSelected', file)
    }
  }, 100)
}
</script>

<style scoped>
.file-drop-zone {
  border: 2px dashed var(--border-default);
  border-radius: var(--radius-card);
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-smooth);
  background-color: var(--bg-secondary);
}

.file-drop-zone:hover {
  border-color: var(--accent-blue);
  background-color: var(--bg-tertiary);
}

.file-drop-zone.is-dragging {
  border-color: var(--accent-green);
  background-color: var(--bg-tertiary);
  box-shadow: 0 0 20px var(--accent-green);
}

.file-drop-zone.has-file {
  border-color: var(--accent-green);
}

.icon-container {
  display: flex;
  justify-content: center;
  transition: transform var(--transition-smooth);
}

.file-drop-zone:hover .icon-container,
.file-drop-zone.is-dragging .icon-container {
  transform: scale(1.1);
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--accent-green);
  transition: width 150ms ease;
}
</style>
