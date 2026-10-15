import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { fullName, fmt1 } from '../lib/util'

const seasonStartYear = value => {
  const date = new Date(value)
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
}

const seasonLabel = year => `${year}/${String(year + 1).slice(-2)}`
const seasonEnd = year => new Date(year + 1, 6, 31)

function awardRows(matches, playersById) {
  const appearances = new Map()
  const goals = new Map()
  const ratings = new Map()
  const mvps = new Map()

  matches.forEach(match => {
    ;(match.match_players || []).forEach(entry => {
      if (!entry.player_id) return
      appearances.set(entry.player_id, (appearances.get(entry.player_id) || 0) + 1)
      if (entry.rating != null && Number.isFinite(Number(entry.rating))) {
        const current = ratings.get(entry.player_id) || { sum: 0, count: 0 }
        current.sum += Number(entry.rating)
        current.count += 1
        ratings.set(entry.player_id, current)
      }
    })
    ;(match.goals || []).filter(goal => !goal.own_goal && goal.scorer_id).forEach(goal => {
      goals.set(goal.scorer_id, (goals.get(goal.scorer_id) || 0) + 1)
    })
    if (match.mvp_player_id) mvps.set(match.mvp_player_id, (mvps.get(match.mvp_player_id) || 0) + 1)
  })

  const best = (map, valueOf = value => value) => [...map.entries()]
    .filter(([id]) => playersById[id])
    .sort((a, b) => valueOf(b[1]) - valueOf(a[1]))[0]

  const scorer = best(goals)
  const appearancesLeader = best(appearances)
  const mvp = best(mvps)
  const rated = best(new Map([...ratings].filter(([, score]) => score.count >= 3)), score => score.sum / score.count)

  return [
    { icon: '⚽', title: 'Capocannoniere', item: scorer && { player: playersById[scorer[0]], value: `${scorer[1]} ${scorer[1] === 1 ? 'gol' : 'gol'}` } },
    { icon: '🧤', title: 'Presenza costante', item: appearancesLeader && { player: playersById[appearancesLeader[0]], value: `${appearancesLeader[1]} presenze` } },
    { icon: '⭐', title: 'Re degli MVP', item: mvp && { player: playersById[mvp[0]], value: `${mvp[1]} ${mvp[1] === 1 ? 'MVP' : 'MVP'}` } },
    { icon: '📈', title: 'Media voto', item: rated && { player: playersById[rated[0]], value: `${fmt1(rated[1].sum / rated[1].count)} · ${rated[1].count} voti` } }
  ]
}

export default function SeasonSummary() {
  const { matches, playersById } = useData()
  const currentYear = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1
  const seasons = useMemo(() => [...new Set([
    currentYear,
    ...matches.filter(match => match.status === 'played').map(match => seasonStartYear(match.kickoff))
  ])].sort((a, b) => b - a), [matches, currentYear])
  const [year, setYear] = useState(currentYear)
  const seasonMatches = matches.filter(match => match.status === 'played' && seasonStartYear(match.kickoff) === year)
  const awards = awardRows(seasonMatches, playersById)
  const goals = seasonMatches.reduce((total, match) => total + (match.goals || []).filter(goal => !goal.own_goal).length, 0)
  const playerCount = new Set(seasonMatches.flatMap(match => (match.match_players || []).map(entry => entry.player_id).filter(Boolean))).size
  const endDate = seasonEnd(year)

  return (
    <div className="season-page">
      <header className="season-hero">
        <div>
          <span className="eyebrow">ALMANACCO DEL CLUB</span>
          <h1>Fine stagione</h1>
          <p className="muted">I momenti, i numeri e i protagonisti della stagione {seasonLabel(year)}.</p>
        </div>
        <div className="season-date-block">
          <span>LA STAGIONE FINISCE IL</span>
          <strong>{new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' }).format(endDate)}</strong>
          <small>{endDate.getFullYear()}</small>
        </div>
      </header>

      <div className="season-toolbar">
        <label htmlFor="season-select">Stagione</label>
        <select id="season-select" value={year} onChange={event => setYear(Number(event.target.value))}>
          {seasons.map(option => <option key={option} value={option}>{seasonLabel(option)}</option>)}
        </select>
        <Link to="/classifiche" className="link">Classifiche complete →</Link>
      </div>

      <div className="season-stats-grid">
        <article className="season-stat card"><span>Partite giocate</span><strong>{seasonMatches.length}</strong><small>da agosto a luglio</small></article>
        <article className="season-stat card"><span>Gol segnati</span><strong>{goals}</strong><small>autogol esclusi</small></article>
        <article className="season-stat card"><span>Giocatori coinvolti</span><strong>{playerCount}</strong><small>almeno una presenza</small></article>
      </div>

      <section className="season-awards-section">
        <div className="season-section-heading"><div><span className="eyebrow">I PROTAGONISTI</span><h2>Premi di stagione</h2></div></div>
        <div className="season-awards-grid">
          {awards.map(award => (
            <article className="season-award card" key={award.title}>
              <span className="season-award-icon" aria-hidden="true">{award.icon}</span>
              <small>{award.title}</small>
              {award.item ? <><strong>{fullName(award.item.player)}</strong><span className="season-award-value">{award.item.value}</span></> : <span className="muted">Dati non sufficienti</span>}
            </article>
          ))}
        </div>
      </section>

      {!seasonMatches.length && <div className="season-empty card"><span aria-hidden="true">📅</span><h2>La stagione è appena iniziata</h2><p className="muted">Il riepilogo si aggiornerà man mano che registrerete risultati e voti.</p><Link to="/partite" className="btn primary">Vai alle partite</Link></div>}
    </div>
  )
}
