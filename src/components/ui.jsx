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
    <div className={`lineup lineup-team lineup-team-${side.toLowerCase()}`}>

      <div className="lineup-title">
        <span className="lineup-side">Squadra {side}</span>
        <h3>{name}</h3>
        <span className="lineup-count">
          {m.match_players.filter(
            x => x.team === side
          ).length} giocatori
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
              className="row compact guest-row"
            >
              <span
                className="avatar guest-avatar"
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

              <span className="grow row-name guest-name">
                <span>{x.guest_first_name} {x.guest_last_name}</span>
                <small className="pill guest-badge">Ospite</small>
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

export function FormationPitch({ m, playersById, showRating = false }) {
  const side = (team, label) => (
    <div className={`pitch-side pitch-side-${team.toLowerCase()}`}>
      <strong className="pitch-team-label"><span>{label}</span><small>{(m.match_players || []).filter(x => x.team === team).length} giocatori</small></strong>
      <div className="pitch-roster">
        {(m.match_players || []).filter(x => x.team === team).map((entry, index) => {
          const player = entry.player_id ? playersById[entry.player_id] : null
          const name = player
            ? `${player.first_name || ''} ${player.last_name || ''}`.trim()
            : `${entry.guest_first_name || 'Ospite'} ${entry.guest_last_name || ''}`.trim()
          const position = player?.position === 'Portiere' ? 'POR'
            : player?.position === 'Difensore' ? 'DIF'
              : player?.position === 'Centrocampista' ? 'CEN'
                : player?.position === 'Attaccante' ? 'ATT' : ''
          return (
            <div className="pitch-player" key={entry.id || entry.player_id || `${team}-${index}`} style={{ '--player-index': index }} title={name}>
              <span className="pitch-avatar-wrap">
                {player
                  ? <Avatar player={player} size={42} />
                  : <span className="avatar pitch-guest">👤</span>}
                {position && <span className="pitch-player-role">{position}</span>}
              </span>
              <span className="pitch-player-name">{name}</span>
              {showRating && entry.rating != null && <span className="pitch-rating">{Number(entry.rating).toFixed(1)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="football-pitch" role="img" aria-label={`Formazioni in campo: ${m.team_a_name} e ${m.team_b_name}`}>
      <div className="pitch-line pitch-midline" />
      <div className="pitch-center-circle" />
      {side('A', m.team_a_name)}
      {side('B', m.team_b_name)}
      <div className="pitch-box pitch-box-left" />
      <div className="pitch-box pitch-box-right" />
      <div className="pitch-six-yard pitch-six-yard-left" />
      <div className="pitch-six-yard pitch-six-yard-right" />
      <div className="pitch-spot pitch-spot-left" />
      <div className="pitch-spot pitch-spot-right" />
      <div className="pitch-goal pitch-goal-left" />
      <div className="pitch-goal pitch-goal-right" />
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

export function TrendChart({ points, label, color = 'var(--accent-2)', emptyMessage = 'Dati insufficienti per mostrare l’andamento.' }) {
  if (!points.length) return <p className="muted">{emptyMessage}</p>
  const W = 520, H = 190, L = 34, R = 12, T = 14, B = 28
  const max = Math.max(1, ...points.map(point => Number(point.value) || 0))
  const rawMin = Math.min(...points.map(point => Number(point.value) || 0))
  const min = rawMin === 0 ? 0 : Math.max(0, Math.floor(rawMin - 1))
  const x = i => points.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (points.length - 1)
  const y = value => T + ((max - value) * (H - T - B)) / (max - min || 1)
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${x(i)},${y(Number(point.value) || 0)}`).join(' ')
  const area = `${path} L${x(points.length - 1)},${H - B} L${x(0)},${H - B} Z`
  const ticks = [...new Set([min, Math.round((min + max) / 2), max])]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart trend-chart" role="img" aria-label={label}>
      <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {ticks.map(value => <g key={value}><line x1={L} x2={W - R} y1={y(value)} y2={y(value)} stroke="var(--border)" strokeWidth="1" /><text x={L - 7} y={y(value) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{value}</text></g>)}
      <path d={area} fill="url(#trend-fill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(Number(point.value) || 0)} r="4" fill={color} stroke="var(--card)" strokeWidth="2"><title>{point.label}: {point.value}</title></circle>)}
      <text x={L} y={H - 6} textAnchor="start" fontSize="10" fill="var(--muted)">{points[0]?.label}</text>
      {points.length > 1 && <text x={W - R} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)">{points[points.length - 1]?.label}</text>}
    </svg>
  )
}

export function StatBox({ label, value, accent = false, icon = '•' }) {
  return <div className={`stat-box ${accent ? 'accent' : ''}`}><div className="stat-icon" aria-hidden="true">{icon}</div><span>{label}</span><strong>{value}</strong></div>
}
