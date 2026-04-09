/**
 * Shared "user uploaded a file → make it a project" pipeline.
 *
 * Used by the dashboard upload modal and any other entry point that
 * needs to ingest a local file. If the StructAI agent is connected and
 * has a watched root, the file is also copied into that folder so the
 * native filesystem mirror stays in sync. The created project is bound
 * to the agent path when the copy succeeds; otherwise it falls back to
 * an in-memory only project.
 */

import type { Router } from 'vue-router'
import type { Project } from '~/stores/project'
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
): Promise<Project> {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const baseName = file.name.replace(/\.[^.]+$/, '')

  let content: string
  try {
    content = await file.text()
  } catch {
    throw new Error('Dosya okunamadı')
  }

  // If the agent is reachable, copy the upload into the watched folder so
  // it lives alongside everything else the user is working on.
  let storedAt: string | null = null
  if (agent.connected.value && agent.root.value) {
    try {
      const written = await agent.writeFile(file.name, content)
      storedAt = written.path
      await agent.refreshFiles()
    } catch (err) {
      // Non-fatal: the project still works as an in-memory copy.
      console.error('Agent yazma başarısız', err)
    }
  }

  const id = crypto.randomUUID()
  const project: Project = {
    id,
    name: baseName,
    format: ext,
    fileCount: 1,
    lastModified: new Date(),
    progress: 0,
    tags: storedAt ? ['yerel'] : [],
    files: [
      {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'file',
        path: storedAt ? `agent://${storedAt}` : `/${baseName}/${file.name}`,
        format: ext,
        size: file.size,
        lastModified: new Date(),
        content,
      },
    ],
  }

  projectStore.addProject(project)
  projectStore.openProject(id)
  router.push('/workspace')
  return project
}
