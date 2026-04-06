// Dosya formatı algılama ve parsing fonksiyonları

export interface FileFormat {
  extension: string
  program: string
  mimeType: string
  icon: string
}

export const supportedFormats: Record<string, FileFormat> = {
  '.s2k': {
    extension: '.s2k',
    program: 'SAP2000',
    mimeType: 'text/plain',
    icon: '📐',
  },
  '.e2k': {
    extension: '.e2k',
    program: 'ETABS',
    mimeType: 'text/plain',
    icon: '🏢',
  },
  '.r3d': {
    extension: '.r3d',
    program: 'RISA-3D',
    mimeType: 'text/plain',
    icon: '🌉',
  },
  '.std': {
    extension: '.std',
    program: 'STAAD Pro',
    mimeType: 'text/plain',
    icon: '⚙️',
  },
  '.tcl': {
    extension: '.tcl',
    program: 'OpenSees',
    mimeType: 'text/plain',
    icon: '🔬',
  },
  '.inp': {
    extension: '.inp',
    program: 'ANSYS',
    mimeType: 'text/plain',
    icon: '🔧',
  },
}

/**
 * Dosya uzantısından formatı algıla
 */
export function detectFormat(filename: string): FileFormat | null {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return supportedFormats[ext] || null
}

/**
 * Dosya içeriğinden program versiyonunu algıla
 */
export function detectProgramVersion(content: string): string | null {
  // SAP2000/ETABS version
  const sap2000Match = content.match(/Version=(\d+\.\d+\.\d+)/)
  if (sap2000Match) return sap2000Match[1]

  // RISA-3D version
  const risaMatch = content.match(/RISA-3D\s+Version\s+(\d+\.\d+)/)
  if (risaMatch) return risaMatch[1]

  // STAAD Pro version
  const staadMatch = content.match(/STAAD\.Pro\s+V(\d+)/)
  if (staadMatch) return staadMatch[1]

  return null
}

/**
 * Dosya içeriğinden temel bilgileri çıkar
 */
export interface FileInfo {
  program: string
  version: string | null
  nodeCount: number
  elementCount: number
  materialCount: number
  loadPatterns: string[]
  loadCombinations: string[]
}

export function parseFileInfo(content: string, format: string): Partial<FileInfo> {
  const info: Partial<FileInfo> = {
    loadPatterns: [],
    loadCombinations: [],
  }

  if (format === '.s2k' || format === '.e2k') {
    // Program adı
    const programMatch = content.match(/ProgramName=(\w+)/)
    if (programMatch) info.program = programMatch[1]

    // Version
    info.version = detectProgramVersion(content)

    // Düğüm sayısı
    const jointMatches = content.match(/TABLE:\s+"JOINT COORDINATES"([\s\S]*?)(?=TABLE:|END TABLE DATA)/i)
    if (jointMatches) {
      const joints = jointMatches[1].match(/Joint=\d+/g)
      info.nodeCount = joints ? joints.length : 0
    }

    // Eleman sayısı
    const frameMatches = content.match(/TABLE:\s+"CONNECTIVITY - FRAME"([\s\S]*?)(?=TABLE:|END TABLE DATA)/i)
    if (frameMatches) {
      const frames = frameMatches[1].match(/Frame=\d+/g)
      info.elementCount = frames ? frames.length : 0
    }

    // Malzeme sayısı
    const materialMatches = content.match(/TABLE:\s+"MATERIAL PROPERTIES 01 - GENERAL"([\s\S]*?)(?=TABLE:|END TABLE DATA)/i)
    if (materialMatches) {
      const materials = materialMatches[1].match(/Material=\w+/g)
      info.materialCount = materials ? new Set(materials).size : 0
    }

    // Yük durumları
    const loadPatternMatches = content.match(/TABLE:\s+"LOAD PATTERN DEFINITIONS"([\s\S]*?)(?=TABLE:|END TABLE DATA)/i)
    if (loadPatternMatches) {
      const patterns = loadPatternMatches[1].match(/LoadPat=(\w+)/g)
      if (patterns) {
        info.loadPatterns = patterns.map(p => p.replace('LoadPat=', ''))
      }
    }

    // Yük kombinasyonları
    const comboMatches = content.match(/TABLE:\s+"COMBINATION DEFINITIONS"([\s\S]*?)(?=TABLE:|END TABLE DATA)/i)
    if (comboMatches) {
      const combos = comboMatches[1].match(/ComboName=(\w+)/g)
      if (combos) {
        info.loadCombinations = [...new Set(combos.map(c => c.replace('ComboName=', '')))]
      }
    }
  }

  return info
}

/**
 * Satır sayısını hesapla
 */
export function countLines(content: string): number {
  return content.split('\n').length
}

/**
 * Dosya boyutunu hesapla (bytes)
 */
export function getFileSize(content: string): number {
  return new Blob([content]).size
}
