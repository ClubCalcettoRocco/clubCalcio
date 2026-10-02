import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { MatchCard } from '../components/ui'
import { TYPES, fmtDate, fullName } from '../lib/util'

export default function Matches() {
  const { matches, players } = useData()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('prossime')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [pl, setPl] = useState('')
  const [asc, setAsc] = useState(false)

  const upcoming = useMemo(() => matches.filter(m => m.status === 'scheduled').sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)), [matches])
  const history = useMemo(() => {
    let l = matches.filter(m => m.status === 'played')
    if (type) l = l.filter(m => m.type === type)
    if (pl) l = l.filter(m => m.match_players.some(x => x.player_id === pl))
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      l = l.filter(m => `${m.location} ${m.team_a_name} ${m.team_b_name} ${fmtDate(m.kickoff)}`.toLowerCase().includes(s))
    }
    return [...l].sort((a, b) => (new Date(a.kickoff) - new Date(b.kickoff)) * (asc ? 1 : -1))
  }, [matches, q, type, pl, asc])

  return <>
    <div className="section-head"><h1>Partite</h1>{isAdmin && <Link to="/partite/nuova" className="btn primary small">+ Crea partita</Link>}</div>
    <div className="tabs"><button className={tab === 'prossime' ? 'on' : ''} onClick={() => setTab('prossime')}>Prossime</button><button className={tab === 'storico' ? 'on' : ''} onClick={() => setTab('storico')}>Storico</button></div>

    {tab === 'prossime' ? <div className="stack">{upcoming.length ? upcoming.map(m => <MatchCard key={m.id} m={m} />) : <div className="card empty"><p className="muted">Nessuna partita in programma.</p></div>}</div> : <>
      <div className="filters">
        <input className="input" placeholder="Cerca luogo, squadra, data…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" value={type} onChange={e => setType(e.target.value)}><option value="">Tutti i tipi</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select className="input" value={pl} onChange={e => setPl(e.target.value)}><option value="">Tutti i giocatori</option>{players.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select>
        <button className="btn" onClick={() => setAsc(v => !v)}>{asc ? 'Meno recenti ↑' : 'Più recenti ↓'}</button>
      </div>
      <div className="stack">{history.length ? history.map(m => <MatchCard key={m.id} m={m} />) : <div className="card empty"><p className="muted">Nessuna partita trovata.</p></div>}</div>
    </>}
  </>
}
