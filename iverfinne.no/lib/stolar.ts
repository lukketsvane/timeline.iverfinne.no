const STOLAR_API_URL =
  'https://raw.githubusercontent.com/lukketsvane/stolar-db/main/STOLAR/api.json'

export interface Chair {
  id: string
  name: string
  type?: string
  dating?: string
  year_from?: number
  year_to?: number
  century?: string
  style?: string
  designer?: string
  origin?: string
  nationality?: string
  materials?: string
  materials_desc?: string
  technique?: string
  keywords?: string
  height_cm?: number
  width_cm?: number
  depth_cm?: number
  seat_height_cm?: number
  weight_kg?: number
  acquisition?: string
  museum_url?: string
  source_image_url?: string
  glb_url?: string
  bguw_url?: string
}

export interface StolarData {
  generated: string
  total: number
  with_3d: number
  with_bguw: number
  base_url: string
  chairs: Chair[]
}

let cachedData: StolarData | null = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

export async function getStolarData(): Promise<StolarData> {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return cachedData
  }

  const res = await fetch(STOLAR_API_URL, { next: { revalidate: 3600 } })
  if (!res.ok) {
    throw new Error(`Failed to fetch stolar data: ${res.status}`)
  }

  cachedData = await res.json()
  cacheTime = Date.now()
  return cachedData!
}

export function summarizeForResearch(chairs: Chair[]): string {
  const total = chairs.length
  const withDims = chairs.filter(
    (c) => c.height_cm && c.width_cm && c.depth_cm
  ).length
  const styles = new Map<string, number>()
  const materials = new Map<string, number>()
  const centuries = new Map<string, number>()
  const nationalities = new Map<string, number>()

  for (const c of chairs) {
    if (c.style) styles.set(c.style, (styles.get(c.style) || 0) + 1)
    if (c.century)
      centuries.set(c.century, (centuries.get(c.century) || 0) + 1)
    if (c.nationality)
      nationalities.set(
        c.nationality,
        (nationalities.get(c.nationality) || 0) + 1
      )
    if (c.materials) {
      for (const m of c.materials.split(',').map((s) => s.trim())) {
        if (m) materials.set(m, (materials.get(m) || 0) + 1)
      }
    }
  }

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1])

  const lines = [
    `DATABASE: ${total} stolar, ${withDims} med dimensjonar.`,
    '',
    `STILPERIODAR (${styles.size}):`,
    ...sortDesc(styles).map(([s, n]) => `  ${s}: ${n}`),
    '',
    `HUNDREÅR (${centuries.size}):`,
    ...sortDesc(centuries).map(([c, n]) => `  ${c}: ${n}`),
    '',
    `NASJONALITETAR (topp 10):`,
    ...sortDesc(nationalities)
      .slice(0, 10)
      .map(([n, c]) => `  ${n}: ${c}`),
    '',
    `MATERIALAR (topp 20):`,
    ...sortDesc(materials)
      .slice(0, 20)
      .map(([m, c]) => `  ${m}: ${c}`),
  ]

  return lines.join('\n')
}
