import { useEffect, useRef, useState } from 'react'
import { api, getToken, setToken, getShowLegacy, setShowLegacy } from './api'
import { Login } from './Login'
import { ActivityChart, RangeFilter, presetRange, type Range } from './Activity'
import { PlayersPage, PlayerProfile } from './Players'
import { Avatar, Crown, Empty, Trophy, ordinal, plural, prettyDate } from './ui'
import { GamesPage, GamePicker, type Picked } from './Games'
import { endTimeFor, isoDate } from './time'

type Play = {
  id: number; session_id: number; date: string; end_time: string | null; game: string
  expansions: string | null; notes: string | null; legacy: number; winners: string | null; top_score: number | null
}
type Leader = { name: string; wins: number; played: number; nights: number; winRate: number | null }
type Record = { game: string; player: string; score: number; date: string }

type Tab = 'leaderboard' | 'players' | 'history' | 'records' | 'games' | 'night'

const TABS: { id: Tab; label: string }[] = [
  { id: 'night', label: 'Game night' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'players', label: 'Players' },
  { id: 'history', label: 'History' },
  { id: 'records', label: 'Records' },
  { id: 'games', label: 'Games' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('night')
  const [player, setPlayer] = useState<string | null>(null)
  const [version, setVersion] = useState(0) // bump to refetch after adding a play

  const [showLegacy, setLegacy] = useState(getShowLegacy)
  const toggleLegacy = () => { setShowLegacy(!showLegacy); setLegacy(!showLegacy) }

  const mode = useApi<{ test: boolean; bgg: boolean }>('/mode')

  const open = (t: Tab) => { setTab(t); setPlayer(null); window.scrollTo(0, 0) }
  const showPlayer = (n: string) => { setPlayer(n); window.scrollTo(0, 0) }

  return (
    <>
      {mode?.test && <div className="test-banner">TEST MODE · no password · changes go to a copy and are wiped on restart</div>}
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => open('night')}>
            <span className="brand-mark"><Crown place={1} size={22} /></span>
            Game Night
          </button>
          <nav className="tabs">
            {TABS.map(t => (
              <button key={t.id} className={tab === t.id && (!player || t.id === 'players') ? 'tab active' : 'tab'} onClick={() => open(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <label className="legacy-toggle" title="Legacy games came from the old notebook and are less complete">
            <input type="checkbox" checked={showLegacy} onChange={toggleLegacy} />
            <span className="switch" />
            Legacy games
          </label>
          {!mode?.test && getToken() && (
            <button className="ghost logout" onClick={async () => {
              await api('/logout', { method: 'POST' }).catch(() => {})
              setToken(null)
              location.reload()
            }}>Log out</button>
          )}
        </div>
      </header>
      <main className="page" key={`${version}-${showLegacy}`}>
        {player ? <PlayerProfile name={player} testMode={!!mode?.test} onPlayer={showPlayer} onBack={() => open('players')} />
          : tab === 'players' ? <PlayersPage testMode={!!mode?.test} onPlayer={showPlayer} />
          : tab === 'leaderboard' ? <Leaderboard onPlayer={showPlayer} />
          : tab === 'history' ? <History onPlayer={showPlayer} />
          : tab === 'records' ? <Records onPlayer={showPlayer} />
          : tab === 'games' ? <GamesPage testMode={!!mode?.test} bgg={!!mode?.bgg} onPlayer={showPlayer} />
          : <GameNight testMode={!!mode?.test} onChange={() => setVersion(v => v + 1)} />}
      </main>
    </>
  )
}

// New plays store an ISO timestamp; legacy ones kept the notebook's text (e.g. "2:40am").
const formatTime = (t: string) =>
  t.includes('T') ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : t

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => { api<T>(path).then(setData) }, [path])
  return data
}

export function PageHead({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div className="page-head">
      <h2>{title}</h2>
      {sub && <p className="muted">{sub}</p>}
    </div>
  )
}

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`)

function Leaderboard({ onPlayer }: { onPlayer: (n: string) => void }) {
  const all = useApi<Leader[]>('/players')
  if (!all) return null
  const rows = all.filter(r => r.played > 0) // newly added players show up once they've played
  if (!rows.length) return <section className="stack"><PageHead title="Leaderboard" /><Empty /></section>
  // Tied players share a place (two 1sts, then 3rd).
  const ranked = rows.map(r => ({ ...r, place: 1 + rows.filter(o => o.wins > r.wins).length }))
  // Only players with at least one win can make the podium.
  const podium = ranked.filter(r => r.wins > 0).slice(0, 3)
  const rest = ranked.slice(podium.length)
  const maxWins = Math.max(1, ...rows.map(r => r.wins))
  // Classic podium order: 2nd, 1st, 3rd.
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium

  return (
    <section className="stack">
      <PageHead title="Leaderboard" sub={getShowLegacy() ? 'All-time wins across every game night' : 'Wins from game nights logged on the site'} />
      <div className="podium" style={{ gridTemplateColumns: `repeat(${podium.length}, minmax(0, 260px))` }}>
        {podiumOrder.map(p => (
          <button key={p.name} className={`podium-spot place-${Math.min(p.place, 3)}`} onClick={() => onPlayer(p.name)}>
            <Avatar name={p.name} size={p.place === 1 ? 96 : 76} place={p.place} />
            <span className="podium-name">{p.name}</span>
            <span className="podium-wins">{p.wins}<small> {p.wins === 1 ? 'win' : 'wins'}</small></span>
            <span className="podium-step">{ordinal(p.place)}</span>
          </button>
        ))}
      </div>
      {rest.length > 0 && <div className="list-card">
        {rest.map(r => (
          <button key={r.name} className="rank-row" onClick={() => onPlayer(r.name)}>
            <span className="rank-num">{r.place}</span>
            <Avatar name={r.name} size={36} />
            <span className="rank-name">{r.name}<small>{plural(r.nights, 'night')} · {pct(r.winRate)} win rate</small></span>
            <span className="rank-bar"><span style={{ width: `${(r.wins / maxWins) * 100}%` }} /></span>
            <span className="rank-wins">{r.wins}</span>
          </button>
        ))}
      </div>}
    </section>
  )
}

const PAGE = 10

function History({ onPlayer }: { onPlayer: (n: string) => void }) {
  const plays = useApi<Play[]>('/plays')
  const [shown, setShown] = useState(PAGE)
  const [range, setRange] = useState<Range | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  // Group games into their game night, keeping newest first.
  const allNights: { id: number; date: string; plays: Play[] }[] = []
  for (const p of plays ?? []) {
    const last = allNights[allNights.length - 1]
    if (last?.id === p.session_id) last.plays.push(p)
    else allNights.push({ id: p.session_id, date: p.date, plays: [p] })
  }
  const first = allNights[allNights.length - 1]?.date ?? ''
  const latest = allNights[0]?.date ?? ''
  const active = range ?? presetRange('all', first, latest)
  const nights = allNights.filter(n => n.date >= active.from && n.date <= active.to)
  const games = nights.reduce((n, x) => n + x.plays.length, 0)

  // Load the next page when the bottom of the list scrolls into view.
  const more = shown < nights.length
  useEffect(() => {
    const el = sentinel.current
    if (!el || !more) return
    const obs = new IntersectionObserver(es => { if (es[0].isIntersecting) setShown(n => n + PAGE) }, { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [more, shown])

  if (!plays) return null
  if (!plays.length) return <section className="stack"><PageHead title="History" /><Empty /></section>
  return (
    <section className="stack">
      <PageHead title="History" sub={`${plural(nights.length, 'game night')} · ${plural(games, 'game')} played in this time frame`} />
      <RangeFilter value={active} first={first} last={latest} onChange={r => { setRange(r); setShown(PAGE) }} />
      <ActivityChart nights={nights.map(n => ({ date: n.date, games: n.plays.map(p => p.game) }))}
        allGames={plays.map(p => p.game)} grain={active.grain} from={active.from} to={active.to} />
      <h3 className="section-title">Game nights in this time frame</h3>
      {nights.length === 0 && <Empty what="No game nights in this time frame." />}
      <div className="timeline">
        {nights.slice(0, shown).map(n => (
          <article key={n.id} className="night-card">
            <header className="night-card-head">
              <span className="night-date">{prettyDate(n.date)}</span>
              <span className="muted">{plural(n.plays.length, 'game')}</span>
              {n.plays.some(p => p.legacy) && <span className="pill">legacy</span>}
            </header>
            {n.plays.slice().reverse().map(p => (
              <div key={p.id} className="game-row">
                <div className="game-main">
                  <span className="game-name">{p.game}</span>
                  {p.expansions && <span className="chips">{p.expansions.split(', ').map(e => <span key={e} className="chip">{e}</span>)}</span>}
                  {p.notes && <span className="game-notes">{p.notes.split('|').join(' · ')}</span>}
                </div>
                <div className="game-result">
                  {p.winners
                    ? p.winners.split(', ').map(w => (
                        <button key={w} className="winner" onClick={() => onPlayer(w)}>
                          <Trophy /> <Avatar name={w} size={24} /> {w}
                        </button>
                      ))
                    : <span className="muted">No winner</span>}
                  {p.top_score != null && <span className="score-badge">{p.top_score.toLocaleString()} pts</span>}
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
      {more
        ? <div ref={sentinel} className="load-more"><button onClick={() => setShown(n => n + PAGE)}>Load more</button></div>
        : nights.length > PAGE && <p className="footnote center">That's every game night.</p>}
    </section>
  )
}

function Records({ onPlayer }: { onPlayer: (n: string) => void }) {
  const rows = useApi<Record[]>('/records')
  if (!rows) return null
  return (
    <section className="stack">
      <PageHead title="Records" sub="Highest score ever posted in each game" />
      {rows.length === 0 && <Empty what="No scores recorded yet." />}
      <div className="record-grid">
        {rows.map(r => (
          <article key={r.game + r.player} className="record-card">
            <span className="record-game">{r.game}</span>
            <span className="record-score">{r.score.toLocaleString()}</span>
            <button className="record-holder" onClick={() => onPlayer(r.player)}>
              <Avatar name={r.player} size={28} /> <span>{r.player}<small>{prettyDate(r.date)}</small></span>
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

type Row = { name: string; score: string; placement: string }

type PlayInput = {
  gameId: number | null; expansionIds: number[]; notes: string; time: string
  players: { name: string; placement: number; score: number | null }[]
}

// Saves a play to the running session, or with onCollect hands it to the parent instead (past game nights).
function AddPlay({ onSaved, onCollect }: { onSaved?: () => void; onCollect?: (p: PlayInput) => void }) {
  const options = useApi<{ players: string[] }>('/options')
  const [picked, setPicked] = useState<Picked>({ gameId: null, expansionIds: [] })
  const [notes, setNotes] = useState('')
  const [time, setTime] = useState('')
  const [rows, setRows] = useState<Row[]>([{ name: '', score: '', placement: '1' }, { name: '', score: '', placement: '2' }])
  const [error, setError] = useState('')

  const update = (i: number, k: keyof Row, v: string) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const inRows = (name: string) => rows.some(r => r.name.trim().toLowerCase() === name.toLowerCase())
  // Tap a regular to drop them into the next empty row (or tap again to remove them).
  const togglePlayer = (name: string) => setRows(rs => {
    if (rs.some(r => r.name.trim().toLowerCase() === name.toLowerCase())) {
      const kept = rs.filter(r => r.name.trim().toLowerCase() !== name.toLowerCase())
      return kept.length ? kept : [{ name: '', score: '', placement: '1' }]
    }
    const empty = rs.findIndex(r => !r.name.trim())
    if (empty >= 0) return rs.map((r, j) => j === empty ? { ...r, name } : r)
    return [...rs, { name, score: '', placement: String(rs.length + 1) }]
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const play: PlayInput = {
      ...picked, notes, time,
      players: rows.filter(r => r.name.trim()).map(r => ({
        name: r.name, placement: Number(r.placement), score: r.score === '' ? null : Number(r.score),
      })),
    }
    if (onCollect) {
      if (!play.gameId) return setError('Pick a game.')
      if (!play.players.length || play.players.some(p => !(p.placement >= 1))) return setError('Need a name + placement for every player.')
      return onCollect(play)
    }
    try {
      await api('/plays', { method: 'POST', body: JSON.stringify(play) })
      onSaved?.()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <datalist id="players">{options?.players.map(p => <option key={p} value={p} />)}</datalist>
      <GamePicker value={picked} onChange={setPicked} />
      <fieldset>
        <legend>Everyone who played</legend>
        {!!options?.players.length && (
          <div className="exp-checks">
            {options.players.map(p => (
              <button type="button" key={p} className={inRows(p) ? 'check-chip player-chip on' : 'check-chip player-chip'} onClick={() => togglePlayer(p)}>
                <Avatar name={p} size={22} /> {p}
              </button>
            ))}
          </div>
        )}
        <div className="player-row head"><span>Player</span><span>Score</span><span>Place</span></div>
        {rows.map((r, i) => (
          <div className="player-row" key={i}>
            <input list="players" placeholder="Name" value={r.name} onChange={e => update(i, 'name', e.target.value)} />
            <input type="number" inputMode="numeric" placeholder="—" value={r.score} onChange={e => update(i, 'score', e.target.value)} />
            <input type="number" inputMode="numeric" min="1" value={r.placement} onChange={e => update(i, 'placement', e.target.value)} />
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setRows(rs => [...rs, { name: '', score: '', placement: String(rs.length + 1) }])}>+ Add player</button>
      </fieldset>
      <label>Notes<textarea rows={2} placeholder="Anything memorable?" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {onCollect && (
        <label>Finished at <span className="muted">(optional, leave blank if you don't remember)</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <button type="submit" className={onCollect ? 'wide' : 'primary wide'}>{onCollect ? 'Add game to list' : 'Save game'}</button>
    </form>
  )
}

const DRAFT_KEY = 'gamenight.pastNightDraft'
function loadDraft(): { date: string; plays: PlayInput[] } | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') } catch { return null }
}
const hasPastNightDraft = () => !!loadDraft()?.plays?.length
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } }

function PastNight({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [today] = useState(() => isoDate(new Date()))
  // The unsaved night is kept on this device, so switching tabs or refreshing doesn't lose it.
  const [draft] = useState(loadDraft)
  const [date, setDate] = useState(() => draft?.date ?? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d) })())
  const [plays, setPlays] = useState<PlayInput[]>(draft?.plays ?? [])
  useEffect(() => {
    try { if (plays.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ date, plays })); else localStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ }
  }, [date, plays])
  useEffect(() => {
    if (!plays.length) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [plays.length])
  const [formKey, setFormKey] = useState(0)
  const listRef = useRef<HTMLParagraphElement>(null)
  const [error, setError] = useState('')
  const games = useApi<{ id: number; name: string }[]>('/games')
  const gameName = (id: number | null) => games?.find(g => g.id === id)?.name ?? '…'

  const move = (i: number, by: number) => setPlays(ps => {
    const next = [...ps]; [next[i], next[i + by]] = [next[i + by], next[i]]; return next
  })

  async function save() {
    setError('')
    try {
      await api('/sessions/past', {
        method: 'POST',
        body: JSON.stringify({ date, plays: plays.map(({ time, ...p }) => ({ ...p, endTime: endTimeFor(date, time) })) }),
      })
      clearDraft()
      onDone()
    } catch (err) { setError((err as Error).message) }
  }

  return (
    <section className="stack">
      <div className="card">
        <div className="live-head">
          <h2>Add a past game night</h2>
          <button onClick={() => { if (!plays.length || confirm('Discard this game night? The games below have not been saved.')) { clearDraft(); onCancel() } }}>Discard</button>
        </div>
        <p className="muted" ref={listRef}>Add the games in the order they were played. Times are optional.</p>
        <label>Date (the night it started)
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} />
        </label>
        {plays.length > 0
          ? <div className="tonight">
              {plays.map((p, i) => (
                <div key={i} className="tonight-row">
                  <span className="tonight-num">{i + 1}</span>
                  <span className="game-name">{gameName(p.gameId)}</span>
                  <span className="winner static">
                    {p.players.some(x => x.placement === 1)
                      ? <><Trophy /> {p.players.filter(x => x.placement === 1).map(x => x.name).join(', ')}</>
                      : <span className="muted">no winner</span>}
                  </span>
                  <span className="muted">{p.time ? formatTime(endTimeFor(date, p.time)!) : 'time unknown'}</span>
                  <span className="actions">
                    <button className="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button className="ghost" disabled={i === plays.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button className="ghost" onClick={() => setPlays(ps => ps.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                  </span>
                </div>
              ))}
            </div>
          : <p className="muted">No games yet. Add the first one below.</p>}
        <h3 className="card-title section-divider">Add game {plays.length + 1}</h3>
        <AddPlay key={formKey} onCollect={p => {
          setPlays(ps => [...ps, p]); setFormKey(k => k + 1)
          requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }} />
        <div className="save-night">
          {plays.length > 0
            ? <p className="unsaved">Not saved yet · {plays.length} game{plays.length === 1 ? '' : 's'}</p>
            : <p className="muted">Add at least one game, then save the night.</p>}
          {error && <p className="error">{error}</p>}
          <button className="primary wide" disabled={!plays.length || !date} onClick={save}>Save game night</button>
        </div>
      </div>
    </section>
  )
}

type ActiveSession = {
  id: number; date: string; started_at: string; expires_at: string
  plays: { id: number; game: string; end_time: string | null; winners: string | null }[]
}

function GameNight({ testMode, onChange }: { testMode: boolean; onChange: () => void }) {
  const [loggedIn, setLoggedIn] = useState(!!getToken())
  const [session, setSession] = useState<ActiveSession | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [past, setPast] = useState(hasPastNightDraft)

  const load = () => api<ActiveSession | null>('/sessions/active').then(setSession)
  useEffect(() => { load() }, [])

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try { await fn(); onChange() }
    catch (err) { setError((err as Error).message); if (!getToken()) setLoggedIn(false) }
  }

  if (!loggedIn && !testMode) return <Login onLogin={() => setLoggedIn(true)} />
  if (session === undefined) return null
  if (past) return <PastNight onCancel={() => setPast(false)} onDone={() => { setPast(false); onChange() }} />

  if (!session) return (
    <section className="hero-card">
      <span className="hero-icon"><Crown place={1} size={56} /></span>
      <h2>Ready for game night?</h2>
      <p className="muted">Start a session to log tonight's games. It wraps up on its own after 12 hours.</p>
      <button className="primary big" onClick={() => run(() => api('/sessions', { method: 'POST' }))}>Start game night</button>
      <button className="ghost" onClick={() => setPast(true)}>{hasPastNightDraft() ? 'Continue unsaved past game night' : '+ Add a past game night'}</button>
      {error && <p className="error">{error}</p>}
    </section>
  )

  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <section className="stack">
      <div className="live-card">
        <div className="live-head">
          <div>
            <span className="live-badge"><span className="live-dot" /> Live</span>
            <h2>Game night #{session.id}</h2>
            <p className="muted">Started {time(session.started_at)} · ends automatically at {time(session.expires_at)}</p>
          </div>
          <div className="actions">
            <button onClick={() => confirm('End this game night?') && run(() => api(`/sessions/${session.id}/end`, { method: 'POST' }))}>
              End game night
            </button>
            <button className="danger" onClick={() => confirm(session.plays.length
                ? `Cancel this game night? This also deletes the ${session.plays.length} game(s) logged in it.`
                : 'Cancel this game night? It will be deleted.')
              && run(() => api(`/sessions/${session.id}`, { method: 'DELETE' }))}>
              Cancel session
            </button>
          </div>
        </div>
        {session.plays.length > 0
          ? <div className="tonight">
              {session.plays.map((p, i) => (
                <div key={p.id} className="tonight-row">
                  <span className="tonight-num">{i + 1}</span>
                  <span className="game-name">{p.game}</span>
                  <span className="winner static">{p.winners ? <><Trophy /> {p.winners}</> : <span className="muted">no winner</span>}</span>
                  {p.end_time && <span className="muted">{formatTime(p.end_time)}</span>}
                </div>
              ))}
            </div>
          : <p className="muted">No games yet tonight. Add the first one below.</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h3 className="card-title">Add a game</h3>
        <AddPlay onSaved={onChange} />
      </div>
    </section>
  )
}
