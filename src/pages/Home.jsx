import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { Avatar, EmptyState, Lineups, MatchCard, PlayerRow, Section, StatBox } from '../components/ui'
import { useAuth } from '../lib/auth'
import { TYPES, fmtDate, fmtTime, fullName, fmt1 } from '../lib/util'

export default function Home() {
  const { matches, stats, playersById } = useData()
  const { me } = useAuth()
  const played = matches.filter(m => m.status === 'played')
  const upcoming = matches.filter(m => m.status === 'scheduled').sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
  const next = upcoming[0]
  const last = played[0]
  const top = [...stats].filter(s => Number(s.gol) > 0).sort((a, b) => Number(b.gol) - Number(a.gol)).slice(0, 5)
  const myStats = stats.find(s => s.player_id === me.id)
  let best = null
  if (last) {
    const tally = {}
    last.goals.filter(g => !g.own_goal).forEach(g => { tally[g.scorer_id] = (tally[g.scorer_id] || 0) + 1 })
    best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  }

  return <>
    <div className="hero-heading"><div><span className="eyebrow">BENVENUTO</span><h1>{me.first_name || 'Giocatore'} 👋</h1><p className="muted">Tutto il tuo gruppo di calcio in un solo posto.</p></div></div>

    <div className="stats-grid four">
      <StatBox label="Presenze" value={myStats?.presenze ?? 0} />
      <StatBox label="Gol" value={myStats?.gol ?? 0} accent />
      <StatBox label="Assist" value={myStats?.assist ?? 0} />
      <StatBox label="Media voto" value={fmt1(myStats?.media_voto)} />
    </div>

    <Section title="Prossima partita">
      {next ? <div className="card hero">
        <div className="meta"><span>{fmtDate(next.kickoff)} · {fmtTime(next.kickoff)}</span><span className="pill">{TYPES[next.type]?.label}</span></div>
        <p>📍 {next.location}</p>
        <Lineups m={next} playersById={playersById} />
        <Link to={`/partite/${next.id}`} className="link">Dettagli →</Link>
      </div> : <EmptyState>Nessuna partita in programma.</EmptyState>}
    </Section>

    <Section title="Ultima partita giocata">
      {last ? <>
        <MatchCard m={last} />
        <div className="card">
          {last.mvp_player_id && playersById[last.mvp_player_id] && <PlayerRow player={playersById[last.mvp_player_id]} right={<span className="pill gold">MVP</span>} />}
          {best && playersById[best[0]] && <PlayerRow player={playersById[best[0]]} right={<span className="pill">{best[1]} gol</span>} />}
          {!last.mvp_player_id && !best && <p className="muted">Nessun dettaglio registrato.</p>}
        </div>
      </> : <EmptyState>Ancora nessuna partita giocata.</EmptyState>}
    </Section>

    <Section title="Classifica marcatori" action={<Link to="/classifiche" className="link">Tutte</Link>}>
      <div className="card">
        {top.length ? top.map((s, i) => <PlayerRow key={s.player_id} player={playersById[s.player_id]} right={<><span className="muted">#{i + 1}</span><b>{s.gol}</b></>} />) : <p className="muted">Nessun gol registrato.</p>}
      </div>
    </Section>

    <Section title="Ultime partite" action={<Link to="/partite" className="link">Storico</Link>}>
      <div className="stack">{played.slice(0, 5).map(m => <MatchCard key={m.id} m={m} />)}</div>
    </Section>
  </>
}
