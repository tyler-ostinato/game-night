import { useEffect, useState } from 'react'
import { api, getToken } from './api'
import { Login } from './Login'
import { Avatar, Empty, GameCover, Trophy, plural, prettyDate } from './ui'

export type Expansion = { id: number; name: string; plays: number }
export type Game = {
  id: number; name: string; image: string | null; plays: number; totalPlays: number
  podium: { name: string; wins: number; place: number }[]; expansions: Expansion[]
}
export type Picked = { gameId: number | null; expansionIds: number[] }

function useGames() {
  const [games, setGames] = useState<Game[] | null>(null)
  const reload = () => api<Game[]>('/games').then(setGames)
  useEffect(() => { reload() }, [])
  return [games, reload] as const
}

// Small inline "name + Save" form used for adding and renaming.
export function NameForm({ initial = '', placeholder, submitLabel, onSubmit, onCancel, keepValue }: {
  initial?: string; placeholder: string; submitLabel: string; keepValue?: boolean
  onSubmit: (name: string) => Promise<unknown>; onCancel?: () => void
}) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState('')
  async function submit() {
    if (!name.trim()) return
    setError('')
    try { await onSubmit(name.trim()); if (!keepValue) setName('') }
    catch (err) { setError((err as Error).message) }
  }
  return (
    <div className="name-form">
      <input value={name} placeholder={placeholder} autoFocus={!!onCancel} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } if (e.key === 'Escape') onCancel?.() }} />
      <button type="button" className="primary" onClick={submit}>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      {error && <span className="error">{error}</span>}
    </div>
  )
}

const post = (path: string, name: string) => api<{ id: number }>(path, { method: 'POST', body: JSON.stringify({ name }) })
const patch = (path: string, name: string) => api(path, { method: 'PATCH', body: JSON.stringify({ name }) })
const del = (path: string) => api(path, { method: 'DELETE' })

