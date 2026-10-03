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
      <span className="grow row-name">{fullName(player)}</span>
      {right}
    </Link>
  )
}

export function MatchCard({ m, featured = false }) {
  const played = m.status === 'played'
  const scoreA = played ? m.score_a : null
  const scoreB = played ? m.score_b : null
  return (
    <Link to={`/partite/${m.id}`} className={`card match-card hover-card ${featured ? 'match-card-featured' : ''}`}>
      <div className="match-card-top">
        <div className="match-card-date">
          <span className="match-kicker">{featured ? 'RISULTATO FINALE' : 'MATCH'}</span>
          <span className="match-date">{fmtDate(m.kickoff)} · {fmtTime(m.kickoff)}</span>
        </div>
        <span className="pill match-badge">{TYPES[m.type]?.label || m.type}</span>
      </div>

      <div className="match-scoreboard" aria-label={`Risultato ${m.team_a_name} ${scoreA ?? 'vs'} ${scoreB ?? ''} ${m.team_b_name}`}>
        <div className="match-team match-team-a">
          <span className="team-name">{m.team_a_name}</span>
        </div>
        <div className="match-score">
          <span>{played ? scoreA : 'vs'}</span>
          {played && <em>—</em>}
          {played && <span>{scoreB}</span>}
        </div>
        <div className="match-team match-team-b">
          <span className="team-name">{m.team_b_name}</span>
        </div>
      </div>

      <div className="match-card-bottom">
        <span className="match-location">📍 {m.location}</span>
        <span className="match-open">Apri <span aria-hidden="true">↗</span></span>
      </div>
    </Link>
  )
}

export function Lineups({ m, playersById, showRating = false }) {
  const col = (side, name) => (
    <div className="lineup">

      <div className="lineup-title">
        <h3>{name}</h3>
        <span>
          {m.match_players.filter(
            x => x.team === side
          ).length}
        </span>
      </div>

      {m.match_players
        .filter(x => x.team === side)
        .map(x => {

          const player =
            x.player_id
              ? playersById[x.player_id]
              : null

          /*
           * GIOCATORE REGISTRATO
           */
          if (player) {
            return (
              <PlayerRow
                key={x.id || x.player_id}
                player={player}
                compact
                right={
                  showRating ? (
                    <span className="pill rating">
                      {x.rating == null
                        ? 'SV'
                        : Number(x.rating).toFixed(1)}
                    </span>
                  ) : null
                }
              />
            )
          }

          /*
           * OSPITE
           */
          return (
            <div
              key={x.id}
              className="row compact"
            >
              <span
                className="avatar"
                style={{
                  width: 34,
                  height: 34,
                  fontSize: '14px',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                👤
              </span>

              <span className="grow row-name">
                {x.guest_first_name}{' '}
                {x.guest_last_name}

                <small className="muted">
                  {' '}· Ospite
                </small>
              </span>

              {/* Gli ospiti non ricevono voti */}
            </div>
          )
        })}

    </div>
  )

  return (
    <div className="two-col lineup-grid">
      {col('A', m.team_a_name)}
      {col('B', m.team_b_name)}
    </div>
  )
}

export function RatingChart({ points }) {
  if (!points.length) return <p className="muted">Nessun voto registrato.</p>
  const W = 340, H = 200, L = 30, R = 10, T = 10, B = 22, MIN = 0, MAX = 10
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
      <path d={path} fill="none" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="4.5" fill="var(--accent-2)" stroke="var(--card)" strokeWidth="2"><title>{p.label}: {p.value}</title></circle>)}
    </svg>
  )
}

export function StatBox({ label, value, accent = false, icon = '•' }) {
  return <div className={`stat-box ${accent ? 'accent' : ''}`}><div className="stat-icon" aria-hidden="true">{icon}</div><span>{label}</span><strong>{value}</strong></div>
}