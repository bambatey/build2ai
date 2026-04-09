/**
 * SAP2000 .s2k / ETABS .e2k text-based file parser.
 * Extracts geometry needed for 3D preview:
 *   - joints (nodes)
 *   - frames (line elements: columns, beams, braces)
 *   - areas (shell/slab elements as polygons)
 *
 * The .s2k format is a series of TABLE blocks:
 *
 *   TABLE:  "JOINT COORDINATES"
 *      Joint=1   CoordSys=GLOBAL   CoordType=Cartesian   XorR=0   Y=0   Z=0
 *      Joint=2   CoordSys=GLOBAL   CoordType=Cartesian   XorR=6   Y=0   Z=0
 *
 *   TABLE:  "CONNECTIVITY - FRAME"
 *      Frame=1   JointI=1   JointJ=2
 *
 *   TABLE:  "CONNECTIVITY - AREA"
 *      Area=1   NumJoints=4   Joint1=1   Joint2=2   Joint3=3   Joint4=4
 *
 * Each row is a "Key=Value Key=Value ..." sequence with whitespace separation.
 */

export interface ParsedJoint {
  id: number
  x: number
  y: number
  z: number
}

export interface ParsedFrame {
  id: number
  i: number // joint i id
  j: number // joint j id
  section?: string
}

export interface ParsedArea {
  id: number
  joints: number[]
}

export interface ParsedModel {
  joints: ParsedJoint[]
  frames: ParsedFrame[]
  areas: ParsedArea[]
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  }
}

/**
 * Parse a single "Key=Value" row into a record.
 * Handles values with surrounding quotes.
 */
function parseRow(line: string): Record<string, string> {
  const out: Record<string, string> = {}
  // Match Key=Value where Value is either quoted or non-space
  const re = /(\w+)=("([^"]*)"|(\S+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    out[m[1]] = m[3] !== undefined ? m[3] : m[4]
  }
  return out
}

/**
 * SAP2000 may export numbers with comma decimal separator depending on the
 * Windows locale (e.g. "3,8" instead of "3.8"). Convert defensively.
 */
function num(v: string | undefined): number {
  if (v === undefined) return NaN
  // Replace comma with dot only if it looks like a decimal separator
  // (no thousand separators are used by SAP2000 in s2k tables).
  return Number(v.replace(',', '.'))
}

/**
 * Split file into TABLE blocks. Each block is { name, rows: string[] }.
 */
function extractTables(text: string): Map<string, string[]> {
  const tables = new Map<string, string[]>()
  const lines = text.split(/\r?\n/)
  let currentName: string | null = null
  let currentRows: string[] = []

  const flush = () => {
    if (currentName) {
      const existing = tables.get(currentName) ?? []
      tables.set(currentName, existing.concat(currentRows))
    }
    currentName = null
    currentRows = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue
    if (line.startsWith('$')) continue // comment

    const tableMatch = line.match(/^TABLE:\s*"([^"]+)"/)
    if (tableMatch) {
      flush()
      currentName = tableMatch[1]
      continue
    }

    if (line.trim() === 'END TABLE DATA') {
      flush()
      continue
    }

    if (currentName) {
      // Skip blank/header lines
      if (line.trim().length > 0) {
        currentRows.push(line.trim())
      }
    }
  }
  flush()
  return tables
}

export function parseS2K(text: string): ParsedModel {
  const tables = extractTables(text)

  // Joints
  const joints: ParsedJoint[] = []
  const jointRows =
    tables.get('JOINT COORDINATES') ?? tables.get('POINT COORDINATES') ?? []
  for (const row of jointRows) {
    const r = parseRow(row)
    const id = num(r.Joint ?? r.Point)
    if (!Number.isFinite(id)) continue
    // Prefer GlobalX/Y/Z if present (already in cartesian); fall back to XorR/Y/Z.
    const x = num(r.GlobalX ?? r.XorR ?? r.X)
    const y = num(r.GlobalY ?? r.Y)
    const z = num(r.GlobalZ ?? r.Z)
    if (![x, y, z].every(Number.isFinite)) continue
    joints.push({ id, x, y, z })
  }

  // Frames
  const frames: ParsedFrame[] = []
  const frameRows =
    tables.get('CONNECTIVITY - FRAME') ?? tables.get('CONNECTIVITY - LINE') ?? []
  for (const row of frameRows) {
    const r = parseRow(row)
    const id = num(r.Frame ?? r.Line)
    const i = num(r.JointI)
    const j = num(r.JointJ)
    if (![id, i, j].every(Number.isFinite)) continue
    frames.push({ id, i, j, section: r.SectionName })
  }

  // Areas (shells / slabs)
  const areas: ParsedArea[] = []
  const areaRows = tables.get('CONNECTIVITY - AREA') ?? []
  for (const row of areaRows) {
    const r = parseRow(row)
    const id = num(r.Area)
    const n = num(r.NumJoints)
    if (!Number.isFinite(id) || !Number.isFinite(n)) continue
    const jointIds: number[] = []
    for (let k = 1; k <= n; k++) {
      const v = num(r[`Joint${k}`])
      if (Number.isFinite(v)) jointIds.push(v)
    }
    if (jointIds.length >= 3) areas.push({ id, joints: jointIds })
  }

  // Bounds
  const bounds = {
    min: [Infinity, Infinity, Infinity] as [number, number, number],
    max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
  }
  for (const j of joints) {
    bounds.min[0] = Math.min(bounds.min[0], j.x)
    bounds.min[1] = Math.min(bounds.min[1], j.y)
    bounds.min[2] = Math.min(bounds.min[2], j.z)
    bounds.max[0] = Math.max(bounds.max[0], j.x)
    bounds.max[1] = Math.max(bounds.max[1], j.y)
    bounds.max[2] = Math.max(bounds.max[2], j.z)
  }
  if (!joints.length) {
    bounds.min = [0, 0, 0]
    bounds.max = [0, 0, 0]
  }

  return { joints, frames, areas, bounds }
}
