import { Link } from 'react-router-dom'
import { fullName, initials, TYPES, fmtDate, fmtTime } from '../lib/util'

export function Avatar({ player, size = 42 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  return player?.photo_url
    ? <img className="avatar" style={style} src={player.photo_url} alt="" />
    : <span className="avatar" style={style}>{initials(player)}</span>
}

export function Spinner({ label = 'Caricamento…' }) {
  return <div className="center"><div className="spinner" /><p className="muted">{label}</p></div>
}

export function Section({ title, action, children }) {
  return <section className="section"><div className="section-head"><h2>{title}</h2>{action}</div>{children}</section>
}

export function EmptyState({ children = 'Nessun elemento.' }) {
  return <div className="card empty"><p className="muted">{children}</p></div>
}

export function PlayerRow({ player, right, compact = false }) {
  return (
    <Link to={`/giocatori/${player.id}`} className={`row ${compact ? 'compact' : ''}`}>
      <Avatar player={player} size={compact ? 34 : 40} />
      <span className="grow">{fullName(player)}</span>
      {right}
    </Link>
  )
}

export function MatchCard({ m }) {
  const played = m.status === 'played'
  return (
    <Link to={`/partite/${m.id}`} className="card match-card hover-card">
      <div className="meta"><span>{fmtDate(m.kickoff)} · {fmtTime(m.kickoff)}</span><span className="pill">{TYPES[m.type]?.label || m.type}</span></div>
      <div className="score-row"><b>{m.team_a_name}</b><span className="score">{played ? `${m.score_a} - ${m.score_b}` : 'vs'}</span><b>{m.team_b_name}</b></div>
      <div className="meta">📍 {m.location}</div>
    </Link>
  )
}

export function Lineups({ m, playersById, showRating = false }) {
  const col = (side, name) => (
    <div className="lineup">
      <h3>{name}</h3>
      {m.match_players.filter((x) => x.team === side).map((x) => (
        <PlayerRow key={x.player_id} player={playersById[x.player_id]} compact
          right={showRating && x.rating != null ? <span className="pill rating">{Number(x.rating).toFixed(1)}</span> : null} />
      ))}
    </div>
  )
  return <div className="two-col">{col('A', m.team_a_name)}{col('B', m.team_b_name)}</div>
}

export function RatingChart({ points }) {
  if (!points.length) return <p className="muted">Nessun voto registrato.</p>
  const W = 340, H = 200, L = 30, R = 10, T = 10, B = 22, MIN = -1, MAX = 10
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1))
  const y = (v) => T + ((MAX - v) * (H - T - B)) / (MAX - MIN)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Andamento dei voti">
      {[0, 2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="4.5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2"><title>{p.label}: {p.value}</title></circle>)}
    </svg>
  )
}

export function StatBox({ label, value, accent = false }) {
  return <div className={`stat-box ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}