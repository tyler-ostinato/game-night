// 8-bit player characters: a 16×20 pixel grid built from layers (body, hair, extras, crown).
// Each layer is drawn as text: one character per pixel, '.' = transparent. Letters map to colours below.

export const SKINS = ['#f7d7bd', '#ecb994', '#d49c70', '#b0774a', '#8a5735', '#5f3b23']
export const HAIR_COLORS = ['#2b2420', '#4e3426', '#7a4b2a', '#a2451f', '#e2c06c', '#d97a2f', '#b5b5b5', '#4a74dc', '#e46aa6', '#3fae6b']
export const SHIRTS = ['#e04f4f', '#f08a3c', '#f2c94c', '#4caf6a', '#2bb3a6', '#3f7fe0', '#8a5cd6', '#e36aa8', '#8a94a3', '#33373d']

export const AVATARS = ['character', 'letter'] as const
export const BODIES = ['neutral', 'male', 'female'] as const
export const HAIR_STYLES = ['short', 'spiky', 'long', 'bun', 'curly', 'bald'] as const
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'beard'] as const
export const EYEWEAR = ['none', 'glasses', 'shades'] as const
export const HEADWEAR = ['none', 'cap', 'headband'] as const
export type HairStyle = typeof HAIR_STYLES[number]
export type Body = typeof BODIES[number]
export type FacialHair = typeof FACIAL_HAIR[number]
export type Eyewear = typeof EYEWEAR[number]
export type Headwear = typeof HEADWEAR[number]

// avatar 'letter' = no character, just the coloured circle with their initial (still crowned).
export type Look = {
  avatar: typeof AVATARS[number]; body: Body; skin: number; hair: HairStyle; hairColor: number; shirt: number
  facialHair: FacialHair; eyewear: Eyewear; headwear: Headwear; accent: number
}

const BASE = [
  '................',
  '................',
  '................',
  '................',
  '....KKKKKKKK....',
  '...KSSSSSSSSK...',
  '..KSSSSSSSSSSK..',
  '..KSSSSSSSSSSK..',
  '..KSSESSSSESSK..',
  '..KSSESSSSESSK..',
  '.KsSSSSSSSSSSsK.',
  '..KSSSSMMSSSSK..',
  '..KSSSSSSSSSSK..',
  '...KSSSSSSSSK...',
  '....KKSSSSKK....',
  '...KKTTssTTKK...',
  '..KTTTTTTTTTTK..',
  '.KTTTTTTTTTTTTK.',
  '.KTtTTTTTTTTtTK.',
  '.KTtTTTTTTTTtTK.',
]

// Each layer lists its rows from `top`.
type Layer = { top: number; rows: string[] }

const HAIR: Record<HairStyle, Layer> = {
  short: { top: 3, rows: [
    '....KKKKKKKK....',
    '...KHHHHHHHHK...',
    '..KHHHHHHHHHHK..',
    '..KHH......HHK..',
    '..KH........HK..',
  ] },
  spiky: { top: 1, rows: [
    '...K..K..K..K...',
    '..KHKKHKKHKKHK..',
    '..KHHHHHHHHHHK..',
    '..KHHHHHHHHHHK..',
    '..KHHHHHHHHHHK..',
    '..KHH......HHK..',
  ] },
  long: { top: 3, rows: [
    '....KKKKKKKK....',
    '...KHHHHHHHHK...',
    '..KHHHHHHHHHHK..',
    '.KHHH......HHHK.',
    '.KHH........HHK.',
    '.KHH........HHK.',
    '.KHH........HHK.',
    '.KHH........HHK.',
    '.KHH........HHK.',
    '.KHH........HHK.',
    '.KHH........HHK.',
    '.KHHH......HHHK.',
    '.KHHK......KHHK.',
    '..KK........KK..',
  ] },
  bun: { top: 1, rows: [
    '......KKKK......',
    '.....KHHHHK.....',
    '....KKHHHHKK....',
    '...KHHHHHHHHK...',
    '..KHHHHHHHHHHK..',
    '..KHH......HHK..',
  ] },
  curly: { top: 1, rows: [
    '....KKKKKKKK....',
    '..KKHHHHHHHHKK..',
    '.KHHHhHHHHhHHHK.',
    'KHHhHHHHHHHHhHHK',
    'KHHHHHhHHhHHHHHK',
    'KHHH........HHHK',
    'KHH..........HHK',
    '.KH..........HK.',
    '.KH..........HK.',
  ] },
  bald: { top: 5, rows: ['....WW..........'] },
}

