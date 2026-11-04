import { useState } from 'react'

type Night = { date: string; games: string[] }

// Fixed categorical order (validated in light and dark). Games past the 8th fold into "Other".
const SLOTS = 8
const OTHER = 'Other'
const color = (i: number) => (i < SLOTS ? `var(--series-${i + 1})` : 'var(--series-other)')

export type Grain = 'day' | 'week' | 'month'

// Dates are handled as local noon so daylight-saving shifts never move a day.
const toDate = (iso: string) => new Date(`${iso}T12:00:00`)
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Start of the bucket a date falls in (weeks start on Monday).
function bucketStart(iso: string, grain: Grain) {
  if (grain === 'month') return `${iso.slice(0, 7)}-01`
  if (grain === 'day') return iso
  const d = toDate(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toIso(d)
}

function nextBucket(iso: string, grain: Grain) {
  const d = toDate(iso)
  if (grain === 'month') d.setMonth(d.getMonth() + 1)
  else d.setDate(d.getDate() + (grain === 'week' ? 7 : 1))
  return toIso(d)
}

const label = (iso: string, grain: Grain, long: boolean) => {
  const d = toDate(iso)
  if (grain === 'month') return d.toLocaleDateString([], long ? { month: 'long', year: 'numeric' } : { month: 'short' })
  const s = d.toLocaleDateString([], long ? { weekday: grain === 'day' ? 'short' : undefined, month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })
  return grain === 'week' && long ? `Week of ${s}` : s
}

// Axis labels: a bold marker where the year (or month, for days/weeks) changes, and
// evenly spaced regular labels that keep clear of the markers.
function xLabels(keys: string[], grain: Grain, every: number) {
  const big = keys.map((k, i) => i === 0 || (grain === 'month' ? keys[i - 1].slice(0, 4) !== k.slice(0, 4) : keys[i - 1].slice(0, 7) !== k.slice(0, 7)))
  const near = (i: number) => big.some((b, j) => b && j !== i && Math.abs(j - i) < Math.ceil(every * 0.75))
  return keys.map((k, i) => {
    if (big[i]) return { big: true, text: grain === 'month' ? `${label(k, grain, false)} '${k.slice(2, 4)}` : label(k, grain, false) }
    return { big: false, text: i % every === 0 && !near(i) ? label(k, grain, false) : '' }
  })
}

type Bucket = { key: string; nights: number; total: number; counts: Map<string, number> }

// Every bucket across the range, including empty ones, so quiet stretches show up as gaps.
function buckets(nights: Night[], series: (game: string) => string, grain: Grain, from: string, to: string) {
  const byKey = new Map<string, Bucket>()
  for (const n of nights) {
    const key = bucketStart(n.date, grain)
    const b = byKey.get(key) ?? { key, nights: 0, total: 0, counts: new Map() }
    b.nights++
    for (const g of n.games) { b.total++; b.counts.set(series(g), (b.counts.get(series(g)) ?? 0) + 1) }
    byKey.set(key, b)
  }
  const out: Bucket[] = []
  for (let k = bucketStart(from, grain), end = bucketStart(to, grain); k <= end && out.length < 1000; k = nextBucket(k, grain)) {
    out.push(byKey.get(k) ?? { key: k, nights: 0, total: 0, counts: new Map() })
  }
  return out
}

export function ActivityChart({ nights, allGames: everyGame, grain, from, to }: {
  nights: Night[]; allGames: string[]; grain: Grain; from: string; to: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [focus, setFocus] = useState<string | null>(null) // from the legend: fades other games
  const [seg, setSeg] = useState<string | null>(null)     // segment under the cursor: bolded in the tooltip

  // Colours follow the game, not its rank: alphabetical, so a filter never repaints survivors.
  // Slots come from every game ever played, so narrowing the time frame keeps each game's colour.
  const allGames = [...new Set(everyGame)].sort((a, b) => a.localeCompare(b))
  const named = allGames.length > SLOTS ? allGames.slice(0, SLOTS - 1) : allGames
  const series = (g: string) => (named.includes(g) ? g : OTHER)
  const slots = allGames.length > SLOTS ? [...named, OTHER] : named
  const inRange = new Set(nights.flatMap(n => n.games.map(series)))
  const legend = slots.filter(s => inRange.has(s)) // only games in this time frame, in slot order
  const colorOf = (s: string) => color(s === OTHER ? SLOTS : slots.indexOf(s))

  const data = buckets(nights, series, grain, from, to)
  if (!data.length) return null
  const unit = grain === 'day' ? 'days' : grain === 'week' ? 'weeks' : 'months'

  const max = Math.max(1, ...data.map(d => d.total))
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2
  const ticks = [0, top / 2, top].filter((t, i, a) => Number.isInteger(t) && a.indexOf(t) === i)
  const busiest = data.reduce((a, b) => (b.total > a.total ? b : a))
  const active = data.filter(d => d.nights > 0).length
  const shown = hover != null ? data[hover] : null
  const every = Math.max(1, Math.ceil(data.length / 8))
  const dim = (s: string) => focus != null && focus !== s

  return (
    <div className="card activity">
      <div className="activity-head">
        <div>
          <h3 className="card-title">Games played per {grain}</h3>
          <p className="muted">
            {busiest.total > 0
              ? <>Busiest: <b>{label(busiest.key, grain, true)}</b> ({busiest.total} {busiest.total === 1 ? 'game' : 'games'}) · active in {active} of {data.length} {unit}</>
              : 'No games in this time frame.'}
          </p>
        </div>
      </div>

      <div className="legend" onMouseLeave={() => setFocus(null)}>
        {legend.map(s => (
          <button key={s} className={dim(s) ? 'legend-item dim' : 'legend-item'}
            onMouseEnter={() => setFocus(s)} onFocus={() => setFocus(s)} onBlur={() => setFocus(null)}
            onClick={() => setFocus(f => (f === s ? null : s))}>
            <span className="swatch" style={{ background: colorOf(s) }} />{s}
          </button>
        ))}
      </div>

      <div className="chart">
        <div className="chart-y">
          {ticks.slice().reverse().map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{t}</span>)}
        </div>
        <div className="chart-plot" onMouseLeave={() => { setHover(null); setSeg(null) }}>
          {ticks.map(t => <span key={t} className="chart-grid" style={{ bottom: `${(t / top) * 100}%` }} />)}
          <div className="chart-bars" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
            {data.map((d, i) => (
              <div key={d.key} className={hover === i ? 'chart-col hover' : 'chart-col'}
                onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}
                aria-label={`${label(d.key, grain, true)}: ${d.total} games over ${d.nights} nights`}>
                {d.total > 0 && (
                  <span className="chart-stack" style={{ height: `${(d.total / top) * 100}%` }}>
                    {legend.filter(s => d.counts.has(s)).map(s => (
                      <span key={s} className={dim(s) ? 'chart-seg dim' : 'chart-seg'}
                        style={{ flexGrow: d.counts.get(s), background: colorOf(s) }}
                        onMouseEnter={() => setSeg(s)} />
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
          {shown && hover != null && (
            <div className={(hover + 0.5) / data.length > 0.5 ? 'chart-tip flip' : 'chart-tip'}
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
              <b>{label(shown.key, grain, true)}</b>
              <span className="muted-tip">{shown.nights} {shown.nights === 1 ? 'night' : 'nights'} · {shown.total} {shown.total === 1 ? 'game' : 'games'}</span>
              {legend.filter(s => shown.counts.has(s)).map(s => (
                <span key={s} className={(seg ?? focus) === s ? 'tip-row on' : 'tip-row'}>
                  <span className="swatch" style={{ background: colorOf(s) }} />{s}<b>{shown.counts.get(s)}</b>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="chart-x" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {xLabels(data.map(d => d.key), grain, every).map((l, i) => (
            <span key={data[i].key} className={l.big ? 'year' : ''}>{l.text}</span>
          ))}
        </div>
      </div>

      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>{grain === 'day' ? 'Day' : grain === 'week' ? 'Week' : 'Month'}</th><th>Nights</th><th>Games</th><th>What we played</th></tr></thead>
          <tbody>
            {data.slice().reverse().filter(d => d.nights).map(d => (
              <tr key={d.key}>
                <td>{label(d.key, grain, true)}</td><td>{d.nights}</td><td>{d.total}</td>
                <td>{legend.filter(s => d.counts.has(s)).map(s => `${s} ×${d.counts.get(s)}`).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

export type Range = { preset: string; from: string; to: string; grain: Grain }

const PRESETS: { id: string; label: string; days: number | null; grain: Grain }[] = [
  { id: '30d', label: 'Last 30 days', days: 30, grain: 'day' },
  { id: '3m', label: 'Last 3 months', days: 91, grain: 'week' },
  { id: '12m', label: 'Last 12 months', days: 365, grain: 'month' },
  { id: 'all', label: 'All time', days: null, grain: 'month' },
  { id: 'custom', label: 'Custom', days: null, grain: 'week' },
]

// Sensible grouping for a custom span: days up to ~2 months, weeks up to ~1 year.
const grainFor = (from: string, to: string): Grain => {
  const days = (toDate(to).getTime() - toDate(from).getTime()) / 86_400_000
  return days <= 62 ? 'day' : days <= 370 ? 'week' : 'month'
}

export function presetRange(id: string, first: string, last: string): Range {
  const p = PRESETS.find(x => x.id === id) ?? PRESETS[3]
  const today = toIso(new Date())
  if (p.days == null) return { preset: p.id, from: first, to: id === 'all' ? last : today, grain: p.grain }
  const from = new Date(); from.setDate(from.getDate() - p.days + 1)
  return { preset: p.id, from: toIso(from), to: today, grain: p.grain }
}

export function RangeFilter({ value, first, last, onChange }: {
  value: Range; first: string; last: string; onChange: (r: Range) => void
}) {
  const setCustom = (from: string, to: string) => from && to && from <= to && onChange({ preset: 'custom', from, to, grain: grainFor(from, to) })
  return (
    <div className="filters">
      <div className="segmented" role="group" aria-label="Time frame">
        {PRESETS.map(p => (
          <button key={p.id} className={value.preset === p.id ? 'on' : ''}
            onClick={() => onChange(p.id === 'custom' ? { ...value, preset: 'custom' } : presetRange(p.id, first, last))}>
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="date-range">
          <label>From <input type="date" value={value.from} max={value.to} onChange={e => setCustom(e.target.value, value.to)} /></label>
          <label>To <input type="date" value={value.to} min={value.from} onChange={e => setCustom(value.from, e.target.value)} /></label>
        </div>
      )}
      <div className="segmented" role="group" aria-label="Group by">
        {(['day', 'week', 'month'] as Grain[]).map(g => (
          <button key={g} className={value.grain === g ? 'on' : ''} onClick={() => onChange({ ...value, grain: g })}>
            {g === 'day' ? 'Days' : g === 'week' ? 'Weeks' : 'Months'}
          </button>
        ))}
      </div>
    </div>
  )
}
