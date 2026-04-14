/**
 * Yapısal analiz backend endpoint'leri için tipli istemci.
 * Backend: build2aiapi/src/routers/analysis.py
 */
import { apiDelete, apiGet, apiPost } from './api'

// ----------------------------------------------------------- tipler
export interface SpectrumParams {
  Ss: number
  S1: number
  soil: 'ZA' | 'ZB' | 'ZC' | 'ZD' | 'ZE'
  R: number
  I: number
  run_x: boolean
  run_y: boolean
}

export interface AnalysisOptions {
  linear_static?: boolean
  modal?: boolean
  modal_n_modes?: number
  response_spectrum?: boolean
  spectrum_code?: 'TBDY_2018' | 'EC8' | 'CUSTOM' | null
  spectrum_params?: SpectrumParams
  pdelta?: boolean
  auto_combinations?: boolean
  combination_code?: 'TBDY_2018' | 'EC0' | 'ASCE7'
  solver?: 'direct' | 'iterative'
  output_detail?: 'summary' | 'full'
  /** null = hepsi, [] = hiçbiri */
  selected_load_cases?: string[] | null
  selected_combinations?: string[] | null
}

export interface LoadCasePreview {
  id: string
  type: string
  self_weight_factor: number
  n_point_loads: number
  n_distributed_loads: number
}

export interface CombinationPreview {
  id: string
  factors: Record<string, number>
}

export interface ModelPreview {
  n_nodes: number
  n_frame_elements: number
  n_shell_elements: number
  load_cases: LoadCasePreview[]
  combinations: CombinationPreview[]
  warnings: string[]
}

export interface Mode {
  mode_no: number
  period: number
  frequency: number
  angular_frequency: number
  /** Yön bazlı kütle katılım oranı (0..1): { ux: 0.82, uy: 0.03, uz: 0.00 } */
  mass_participation?: Record<string, number>
}

export interface ModelSummary {
  n_nodes: number
  n_frame_elements: number
  n_shell_elements: number
  n_dofs_free: number
  n_dofs_total: number
  n_load_cases: number
  n_combinations?: number
  n_modes?: number
  fundamental_period?: number
  max_displacement: number
}

export interface AnalysisStatus {
  analysis_id: string
  file_id: string
  project_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
  duration_ms: number | null
  options: AnalysisOptions
  summary: ModelSummary | null
  warnings: string[]
  error: string | null
}

export interface AnalysisListItem {
  analysis_id: string
  status: string
  created_at: string
  duration_ms: number | null
  summary: ModelSummary | null
}

export interface NodeDisplacement {
  node_id: number
  load_case: string
  ux: number
  uy: number
  uz: number
  rx: number
  ry: number
  rz: number
}

export interface Reaction {
  node_id: number
  load_case: string
  fx: number
  fy: number
  fz: number
  mx: number
  my: number
  mz: number
}

// ----------------------------------------------------------- istekler
function base(projectId: string, fileId: string): string {
  return `/api/projects/${projectId}/files/${fileId}`
}

export function triggerAnalysis(
  projectId: string,
  fileId: string,
  options: AnalysisOptions = {},
): Promise<AnalysisStatus> {
  return apiPost<AnalysisStatus>(`${base(projectId, fileId)}/analyze`, { options })
}

export function listAnalyses(
  projectId: string,
  fileId: string,
): Promise<AnalysisListItem[]> {
  return apiGet<AnalysisListItem[]>(`${base(projectId, fileId)}/analyses`)
}

export function getAnalysis(
  projectId: string,
  fileId: string,
  analysisId: string,
): Promise<AnalysisStatus> {
  return apiGet<AnalysisStatus>(`${base(projectId, fileId)}/analyses/${analysisId}`)
}

export function getSummary(
  projectId: string,
  fileId: string,
  analysisId: string,
): Promise<ModelSummary> {
  return apiGet<ModelSummary>(`${base(projectId, fileId)}/analyses/${analysisId}/summary`)
}

export function getDisplacements(
  projectId: string,
  fileId: string,
  analysisId: string,
  loadCase?: string,
): Promise<NodeDisplacement[]> {
  const qs = loadCase ? `?load_case=${encodeURIComponent(loadCase)}` : ''
  return apiGet<NodeDisplacement[]>(
    `${base(projectId, fileId)}/analyses/${analysisId}/displacements${qs}`,
  )
}

export function getReactions(
  projectId: string,
  fileId: string,
  analysisId: string,
  loadCase?: string,
): Promise<Reaction[]> {
  const qs = loadCase ? `?load_case=${encodeURIComponent(loadCase)}` : ''
  return apiGet<Reaction[]>(
    `${base(projectId, fileId)}/analyses/${analysisId}/reactions${qs}`,
  )
}

export function deleteAnalysis(
  projectId: string,
  fileId: string,
  analysisId: string,
): Promise<void> {
  return apiDelete(`${base(projectId, fileId)}/analyses/${analysisId}`)
}

export function previewModel(
  projectId: string,
  fileId: string,
): Promise<ModelPreview> {
  return apiGet<ModelPreview>(`${base(projectId, fileId)}/preview`)
}

export function getModes(
  projectId: string,
  fileId: string,
  analysisId: string,
): Promise<Mode[]> {
  return apiGet<Mode[]>(`${base(projectId, fileId)}/analyses/${analysisId}/modes`)
}

// -------------------------------------------------- Excel export URL'leri
/** Full analiz xlsx URL'si (auth header ile fetch yapılır). */
export function exportFullXlsxUrl(
  projectId: string, fileId: string, analysisId: string,
): string {
  return `${base(projectId, fileId)}/analyses/${analysisId}/export/xlsx`
}

export function exportDisplacementsXlsxUrl(
  projectId: string, fileId: string, analysisId: string, loadCase?: string,
): string {
  const qs = loadCase ? `?load_case=${encodeURIComponent(loadCase)}` : ''
  return `${base(projectId, fileId)}/analyses/${analysisId}/export/displacements.xlsx${qs}`
}

export function exportReactionsXlsxUrl(
  projectId: string, fileId: string, analysisId: string, loadCase?: string,
): string {
  const qs = loadCase ? `?load_case=${encodeURIComponent(loadCase)}` : ''
  return `${base(projectId, fileId)}/analyses/${analysisId}/export/reactions.xlsx${qs}`
}

export function exportModesXlsxUrl(
  projectId: string, fileId: string, analysisId: string,
): string {
  return `${base(projectId, fileId)}/analyses/${analysisId}/export/modes.xlsx`
}

/** XHR ile binary (xlsx) indir + auth header ekle + tarayıcıya kaydet. */
export async function downloadXlsx(
  url: string,
  filename: string,
): Promise<void> {
  const { getAuth } = await import('firebase/auth')
  const auth = getAuth()
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
  const { API_BASE } = await import('./api')
  const fullUrl = `${API_BASE}${url}`
  const resp = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)
  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
