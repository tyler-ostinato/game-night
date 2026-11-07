// 8-bit player characters: a 16×20 pixel grid built from layers (body, hair, extras, crown).
// Each layer is drawn as text: one character per pixel, '.' = transparent. Letters map to colours below.

export const SKINS = ['#f7d7bd', '#ecb994', '#d49c70', '#b0774a', '#8a5735', '#5f3b23']
export const HAIR_COLORS = ['#2b2420', '#4e3426', '#7a4b2a', '#a2451f', '#e2c06c', '#d97a2f', '#b5b5b5', '#4a74dc', '#e46aa6', '#3fae6b']
export const SHIRTS = ['#e04f4f', '#f08a3c', '#f2c94c', '#4caf6a', '#2bb3a6', '#3f7fe0', '#8a5cd6', '#e36aa8', '#8a94a3', '#33373d']

export const HAIR_STYLES = ['short', 'spiky', 'long', 'bun', 'curly', 'bald'] as const
export const EXTRAS = ['none', 'glasses', 'shades', 'beard', 'mustache', 'cap', 'headband'] as const
export type HairStyle = typeof HAIR_STYLES[number]
export type Extra = typeof EXTRAS[number]

export type Look = { skin: number; hair: HairStyle; hairColor: number; shirt: number; extra: Extra; accent: number }

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

const EXTRA: Record<Exclude<Extra, 'none'>, Layer> = {
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
  beard: { top: 11, rows: [
    '..KH...MM...HK..',
    '..KHHH....HHHK..',
    '...KHHHHHHHHK...',
    '....KHHHHHHK....',
  ] },
  mustache: { top: 10, rows: ['.....KHHHHK.....'] },
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
    skin: pick(SKINS.length),
    hair: HAIR_STYLES[pick(HAIR_STYLES.length - 1)], // never bald by default
    hairColor: pick(6),                               // natural colours by default
    shirt: pick(SHIRTS.length),
    extra: 'none',
    accent: pick(SHIRTS.length),
  }
}

export function isLook(v: unknown): v is Look {
  const l = v as Look
  const idx = (x: unknown, n: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n
  return !!l && typeof l === 'object' && idx(l.skin, SKINS.length) && HAIR_STYLES.includes(l.hair)
    && idx(l.hairColor, HAIR_COLORS.length) && idx(l.shirt, SHIRTS.length) && EXTRAS.includes(l.extra) && idx(l.accent, SHIRTS.length)
}

export type Pixel = { x: number; y: number; w: number; color: string }

// Builds the character as horizontal runs of same-coloured pixels (fewer SVG shapes than one per pixel).
export function render(look: Look, place?: 1 | 2 | 3): Pixel[] {
  const skin = SKINS[look.skin], hair = HAIR_COLORS[look.hairColor], shirt = SHIRTS[look.shirt], accent = SHIRTS[look.accent]
  const crown = place ? CROWN_COLORS[place] : null
  const colors: Record<string, string> = {
    K: '#1e1b24', S: skin, s: shade(skin, 0.15), E: '#1e1b24', M: shade(skin, 0.35), W: '#ffffff',
    T: shirt, t: shade(shirt, 0.18), H: hair, h: shade(hair, 0.25), G: '#4a4f5c', L: '#d6ecff', A: accent, a: shade(accent, 0.25),
    C: crown?.[0] ?? '', c: crown?.[1] ?? '', J: crown?.[2] ?? '',
  }
  const grid = BASE.map(r => r.split(''))
  const draw = (layer: Layer) => layer.rows.forEach((row, i) => [...row].forEach((ch, x) => {
    if (ch !== '.' && grid[layer.top + i]) grid[layer.top + i][x] = ch
  }))
  // A crown replaces a hat, so the winner's crown always shows.
  draw(HAIR[look.hair])
  if (look.extra !== 'none' && !(crown && look.extra === 'cap')) draw(EXTRA[look.extra])
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
