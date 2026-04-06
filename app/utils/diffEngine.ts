// Basit diff hesaplama motoru

export interface DiffLine {
  type: 'add' | 'delete' | 'modify' | 'unchanged'
  lineNumber: number
  oldContent?: string
  newContent?: string
}

export interface DiffResult {
  lines: DiffLine[]
  addedCount: number
  deletedCount: number
  modifiedCount: number
}

/**
 * İki string arasındaki farkları satır satır hesapla
 */
export function calculateDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const lines: DiffLine[] = []
  let addedCount = 0
  let deletedCount = 0
  let modifiedCount = 0

  const maxLength = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]

    if (oldLine === undefined && newLine !== undefined) {
      // Yeni satır eklendi
      lines.push({
        type: 'add',
        lineNumber: i + 1,
        newContent: newLine,
      })
      addedCount++
    } else if (oldLine !== undefined && newLine === undefined) {
      // Satır silindi
      lines.push({
        type: 'delete',
        lineNumber: i + 1,
        oldContent: oldLine,
      })
      deletedCount++
    } else if (oldLine !== newLine) {
      // Satır değiştirildi
      lines.push({
        type: 'modify',
        lineNumber: i + 1,
        oldContent: oldLine,
        newContent: newLine,
      })
      modifiedCount++
    } else {
      // Satır değişmedi
      lines.push({
        type: 'unchanged',
        lineNumber: i + 1,
        oldContent: oldLine,
      })
    }
  }

  return {
    lines,
    addedCount,
    deletedCount,
    modifiedCount,
  }
}

/**
 * Diff'i inline HTML formatına çevir
 */
export function formatDiffAsHTML(diff: DiffResult): string {
  return diff.lines
    .map((line) => {
      const lineNum = String(line.lineNumber).padStart(4, ' ')

      switch (line.type) {
        case 'add':
          return `<div class="diff-line diff-add">
            <span class="line-number">+${lineNum}</span>
            <span class="line-content">${escapeHtml(line.newContent || '')}</span>
          </div>`
        case 'delete':
          return `<div class="diff-line diff-delete">
            <span class="line-number">-${lineNum}</span>
            <span class="line-content">${escapeHtml(line.oldContent || '')}</span>
          </div>`
        case 'modify':
          return `<div class="diff-line diff-modify">
            <span class="line-number">~${lineNum}</span>
            <span class="line-content">
              <span class="old">${escapeHtml(line.oldContent || '')}</span>
              <span class="new">${escapeHtml(line.newContent || '')}</span>
            </span>
          </div>`
        default:
          return `<div class="diff-line diff-unchanged">
            <span class="line-number"> ${lineNum}</span>
            <span class="line-content">${escapeHtml(line.oldContent || '')}</span>
          </div>`
      }
    })
    .join('\n')
}

/**
 * Diff'i markdown formatına çevir
 */
export function formatDiffAsMarkdown(diff: DiffResult): string {
  return diff.lines
    .filter(line => line.type !== 'unchanged')
    .map((line) => {
      switch (line.type) {
        case 'add':
          return `+ ${line.newContent}`
        case 'delete':
          return `- ${line.oldContent}`
        case 'modify':
          return `~ ${line.oldContent} → ${line.newContent}`
        default:
          return ''
      }
    })
    .join('\n')
}

/**
 * HTML escape
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Belirli bir satır aralığındaki değişiklikleri filtrele
 */
export function filterDiffByRange(
  diff: DiffResult,
  startLine: number,
  endLine: number
): DiffResult {
  const filteredLines = diff.lines.filter(
    (line) => line.lineNumber >= startLine && line.lineNumber <= endLine
  )

  return {
    lines: filteredLines,
    addedCount: filteredLines.filter((l) => l.type === 'add').length,
    deletedCount: filteredLines.filter((l) => l.type === 'delete').length,
    modifiedCount: filteredLines.filter((l) => l.type === 'modify').length,
  }
}
