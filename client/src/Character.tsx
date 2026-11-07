// Character builder: pick skin, hair, shirt and an extra; the preview updates as you go.
import { useState } from 'react'
import { api, getToken } from './api'
import { Login } from './Login'
import { setLook, useLook } from './looks'
import { EXTRAS, HAIR_COLORS, HAIR_STYLES, SHIRTS, SKINS, type Extra, type HairStyle, type Look } from './sprite'
import { Sprite } from './ui'

const EXTRA_LABELS: Record<Extra, string> = {
  none: 'None', glasses: 'Glasses', shades: 'Shades', beard: 'Beard', mustache: 'Mustache', cap: 'Cap', headband: 'Headband',
}

const randomLook = (): Look => {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
  const idx = (n: number) => Math.floor(Math.random() * n)
  return { skin: idx(SKINS.length), hair: pick(HAIR_STYLES), hairColor: idx(HAIR_COLORS.length), shirt: idx(SHIRTS.length), extra: pick(EXTRAS), accent: idx(SHIRTS.length) }
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <fieldset className="char-row">
      <legend>{label}</legend>
      <div className="swatches">
        {colors.map((c, i) => (
          <button key={c} type="button" className={i === value ? 'swatch on' : 'swatch'} style={{ background: c }}
            aria-label={`${label} ${i + 1}`} aria-pressed={i === value} onClick={() => onChange(i)} />
        ))}
      </div>
    </fieldset>
  )
}

export function CharacterEditor({ name, testMode, onDone }: { name: string; testMode: boolean; onDone: () => void }) {
  const saved = useLook(name)
  const [look, setDraft] = useState<Look>(saved)
  const [loggedIn, setLoggedIn] = useState(!!getToken())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Look>(k: K, v: Look[K]) => setDraft(l => ({ ...l, [k]: v }))

  if (!loggedIn && !testMode) return <Login onLogin={() => setLoggedIn(true)} />

  async function save() {
    setError(''); setSaving(true)
    try {
      setLook(name, await api<Look>(`/players/${encodeURIComponent(name)}/look`, { method: 'PUT', body: JSON.stringify(look) }))
      onDone()
    } catch (err) {
      setError((err as Error).message)
      if (!getToken()) setLoggedIn(false)
    } finally { setSaving(false) }
  }

  const option = <T extends string>(field: 'hair' | 'extra', value: T, text: string) => (
    <button key={value} type="button" className={look[field] === value ? 'char-option on' : 'char-option'}
      aria-pressed={look[field] === value} onClick={() => set(field, value as Look[typeof field])}>
      <Sprite look={{ ...look, [field]: value }} size={44} />
      <span>{text}</span>
    </button>
  )

  return (
    <div className="card char-editor">
      <div className="char-preview">
        <div className="char-stage"><Sprite look={look} /></div>
        <div className="char-crowns" aria-label="With a crown">
          {([1, 2, 3] as const).map(p => <Sprite key={p} look={look} place={p} size={48} />)}
        </div>
        <button type="button" className="ghost" onClick={() => setDraft(randomLook())}>🎲 Surprise me</button>
      </div>
      <div className="char-options">
        <Swatches label="Skin" colors={SKINS} value={look.skin} onChange={i => set('skin', i)} />
        <fieldset className="char-row">
          <legend>Hair</legend>
          <div className="char-grid">{HAIR_STYLES.map(h => option<HairStyle>('hair', h, h[0].toUpperCase() + h.slice(1)))}</div>
        </fieldset>
        {look.hair !== 'bald' && <Swatches label="Hair colour" colors={HAIR_COLORS} value={look.hairColor} onChange={i => set('hairColor', i)} />}
        <Swatches label="Shirt" colors={SHIRTS} value={look.shirt} onChange={i => set('shirt', i)} />
        <fieldset className="char-row">
          <legend>Extra</legend>
          <div className="char-grid">{EXTRAS.map(x => option<Extra>('extra', x, EXTRA_LABELS[x]))}</div>
        </fieldset>
        {(look.extra === 'cap' || look.extra === 'headband') &&
          <Swatches label={look.extra === 'cap' ? 'Cap colour' : 'Headband colour'} colors={SHIRTS} value={look.accent} onChange={i => set('accent', i)} />}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save character'}</button>
          <button type="button" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
