/**
 * Düğüm aks/kot etiketi yardımcıları — analiz tablolarında kullanılır.
 */
export interface NodeLabelRec {
  axis_x?: string | null
  axis_y?: string | null
  level?: string | null
}

export function hasLabels(rec: NodeLabelRec | null | undefined): boolean {
  return !!(rec && (rec.axis_x || rec.axis_y || rec.level))
}

/**
 * Aks etiketini oluştur:
 *   Kolon kesişimi (her iki aks var)  → "B-3"
 *   Sadece Y ekseni                   → "aks B"
 *   Sadece X ekseni                   → "aks 3"
 *   Hiçbiri yok                       → ""
 */
export function axisLabel(rec: NodeLabelRec): string {
  const { axis_x, axis_y } = rec
  if (axis_x && axis_y) return `${axis_x}-${axis_y}`
  if (axis_y) return `aks ${axis_y}`
  if (axis_x) return `aks ${axis_x}`
  return ''
}

export function isPartialAks(rec: NodeLabelRec): boolean {
  return !!(rec.axis_x || rec.axis_y) && !(rec.axis_x && rec.axis_y)
}

export function axisTitle(rec: NodeLabelRec): string {
  if (rec.axis_x && rec.axis_y) return `Kolon hizası: ${rec.axis_x}-${rec.axis_y}`
  if (rec.axis_y) return `${rec.axis_y} aksı üzerinde; X ekseninde iki grid arasında (ara nokta)`
  if (rec.axis_x) return `${rec.axis_x} aksı üzerinde; Y ekseninde iki grid arasında (ara nokta)`
  return ''
}

export function fmtFloat(v: number): string {
  if (Math.abs(v) < 1e-4) return v === 0 ? '0' : v.toExponential(2)
  return v.toFixed(4)
}
