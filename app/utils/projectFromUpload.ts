/**
 * "User uploaded a file → create project on backend" pipeline.
 *
 * 1. Backend'de proje oluşturur
 * 2. Dosyayı Firebase Storage'a yükler
 * 3. Projeyi açar ve workspace'e yönlendirir
 */

import type { Router } from 'vue-router'
import type { useProjectStore } from '~/stores/project'
import type { useAgent } from '~/composables/useAgent'

interface Deps {
  projectStore: ReturnType<typeof useProjectStore>
  agent: ReturnType<typeof useAgent>
  router: Router
}

export async function createProjectFromUpload(
  file: File,
  { projectStore, agent, router }: Deps,
): Promise<void> {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const baseName = file.name.replace(/\.[^.]+$/, '')

  // 1. Backend'de proje oluştur
  const project = await projectStore.createProjectOnBackend(baseName, ext)
  if (!project) {
    throw new Error('Proje oluşturulamadı')
  }

  // 2. Dosyayı backend'e yükle (Firebase Storage'a gider)
  const fileNode = await projectStore.uploadFileToBackend(project.id, file)
  if (!fileNode) {
    console.error('Dosya yüklenemedi ama proje oluşturuldu')
  }

  // 3. Agent bağlıysa dosyayı local'e de kopyala
  if (agent.connected.value && agent.root.value) {
    try {
      const content = await file.text()
      await agent.writeFile(file.name, content)
      await agent.refreshFiles()
    } catch (err) {
      console.error('Agent yazma başarısız', err)
    }
  }

  // 4. Projeyi aç
  await projectStore.openProject(project.id)
  router.push('/workspace')
}
