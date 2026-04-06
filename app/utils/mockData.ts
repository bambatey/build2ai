import type { Project, FileNode } from '~/stores/project'

// SAP2000 örnek dosya içeriği (gerçekçi format)
export const mockSAP2000Content = `$ File: Bina_Model_v3.s2k
$ Program: SAP2000
$ Version: 26.0.0
$ Units: kN, m, C

TABLE:  "PROGRAM INFORMATION"
   ProgramName=SAP2000   Version=26.0.0   ProgLevel=Advanced   LicenseOS=Yes

TABLE:  "ACTIVE DEGREES OF FREEDOM"
   UX=Yes   UY=Yes   UZ=Yes   RX=Yes   RY=Yes   RZ=Yes

TABLE:  "COORDINATE SYSTEMS"
   Name=GLOBAL   Type=Cartesian   X=0   Y=0   Z=0

TABLE:  "GRID LINES"
   CoordSys=GLOBAL   AxisDir=X   GridID=A   XRYZCoord=0
   CoordSys=GLOBAL   AxisDir=X   GridID=B   XRYZCoord=6
   CoordSys=GLOBAL   AxisDir=X   GridID=C   XRYZCoord=12
   CoordSys=GLOBAL   AxisDir=X   GridID=D   XRYZCoord=18
   CoordSys=GLOBAL   AxisDir=Y   GridID=1   XRYZCoord=0
   CoordSys=GLOBAL   AxisDir=Y   GridID=2   XRYZCoord=5
   CoordSys=GLOBAL   AxisDir=Y   GridID=3   XRYZCoord=10
   CoordSys=GLOBAL   AxisDir=Y   GridID=4   XRYZCoord=15

TABLE:  "MATERIAL PROPERTIES 01 - GENERAL"
   Material=C30   Type=Concrete   SymType=Isotropic   TempDepend=No   Color=Blue
   Material=S420   Type=Steel   SymType=Isotropic   TempDepend=No   Color=Yellow

TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"
   SectionName=W14x90   Material=S420   Shape=I/Wide Flange
   SectionName=W16x67   Material=S420   Shape=I/Wide Flange

END TABLE DATA
`

// Mock projeler
export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Bina_Model_v3',
    format: '.s2k',
    fileCount: 3,
    lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000),
    progress: 78,
    tags: ['deprem', 'çelik', 'TBDY2018'],
    files: [
      {
        id: 'f1',
        name: 'model.s2k',
        type: 'file',
        path: '/Bina_Model_v3/model.s2k',
        format: '.s2k',
        size: 245000,
        lineCount: 3847,
        lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: '2',
    name: 'Köprü_Analiz_Final',
    format: '.r3d',
    fileCount: 5,
    lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000),
    progress: 100,
    tags: ['köprü', 'betonarme', 'eurocode'],
    files: [],
  },
  {
    id: '3',
    name: 'Fabrika_Çelik_Yapı',
    format: '.std',
    fileCount: 2,
    lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    progress: 45,
    tags: ['çelik', 'endüstriyel'],
    files: [],
  },
  {
    id: '4',
    name: 'Deprem_Kontrol_2024',
    format: '.s2k',
    fileCount: 4,
    lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    progress: 92,
    tags: ['deprem', 'tbdy2018'],
    files: [],
  },
  {
    id: '5',
    name: 'AVM_Karkas_Sistem',
    format: '.e2k',
    fileCount: 6,
    lastModified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    progress: 65,
    tags: ['betonarme', 'ticari'],
    files: [],
  },
]

// Mock desteklenen programlar
export const mockSupportedPrograms = [
  {
    id: 'sap2000',
    name: 'SAP2000',
    format: '.s2k',
    status: 'active',
    description: 'Genel amaçlı yapısal analiz',
  },
  {
    id: 'etabs',
    name: 'ETABS',
    format: '.e2k',
    status: 'active',
    description: 'Bina yapıları analizi',
  },
  {
    id: 'risa3d',
    name: 'RISA-3D',
    format: '.r3d',
    status: 'active',
    description: '3D yapısal analiz',
  },
  {
    id: 'staadpro',
    name: 'STAAD Pro',
    format: '.std',
    status: 'active',
    description: 'Çok amaçlı analiz',
  },
  {
    id: 'opensees',
    name: 'OpenSees',
    format: '.tcl',
    status: 'coming-soon',
    description: 'Açık kaynak FE analizi',
  },
  {
    id: 'ansys',
    name: 'ANSYS',
    format: '.inp',
    status: 'coming-soon',
    description: 'Gelişmiş FE analizi',
  },
]

// Mock istatistikler
export const mockStats = {
  totalProjects: 12,
  activeSessions: 3,
  aiOperations: 847,
  agentStatus: 'connected' as const,
}

// Yardımcı fonksiyonlar
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'şimdi'
  if (diffMins < 60) return `${diffMins}dk önce`
  if (diffHours < 24) return `${diffHours}sa önce`
  if (diffDays === 1) return 'dün'
  if (diffDays < 7) return `${diffDays} gün önce`
  return date.toLocaleDateString('tr-TR')
}