// Body shapes: neutral is the base drawing.
const BODY: Record<Body, Layer[]> = {
  neutral: [],
  male: [
    { top: 7, rows: ['....hh....hh....'] },              // eyebrows
    { top: 12, rows: ['..KSSSSSSSSSSK..', '..KSSSSSSSSSSK..', '...KKSSSSSSKK...'] }, // squarer jaw
  ],
  female: [
    { top: 7, rows: ['....K......K....'] },              // eyelashes
    { top: 11, rows: ['.......PP.......'] },             // lips
    { top: 15, rows: [                                    // narrower shoulders, v-neck
      '....KTSSSSTK....',
      '...KTTTSSTTTK...',
      '..KTTTTTTTTTTK..',
      '..KTtTTTTTTtTK..',
      '..KTtTTTTTTtTK..',
    ] },
  ],
}

const FACIAL: Record<Exclude<FacialHair, 'none'>, Layer> = {
  stubble: { top: 11, rows: [
    '...b.b....b.b...',
    '...bbbb..bbbb...',
    '....bbbbbbbb....',
  ] },
  mustache: { top: 10, rows: ['.....KHHHHK.....'] },
  beard: { top: 10, rows: [
    '.....KHHHHK.....',
    '..KH...MM...HK..',
    '..KHHH....HHHK..',
    '...KHHHHHHHHK...',
    '....KHHHHHHK....',
  ] },
}

const EYES: Record<Exclude<Eyewear, 'none'>, Layer> = {
  glasses: { top: 7, rows: [
    '...GGGG..GGGG...',
    '...GLEGGGGELG...',
    '...GLEG..GELG...',
    '...GGGG..GGGG...',
  ] },
  shades: { top: 7, rows: [
    '...GGGGGGGGGG...',
    '...GEEEGGEEEG...',
    '....GGG..GGG....',
  ] },
}

const HATS: Record<Exclude<Headwear, 'none'>, Layer> = {
  cap: { top: 2, rows: [
    '....KKKKKKKK....',
    '...KAAAAAAAAK...',
    '..KAAAAAAAAAAK..',
    '..KaaaaaaaaaaaaK',
  ] },
  headband: { top: 5, rows: ['..KAAAAAAAAAAK..'] },
}

const CROWN: Layer = { top: 0, rows: [
  '...K...KK...K...',
  '..KCK.KCCK.KCK..',
  '..KCCKKCCKKCCK..',
  '..KCCCCCCCCCCK..',
  '..KCCCJCCJCCCK..',
  '..KccccccccccK..',
  '...KKKKKKKKKK...',
] }

export const CROWN_COLORS: Record<1 | 2 | 3, [string, string, string]> = {
  1: ['#f5c518', '#c9971c', '#e0457b'],
  2: ['#dfe3e8', '#9aa3ad', '#3f7fe0'],
  3: ['#d8904f', '#9c5d2c', '#4caf6a'],
}

// Darken a #rrggbb colour by a fraction, for shading.
export function shade(hex: string, amount = 0.2) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - amount))
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

