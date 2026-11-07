// Character builder: choose a character or just a letter, then body, skin, hair, facial hair,
// eyewear, headwear and shirt. The preview updates as you go.
import { useState } from 'react'
import { api, getToken } from './api'
import { Login } from './Login'
import { setLook, useLook } from './looks'
import {
  BODIES, EYEWEAR, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES, HEADWEAR, SHIRTS, SKINS, type Look,
} from './sprite'
import { Avatar, Sprite } from './ui'

const LABELS: Record<string, string> = {
  neutral: 'Neutral', male: 'Male', female: 'Female', none: 'None', stubble: 'Stubble', mustache: 'Mustache', beard: 'Beard',
  glasses: 'Glasses', shades: 'Shades', cap: 'Cap', headband: 'Headband',
  short: 'Short', spiky: 'Spiky', long: 'Long', bun: 'Bun', curly: 'Curly', bald: 'Bald',
}

const randomLook = (body: Look['body']): Look => {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
  const idx = (n: number) => Math.floor(Math.random() * n)
  return {
    avatar: 'character', body, skin: idx(SKINS.length), hair: pick(HAIR_STYLES), hairColor: idx(HAIR_COLORS.length),
    shirt: idx(SHIRTS.length), facialHair: pick(FACIAL_HAIR), eyewear: pick(EYEWEAR), headwear: pick(HEADWEAR), accent: idx(SHIRTS.length),
  }
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

type Slot = 'body' | 'hair' | 'facialHair' | 'eyewear' | 'headwear'

export function CharacterEditor({ name, testMode, onDone }: { name: string; testMode: boolean; onDone: () => void }) {
  const saved = useLook(name)
  // Opening the editor shows the character straight away; they can still choose the initial.
  const [look, setDraft] = useState<Look>(() => ({ ...saved, avatar: 'character' }))
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

  // Each choice is a little version of the character wearing that option.
  const choices = <K extends Slot>(label: string, field: K, options: readonly Look[K][]) => (
    <fieldset className="char-row">
      <legend>{label}</legend>
      <div className="char-grid">
        {options.map(value => (
          <button key={value} type="button" className={look[field] === value ? 'char-option on' : 'char-option'}
            aria-pressed={look[field] === value} onClick={() => set(field, value)}>
            <Sprite look={{ ...look, [field]: value }} size={44} />
            <span>{LABELS[value]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )

  const letter = look.avatar === 'letter'
  return (
    <div className="card char-editor">
      <div className="char-preview">
        <div className="char-stage">
          {letter ? <Avatar name={name} size={140} /> : <Sprite look={look} />}
        </div>
        {!letter && <>
          <div className="char-crowns" aria-label="With a crown">
            {([1, 2, 3] as const).map(p => <Sprite key={p} look={look} place={p} size={48} />)}
          </div>
          <button type="button" className="ghost" onClick={() => setDraft(randomLook(look.body))}>🎲 Surprise me</button>
        </>}
      </div>
      <div className="char-options">
        <fieldset className="char-row">
          <legend>Picture</legend>
          <div className="segmented" role="group" aria-label="Picture">
            <button type="button" className={letter ? '' : 'on'} aria-pressed={!letter} onClick={() => set('avatar', 'character')}>8-bit character</button>
            <button type="button" className={letter ? 'on' : ''} aria-pressed={letter} onClick={() => set('avatar', 'letter')}>Just my initial</button>
          </div>
          {letter && <p className="muted">No character: a coloured circle with your initial. Places in rankings are still marked with trophies; the crown is for characters.</p>}
        </fieldset>
        {!letter && <>
          {choices('Body', 'body', BODIES)}
          <Swatches label="Skin" colors={SKINS} value={look.skin} onChange={i => set('skin', i)} />
          {choices('Hair', 'hair', HAIR_STYLES)}
          {(look.hair !== 'bald' || look.facialHair !== 'none' || look.body === 'male') &&
            <Swatches label="Hair colour" colors={HAIR_COLORS} value={look.hairColor} onChange={i => set('hairColor', i)} />}
          {choices('Facial hair', 'facialHair', FACIAL_HAIR)}
          {choices('Eyewear', 'eyewear', EYEWEAR)}
          {choices('Headwear', 'headwear', HEADWEAR)}
          {look.headwear !== 'none' &&
            <Swatches label={look.headwear === 'cap' ? 'Cap colour' : 'Headband colour'} colors={SHIRTS} value={look.accent} onChange={i => set('accent', i)} />}
          <Swatches label="Shirt" colors={SHIRTS} value={look.shirt} onChange={i => set('shirt', i)} />
        </>}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