type GameStats = {
  id: number; name: string; image: string | null; plays: number; nights: number; players: number
  firstPlayed: string | null; lastPlayed: string | null
  highScore: { player: string; score: number; date: string } | null
  avgWinningScore: number | null; avgTableSize: number | null
  standings: { name: string; wins: number; played: number; winRate: number | null; bestScore: number | null }[]
  expansions: { name: string; plays: number }[]
  recent: { playId: number; date: string; legacy: number; expansions: string | null; winners: string[]; topScore: number | null; players: number }[]
}

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`)

export function GamesPage({ testMode, bgg, onPlayer }: { testMode: boolean; bgg: boolean; onPlayer: (name: string) => void }) {
  const [games, reload] = useGames()
  const [selected, setSelected] = useState<number | null>(null)
  const [loggedIn, setLoggedIn] = useState(!!getToken())
  const [adding, setAdding] = useState(false)
  const canEdit = loggedIn || testMode

  if (!games) return null
  if (selected != null) return (
    <GameDetail id={selected} canEdit={canEdit} bgg={bgg} onLogin={() => setLoggedIn(true)} onPlayer={onPlayer}
      onBack={() => { setSelected(null); reload() }} />
  )

  return (
    <section className="stack">
      <div className="page-head-row">
        <div className="page-head"><h2>Games</h2><p className="muted">{plural(games.length, 'game')} in the collection</p></div>
        {!adding && <button className="primary" onClick={() => setAdding(true)}>+ Add game</button>}
      </div>
      {adding && (canEdit
        ? <div className="card">
            <NameForm placeholder="New game name" submitLabel="Add game" onCancel={() => setAdding(false)}
              onSubmit={n => post('/games', n).then(() => { setAdding(false); reload() })} />
          </div>
        : <Login onLogin={() => setLoggedIn(true)} />)}
      <div className="game-grid">
        {games.map(g => (
          <button key={g.id} className="game-tile" onClick={() => { setSelected(g.id); window.scrollTo(0, 0) }}>
            <GameCover name={g.name} image={g.image} className="tile-cover" />
            <span className="game-tile-name">{g.name}</span>
            <span className="muted">{plural(g.plays, 'play')}</span>
            <span className="game-tile-podium">
              {g.podium.length
                ? g.podium.map(r => (
                    <span key={r.name} className="game-tile-champ">
                      <Avatar name={r.name} size={30} place={Math.min(r.place, 3)} />
                      <b>{r.name}</b><small>{plural(r.wins, 'win')}</small>
                    </span>
                  ))
                : <small>No winner yet</small>}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function GameDetail({ id, canEdit, bgg, onLogin, onPlayer, onBack }: {
  id: number; canEdit: boolean; bgg: boolean; onLogin: () => void; onPlayer: (name: string) => void; onBack: () => void
}) {
  const [stats, setStats] = useState<GameStats | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const load = () => api<GameStats>(`/games/${id}/stats`).then(setStats, e => setError(e.message))
  useEffect(() => { load() }, [id])

  if (error) return <p className="error">{error}</p>
  if (!stats) return null
  const ranked = stats.standings.map(s => ({ ...s, place: 1 + stats.standings.filter(o => o.wins > s.wins).length }))
  const maxWins = Math.max(1, ...ranked.map(r => r.wins))

  return (
    <section className="stack">
      <button className="back" onClick={onBack}>← All games</button>
      <div className="profile-hero game-hero">
        <GameCover name={stats.name} image={stats.image} className="hero-cover" />
        <div>
          <h2>{stats.name}</h2>
          <p className="muted">
            {stats.firstPlayed ? <>First played {prettyDate(stats.firstPlayed)} · last played {prettyDate(stats.lastPlayed!)}</> : 'Not played yet'}
          </p>
        </div>
        <div className="hero-wins"><span>{stats.plays}</span>{stats.plays === 1 ? 'play' : 'plays'}</div>
        <button className="hero-edit" onClick={() => setEditing(e => !e)}>{editing ? 'Done' : 'Edit'}</button>
      </div>

      {editing && (canEdit
        ? <GameEditor id={id} bgg={bgg} onChanged={load} onDeleted={onBack} />
        : <Login onLogin={onLogin} />)}

      {stats.plays === 0 ? <Empty what="Nobody has played this one yet." /> : <>
        <div className="stat-grid">
          <div className="stat"><span className="stat-label">Champion</span>
            <span className="stat-value">{ranked[0]?.wins ? <button className="link" onClick={() => onPlayer(ranked[0].name)}>{ranked[0].name}</button> : '—'}</span>
            {ranked[0]?.wins > 0 && <span className="notes">{plural(ranked[0].wins, 'win')}</span>}</div>
          {stats.highScore && <div className="stat"><span className="stat-label">High score</span>
            <span className="stat-value">{stats.highScore.score.toLocaleString()}</span>
            <span className="notes">{stats.highScore.player} · {prettyDate(stats.highScore.date)}</span></div>}
          {stats.avgWinningScore != null && <div className="stat"><span className="stat-label">Avg winning score</span>
            <span className="stat-value">{stats.avgWinningScore.toLocaleString()}</span></div>}
          <div className="stat"><span className="stat-label">Game nights</span><span className="stat-value">{stats.nights}</span></div>
          <div className="stat"><span className="stat-label">Different players</span><span className="stat-value">{stats.players}</span></div>
          {stats.avgTableSize != null && <div className="stat"><span className="stat-label">Avg table size</span>
            <span className="stat-value">{stats.avgTableSize}</span><span className="notes">players per game</span></div>}
        </div>

        <h3 className="section-title">Who wins</h3>
        <div className="list-card">
          {ranked.map(r => (
            <button key={r.name} className="rank-row" onClick={() => onPlayer(r.name)}>
              <span className="rank-num">{r.place}</span>
              <Avatar name={r.name} size={40} place={r.wins > 0 ? r.place : undefined} />
              <span className="rank-name">{r.name}<small>played {r.played} · {pct(r.winRate)} win rate*{r.bestScore != null && ` · best ${r.bestScore.toLocaleString()}`}</small></span>
              <span className="rank-bar"><span style={{ width: `${(r.wins / maxWins) * 100}%` }} /></span>
              <span className="rank-wins">{r.wins}</span>
            </button>
          ))}
        </div>

        {stats.expansions.length > 0 && <>
          <h3 className="section-title">Expansions played</h3>
          <div className="chips">{stats.expansions.map(e => <span key={e.name} className="chip big-chip">{e.name} · {plural(e.plays, 'play')}</span>)}</div>
        </>}

        <h3 className="section-title">Every game</h3>
        <div className="list-card">
          {stats.recent.map(p => (
            <div key={p.playId} className="history-row">
              <span className="muted history-date">{prettyDate(p.date)}</span>
              <span className="game-main">
                {p.winners.length
                  ? p.winners.map(w => <button key={w} className="winner" onClick={() => onPlayer(w)}><Trophy /> {w}</button>)
                  : <span className="muted">No winner</span>}
                {p.expansions && <span className="chips">{p.expansions.split(', ').map(e => <span key={e} className="chip">{e}</span>)}</span>}
              </span>
              <span className="muted">{[p.topScore != null && `${p.topScore.toLocaleString()} pts`, p.players > 1 && `${p.players} players`].filter(Boolean).join(' · ')}</span>
              {p.legacy ? <span className="pill">legacy</span> : <span />}
            </div>
          ))}
        </div>
        <p className="footnote">* Win rate only counts games where everyone who played was recorded.</p>
      </>}
    </section>
  )
}

// Rename the game, manage its expansions, or delete it if it's never been played.
function GameEditor({ id, bgg, onChanged, onDeleted }: { id: number; bgg: boolean; onChanged: () => void; onDeleted: () => void }) {
  const [games, reload] = useGames()
  const [editingExp, setEditingExp] = useState<number | null>(null)
  const [error, setError] = useState('')
  const game = games?.find(g => g.id === id)
  if (!game) return null
  const refresh = () => { reload(); onChanged() }
  const run = (p: Promise<unknown>, then = refresh) => { setError(''); p.then(then, err => setError(err.message)) }

  return (
    <div className="card editor">
      <h3 className="card-title">Edit game</h3>
      <label className="field-label">Name</label>
      <NameForm key={game.name} initial={game.name} placeholder="Game name" submitLabel="Save name" keepValue
        onSubmit={n => patch(`/games/${id}`, n).then(refresh)} />

      <label className="field-label">Cover image</label>
      <ImageEditor game={game} bgg={bgg} onChanged={refresh} />

      <label className="field-label">Expansions</label>
      {game.expansions.length === 0 && <p className="muted">No expansions yet.</p>}
      <ul className="exp-list">
        {game.expansions.map(e => (
          <li key={e.id}>
            {editingExp === e.id
              ? <NameForm initial={e.name} placeholder="Expansion name" submitLabel="Save" onCancel={() => setEditingExp(null)}
                  onSubmit={n => patch(`/expansions/${e.id}`, n).then(() => { setEditingExp(null); refresh() })} />
              : <>
                  <span>{e.name} <small>· {plural(e.plays, 'play')}</small></span>
                  <span className="actions">
                    <button onClick={() => setEditingExp(e.id)}>Rename</button>
                    {e.plays === 0 && <button className="danger" onClick={() => confirm(`Delete ${e.name}?`) && run(del(`/expansions/${e.id}`))}>Delete</button>}
                  </span>
                </>}
          </li>
        ))}
      </ul>
      <NameForm placeholder="Add an expansion…" submitLabel="Add" onSubmit={n => post(`/games/${id}/expansions`, n).then(refresh)} />

      {game.totalPlays === 0 && (
        <div className="danger-zone">
          <span className="muted">This game has never been played, so it can be deleted.</span>
          <button className="danger" onClick={() => confirm(`Delete ${game.name}?`) && run(del(`/games/${id}`), onDeleted)}>Delete game</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

// Shrink big photos before upload so covers stay small and quick to load.
function fileToDataUrl(file: File, maxSize = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/webp', 0.85))
    }
    img.onerror = () => reject(new Error("That file isn't an image the browser can read."))
    img.src = URL.createObjectURL(file)
  })
}

type BggResult = { id: number; name: string; year: string | null; type: string }

function ImageEditor({ game, bgg, onChanged }: { game: Game; bgg: boolean; onChanged: () => void }) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState(game.name)
  const [results, setResults] = useState<BggResult[] | null>(null)

  async function save(body: object) {
    setBusy(true); setError('')
    try {
      await api(`/games/${game.id}/image`, { method: 'PUT', body: JSON.stringify(body) })
      setLink(''); setResults(null); onChanged()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  async function search() {
    setBusy(true); setError('')
    try { setResults(await api<BggResult[]>(`/bgg/search?q=${encodeURIComponent(query)}`)) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="image-editor">
      <GameCover name={game.name} image={game.image} className="editor-cover" />
      <div className="image-actions">
        <div className="name-form">
          <input placeholder="Paste an image link…" value={link} onChange={e => setLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && link.trim()) { e.preventDefault(); save({ url: link.trim() }) } }} />
          <button type="button" className="primary" disabled={busy || !link.trim()} onClick={() => save({ url: link.trim() })}>Use link</button>
        </div>
        <div className="actions">
          <label className="button-like">
            Upload photo
            <input type="file" accept="image/*" hidden onChange={async e => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) {
                try { await save({ dataUrl: await fileToDataUrl(file) }) }
                catch (err) { setError((err as Error).message) }
              }
            }} />
          </label>
          {game.image && <button type="button" className="danger" disabled={busy}
            onClick={() => api(`/games/${game.id}/image`, { method: 'DELETE' }).then(onChanged)}>Remove</button>}
        </div>
        {bgg && <>
          <div className="name-form">
            <input placeholder="Search BoardGameGeek…" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }} />
            <button type="button" disabled={busy} onClick={search}>Search BGG</button>
          </div>
          {results && (results.length
            ? <div className="bgg-results">
                {results.map(r => (
                  <button type="button" key={r.id} disabled={busy} onClick={() => save({ bggId: r.id })}>
                    {r.name}{r.year && <small> ({r.year})</small>}{r.type === 'boardgameexpansion' && <small> · expansion</small>}
                  </button>
                ))}
              </div>
            : <p className="muted">No matches on BoardGameGeek.</p>)}
        </>}
        {busy && <span className="muted">Working…</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  )
}

// Tile grid of games + expansion chips for the add-a-play form, with quick-add for both.
export function GamePicker({ value, onChange }: { value: Picked; onChange: (v: Picked) => void }) {
  const [games, reload] = useGames()
  const [addingGame, setAddingGame] = useState(false)
  const [addingExp, setAddingExp] = useState(false)
  const [filter, setFilter] = useState('')
  const game = games?.find(g => g.id === value.gameId)

  const toggle = (id: number) => onChange({
    ...value,
    expansionIds: value.expansionIds.includes(id) ? value.expansionIds.filter(e => e !== id) : [...value.expansionIds, id],
  })
  const shown = games?.filter(g => g.name.toLowerCase().includes(filter.trim().toLowerCase())) ?? []

  return (
    <>
      <div className="field">
        <div className="field-head">
          <span className="field-title">Game</span>
          {game && <button type="button" className="link" onClick={() => onChange({ gameId: null, expansionIds: [] })}>Change</button>}
        </div>
        {game
          ? <div className="picked-game">
              <GameCover name={game.name} image={game.image} className="picked-cover" />
              <span className="game-tile-name">{game.name}</span>
            </div>
          : <>
              {(games?.length ?? 0) > 6 && <input placeholder="Search games…" value={filter} onChange={e => setFilter(e.target.value)} />}
              <div className="pick-grid">
                {shown.map(g => (
                  <button type="button" key={g.id} className="pick-tile" onClick={() => { onChange({ gameId: g.id, expansionIds: [] }); setFilter('') }}>
                    <GameCover name={g.name} image={g.image} className="pick-cover" />
                    <span className="pick-name">{g.name}</span>
                  </button>
                ))}
                {!addingGame && (
                  <button type="button" className="pick-tile pick-new" onClick={() => setAddingGame(true)}>
                    <span className="pick-cover pick-plus">+</span>
                    <span className="pick-name">New game</span>
                  </button>
                )}
              </div>
              {addingGame && <NameForm initial={filter} placeholder="New game name" submitLabel="Add" onCancel={() => setAddingGame(false)}
                onSubmit={async n => {
                  const { id } = await post('/games', n)
                  await reload()
                  setAddingGame(false); setFilter('')
                  onChange({ gameId: id, expansionIds: [] })
                }} />}
            </>}
      </div>
      {game && (
        <div className="field">
          <span className="field-title">Expansions <small>(optional)</small></span>
          <div className="exp-checks">
            {game.expansions.map(e => (
              <button type="button" key={e.id} className={value.expansionIds.includes(e.id) ? 'check-chip on' : 'check-chip'} onClick={() => toggle(e.id)}>
                {value.expansionIds.includes(e.id) ? '✓ ' : ''}{e.name}
              </button>
            ))}
            {!addingExp && <button type="button" className="check-chip add" onClick={() => setAddingExp(true)}>+ New expansion</button>}
          </div>
          {addingExp && <NameForm placeholder="New expansion" submitLabel="Add" onCancel={() => setAddingExp(false)}
            onSubmit={async n => {
              const { id } = await post(`/games/${game.id}/expansions`, n)
              await reload()
              setAddingExp(false)
              onChange({ ...value, expansionIds: [...value.expansionIds, id] })
            }} />}
        </div>
      )}
    </>
  )
}