// Same name → same character, so everyone has one before customising.
export function defaultLook(name: string): Look {
  let h = 2166136261
  for (const c of name.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const pick = (n: number) => { const v = h % n; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; return v }
  return {
    avatar: 'character',
    body: 'neutral',                                  // never guessed from a name
    skin: pick(SKINS.length),
    hair: HAIR_STYLES[pick(HAIR_STYLES.length - 1)], // never bald by default
    hairColor: pick(6),                               // natural colours by default
    shirt: pick(SHIRTS.length),
    facialHair: 'none', eyewear: 'none', headwear: 'none',
    accent: pick(SHIRTS.length),
  }
}

// Characters saved before facial hair, eyewear and headwear were separate had one `extra`.
export function normalizeLook(v: unknown): Look | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const extra = o.extra as string | undefined
  const l = {
    avatar: 'character', body: 'neutral', facialHair: 'none', eyewear: 'none', headwear: 'none',
    ...(extra && (FACIAL_HAIR as readonly string[]).includes(extra) ? { facialHair: extra } : {}),
    ...(extra && (EYEWEAR as readonly string[]).includes(extra) ? { eyewear: extra } : {}),
    ...(extra && (HEADWEAR as readonly string[]).includes(extra) ? { headwear: extra } : {}),
    ...o,
  }
  delete (l as Record<string, unknown>).extra
  return isLook(l) ? l : null
}

export function isLook(v: unknown): v is Look {
  const l = v as Look
  const idx = (x: unknown, n: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n
  const one = <T,>(xs: readonly T[], x: unknown) => xs.includes(x as T)
  return !!l && typeof l === 'object' && one(AVATARS, l.avatar) && one(BODIES, l.body) && idx(l.skin, SKINS.length)
    && one(HAIR_STYLES, l.hair) && idx(l.hairColor, HAIR_COLORS.length) && idx(l.shirt, SHIRTS.length)
    && one(FACIAL_HAIR, l.facialHair) && one(EYEWEAR, l.eyewear) && one(HEADWEAR, l.headwear) && idx(l.accent, SHIRTS.length)
}

export type Pixel = { x: number; y: number; w: number; color: string }

// Builds the character as horizontal runs of same-coloured pixels (fewer SVG shapes than one per pixel).
export function render(look: Look, place?: 1 | 2 | 3): Pixel[] {
  const skin = SKINS[look.skin], hair = HAIR_COLORS[look.hairColor], shirt = SHIRTS[look.shirt], accent = SHIRTS[look.accent]
  const crown = place ? CROWN_COLORS[place] : null
  const colors: Record<string, string> = {
    K: '#1e1b24', S: skin, s: shade(skin, 0.15), E: '#1e1b24', M: shade(skin, 0.35), W: '#ffffff',
    P: '#c8506e', b: shade(skin, 0.22), T: shirt, t: shade(shirt, 0.18), H: hair, h: shade(hair, 0.25), G: '#4a4f5c', L: '#d6ecff', A: accent, a: shade(accent, 0.25),
    C: crown?.[0] ?? '', c: crown?.[1] ?? '', J: crown?.[2] ?? '',
  }
  const grid = BASE.map(r => r.split(''))
  const draw = (layer: Layer) => layer.rows.forEach((row, i) => [...row].forEach((ch, x) => {
    if (ch !== '.' && grid[layer.top + i]) grid[layer.top + i][x] = ch
  }))
  BODY[look.body].forEach(draw)
  draw(HAIR[look.hair])
  if (look.facialHair !== 'none') draw(FACIAL[look.facialHair])
  if (look.eyewear !== 'none') draw(EYES[look.eyewear])
  // A crown replaces a cap, so the winner's crown always shows.
  if (look.headwear !== 'none' && !(crown && look.headwear === 'cap')) draw(HATS[look.headwear])
  if (crown) draw(CROWN)

  const out: Pixel[] = []
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const color = colors[row[x]]
      let w = 1
      while (x + w < row.length && row[x + w] === row[x]) w++
      if (color) out.push({ x, y, w, color })
      x += w
    }
  })
  return out
}
