import { getShowLegacy } from './api'

// Shared visual bits: avatars, crowns, medals.

const AVATAR_HUES = [12, 35, 150, 190, 215, 260, 290, 330]

function hueFor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_HUES[h % AVATAR_HUES.length]
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = hueFor(name)
  return (
    <span className="avatar" style={{
      width: size, height: size, fontSize: size * 0.42,
      background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${hue + 25} 65% 45%))`,
    }}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

export type Place = 1 | 2 | 3

export function Crown({ place, size = 28 }: { place: Place; size?: number }) {
  return (
    <svg className={`crown crown-${place}`} width={size} height={size * 0.8} viewBox="0 0 30 24" aria-label={`${place} place`}>
      <path d="M2 7l6.5 5L15 2l6.5 10L28 7l-3 14H5z" fill="currentColor" stroke="rgba(0,0,0,.25)" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="2" cy="7" r="2" fill="currentColor" />
      <circle cx="15" cy="2" r="2" fill="currentColor" />
      <circle cx="28" cy="7" r="2" fill="currentColor" />
      <rect x="5" y="18" width="20" height="3" rx="1" fill="rgba(0,0,0,.18)" />
    </svg>
  )
}

export function Trophy({ size = 16 }: { size?: number }) {
  return (
    <svg className="trophy" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 15v2h3v3H8v-3h3v-2a5 5 0 0 1-2.7-3H8a4 4 0 0 1-4-4V5h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 8V7z" />
    </svg>
  )
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export const prettyDate = (iso: string, withYear = true) =>
  new Date(iso + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) })

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Empty({ what = 'No games recorded yet.' }: { what?: string }) {
  return (
    <div className="empty">
      <p>{what}</p>
      {!getShowLegacy() && <p className="muted">Legacy games are hidden. Turn on "Legacy games" at the top to include them.</p>}
    </div>
  )
}

export const imageUrl = (file: string) => `/api/images/${file}`

// Box-art cover, or a coloured placeholder with the game's initials.
export function GameCover({ name, image, className = '' }: { name: string; image: string | null; className?: string }) {
  // Whole box art scaled to fit, over a blurred copy that fills the leftover space.
  if (image) return (
    <span className={`cover cover-art ${className}`}>
      <img className="cover-blur" src={imageUrl(image)} alt="" aria-hidden="true" loading="lazy" />
      <img className="cover-img" src={imageUrl(image)} alt="" loading="lazy" />
    </span>
  )
  const hue = hueFor(name)
  const initials = name.split(/\s+/).filter(w => /\w/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  return (
    <span className={`cover cover-blank ${className}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue + 40} 60% 28%))` }}>
      {initials}
    </span>
  )
}
