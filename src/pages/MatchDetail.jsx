import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Lineups, PlayerRow, Section, EmptyState } from '../components/ui'
import { TYPES, fmtDate, fmtTime } from '../lib/util'

export default function MatchDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { matches, playersById, reload } = useData()
  const { isAdmin } = useAuth()
  const [err, setErr] = useState('')
  const m = matches.find(x => x.id === id)
  if (!m) return <p className="muted">Partita non trovata.</p>
  const played = m.status === 'played'
  const goals = [...m.goals].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))

  async function remove() {
    if (!window.confirm('Eliminare definitivamente questa partita con tutti i suoi dati?')) return
    setErr('')
    const { error } = await supabase.from('matches').delete().eq('id', id)
    if (error) setErr(error.message)
    else { await reload(); nav('/partite', { replace: true }) }
  }

  return <>
    <Link to="/partite" className="link">← Partite</Link>
    <div className="card hero match-detail-head">
      <div className="meta"><span>{fmtDate(m.kickoff)} · {fmtTime(m.kickoff)}</span><span className="pill">{TYPES[m.type]?.label}</span></div>
      <div className="score-row big"><b>{m.team_a_name}</b><span className="score">{played ? `${m.score_a} - ${m.score_b}` : 'vs'}</span><b>{m.team_b_name}</b></div>
      <div className="meta">📍 {m.location}</div>
      {m.notes && <p className="muted">{m.notes}</p>}
    </div>
    {isAdmin && <div className="match-detail-actions">
      <Link to={`/partite/${id}/risultato`} className="btn primary">{played ? 'Modifica risultato' : 'Inserisci risultato'}</Link>
      <Link to={`/partite/${id}/modifica`} className="btn">Modifica partita</Link>
      <button className="btn danger" onClick={remove}>Elimina partita</button>
    </div>}
    {err && <p className="error">{err}</p>}

    {played && m.mvp_player_id && playersById[m.mvp_player_id] && <Section title="MVP"><div className="card"><PlayerRow player={playersById[m.mvp_player_id]} right={<span className="pill gold">MVP</span>} /></div></Section>}
    <Section title="Formazioni"><div className="card"><Lineups m={m} playersById={playersById} showRating={played} /></div></Section>

    {played && <Section title="Marcatori e assist">
      <div className="card">
        {goals.length ? goals.map(g => <div key={g.id} className="row">
          <span className="muted w40">{g.minute != null ? `${g.minute}'` : '—'}</span>
          <span className="grow">⚽ {playersById[g.scorer_id] ? `${playersById[g.scorer_id].first_name} ${playersById[g.scorer_id].last_name || ''}`.trim() : 'Giocatore'}{g.own_goal ? ' (autogol)' : ''}<span className="muted"> · per {g.credited_team === 'A' ? m.team_a_name : m.team_b_name}</span></span>
          {g.assist_id && <span className="muted">🅰 {playersById[g.assist_id]?.first_name || '—'}</span>}
        </div>) : <EmptyState>Nessun gol registrato.</EmptyState>}
      </div>
    </Section>}
  </>
}
