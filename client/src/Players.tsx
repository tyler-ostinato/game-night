import { useEffect, useState } from 'react'
import { api, getToken } from './api'
import { NameForm } from './Games'
import { Login } from './Login'
import { Avatar, Empty, Trophy, ordinal, plural, prettyDate } from './ui'
import { CharacterEditor } from './Character'

type Summary = { name: string; wins: number; played: number; nights: number; completePlayed: number; winRate: number | null }

type Profile = Summary & {
  firstPlayed: string; lastPlayed: string
  firstWin: { date: string; game: string } | null
  mostWins: { game: string; wins: number } | null
  mostPlayed: { game: string; played: number } | null
  bestWinRate: { game: string; winRate: number; played: number } | null
  longestStreak: number
  nemesis: { name: string; lostTo: number } | null
  favouriteOpponent: { name: string; beat: number } | null
  byGame: { game: string; played: number; wins: number; winRate: number | null; completePlayed: number; bestScore: number | null }[]
  headToHead: { opponent: string; beat: number; lostTo: number }[]
  history: { playId: number; date: string; game: string; expansions: string | null; placement: number | null; score: number | null; players: number; legacy: number }[]
}

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`)

function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { setData(null); api<T>(path).then(setData, e => setError(e.message)) }, [path])
  return { data, error }
}

export function PlayersPage({ testMode, onPlayer }: { testMode: boolean; onPlayer: (name: string) => void }) {
  const [version, setVersion] = useState(0)
  const { data: players } = useFetch<Summary[]>(`/players?v=${version}`)
  const [adding, setAdding] = useState(false)
  const [loggedIn, setLoggedIn] = useState(!!getToken())
  if (!players) return null

  const addForm = adding && (loggedIn || testMode
    ? <div className="card">
        <NameForm placeholder="New player's name" submitLabel="Add player" onCancel={() => setAdding(false)}
          onSubmit={n => api('/players', { method: 'POST', body: JSON.stringify({ name: n }) })
            .then(() => { setAdding(false); setVersion(v => v + 1) })} />
      </div>
    : <Login onLogin={() => setLoggedIn(true)} />)

  return (
    <section className="stack">
      <div className="page-head-row">
        <div className="page-head"><h2>Players</h2><p className="muted">{players.length} regulars and guests</p></div>
        {!adding && <button className="primary" onClick={() => setAdding(true)}>+ Add player</button>}
      </div>
      {addForm}
      {!players.length && <Empty />}
      <div className="player-grid">
        {players.map(p => {
          const place = 1 + players.filter(o => o.wins > p.wins).length
          return (
            <button key={p.name} className="player-card" onClick={() => onPlayer(p.name)}>
              <span className="player-card-top">
                <Avatar name={p.name} size={56} place={p.wins > 0 ? place : undefined} />
              </span>
              <span className="player-name">{p.name}</span>
              {p.played === 0 ? <span className="muted">No games yet</span> :
              <span className="player-card-stats">
                <span><b>{p.wins}</b> {p.wins === 1 ? 'win' : 'wins'}</span>
                <span><b>{p.nights}</b> {p.nights === 1 ? 'night' : 'nights'}</span>
                <span><b>{pct(p.winRate)}</b> rate</span>
              </span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="notes">{sub}</span>}
    </div>
  )
}

export function PlayerProfile({ name, testMode, onPlayer, onBack }: { name: string; testMode: boolean; onPlayer: (name: string) => void; onBack: () => void }) {
  const { data: p, error } = useFetch<Profile>(`/players/${encodeURIComponent(name)}`)
  const [editing, setEditing] = useState(false)
  if (error === 'Not found') return (
    <section className="stack">
      <button className="back" onClick={onBack}>← All players</button>
      <Empty what={`${name} hasn't played any games yet.`} />
    </section>
  )
  if (error) return <p className="error">{error}</p>
  if (!p) return null
  const link = (n: string) => <button className="link" onClick={() => onPlayer(n)}>{n}</button>

  return (
    <section className="stack">
      <button className="back" onClick={onBack}>← All players</button>
      <div className="profile-hero">
        <Avatar name={p.name} size={104} />
        <div>
          <h2>{p.name}</h2>
          <p className="muted">Playing since {prettyDate(p.firstPlayed)} · last played {prettyDate(p.lastPlayed)}</p>
        </div>
        <div className="hero-wins"><span>{p.wins}</span>{p.wins === 1 ? 'win' : 'wins'}</div>
        {!editing && <button className="hero-edit" onClick={() => setEditing(true)}>Edit character</button>}
      </div>
      {editing && <CharacterEditor name={p.name} testMode={testMode} onDone={() => setEditing(false)} />}

      <div className="stat-grid">
        <Stat label="Games recorded" value={p.played} />
        <Stat label="Win rate" value={pct(p.winRate)} sub={p.completePlayed ? `over ${p.completePlayed} full games*` : 'no full games yet*'} />
        <Stat label="Game nights" value={p.nights} />
        <Stat label="Best win streak" value={p.longestStreak} sub="in a row*" />
        <Stat label="Most wins at" value={p.mostWins?.game ?? '—'} sub={p.mostWins && plural(p.mostWins.wins, 'win')} />
        <Stat label="Best win rate at" value={p.bestWinRate?.game ?? '—'}
          sub={p.bestWinRate ? `${pct(p.bestWinRate.winRate)} over ${p.bestWinRate.played} games` : 'needs 2+ full games'} />
        <Stat label="Most played" value={p.mostPlayed?.game ?? '—'} sub={p.mostPlayed && plural(p.mostPlayed.played, 'game')} />
        <Stat label="First win" value={p.firstWin?.game ?? '—'} sub={p.firstWin && prettyDate(p.firstWin.date)} />
        <Stat label="Nemesis" value={p.nemesis ? link(p.nemesis.name) : '—'} sub={p.nemesis && `finished behind them ${p.nemesis.lostTo}×`} />
        <Stat label="Favourite opponent" value={p.favouriteOpponent ? link(p.favouriteOpponent.name) : '—'}
          sub={p.favouriteOpponent && `beat them ${p.favouriteOpponent.beat}×`} />
      </div>

      <h3 className="section-title">By game</h3>
      <div className="list-card">
        {p.byGame.map(g => (
          <div key={g.game} className="bygame-row">
            <span className="game-name">{g.game}</span>
            <span className="rank-bar"><span style={{ width: `${(g.wins / Math.max(1, g.played)) * 100}%` }} /></span>
            <span className="bygame-stats">
              <span><b>{g.wins}</b>/{g.played} won</span>
              <span>{pct(g.winRate)}*</span>
              <span>{g.bestScore != null && `best ${g.bestScore.toLocaleString()}`}</span>
            </span>
          </div>
        ))}
      </div>

      {p.headToHead.length > 0 && <>
        <h3 className="section-title">Head to head*</h3>
        <div className="h2h-grid">
          {p.headToHead.map(h => (
            <button key={h.opponent} className="h2h-card" onClick={() => onPlayer(h.opponent)}>
              <Avatar name={h.opponent} size={32} />
              <span className="h2h-name">{h.opponent}</span>
              <span className="h2h-score"><span className="good">{h.beat}</span> – <span className="bad">{h.lostTo}</span></span>
            </button>
          ))}
        </div>
      </>}

      <h3 className="section-title">History</h3>
      <div className="list-card">
        {p.history.map(h => (
          <div key={h.playId} className="history-row">
            <span className="muted history-date">{prettyDate(h.date)}</span>
            <span className="game-main">
              <span className="game-name">{h.game}</span>
              {h.expansions && <span className="chips">{h.expansions.split(', ').map(e => <span key={e} className="chip">{e}</span>)}</span>}
            </span>
            <span className={h.placement === 1 ? 'result won' : 'result'}>
              {h.placement === 1 ? <><Trophy /> Won</> : h.placement ? ordinal(h.placement) : 'Played'}
              {h.players > 1 && <small> of {h.players}</small>}
            </span>
            {h.legacy ? <span className="pill">legacy</span> : <span />}
          </div>
        ))}
      </div>

      <p className="footnote">* Win rate, streaks and head-to-head only count "full" games, where everyone who played was recorded.
        Most legacy games only list the winner, so they count toward wins but not these.</p>
    </section>
  )
}
