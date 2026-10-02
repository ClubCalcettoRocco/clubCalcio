import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import { TYPES, fullName, localIsoFromInputs, toLocalInput } from '../lib/util'

export default function MatchForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const { matches, players, reload } = useData()
  const existing = id ? matches.find(m => m.id === id) : null
  const initial = useMemo(() => {
    if (!existing) return { type: 'calcetto5', date: '', time: '21:00', location: '', a: 'Squadra A', b: 'Squadra B', notes: '', assign: {} }
    const d = toLocalInput(existing.kickoff)
    return { type: existing.type, date: d.slice(0, 10), time: d.slice(11, 16), location: existing.location, a: existing.team_a_name, b: existing.team_b_name, notes: existing.notes || '', assign: Object.fromEntries(existing.match_players.map(x => [x.player_id, x.team])) }
  }, [existing])
  const [f, setF] = useState(initial)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setF(initial), [initial])
  if (id && !existing) return <p className="muted">Partita non trovata.</p>

  const max = TYPES[f.type].perTeam
  const count = t => Object.values(f.assign).filter(x => x === t).length
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }))
  const pick = (pid, t) => {
    setF(v => {
      const assign = { ...v.assign }
      if (assign[pid] === t) delete assign[pid]
      else assign[pid] = t
      return { ...v, assign }
    })
  }
  const valid = f.date && f.time && f.location.trim() && count('A') === max && count('B') === max

  async function save() {
    setBusy(true); setErr('')
    const team_a = Object.entries(f.assign).filter(([, team]) => team === 'A').map(([pid]) => pid)
    const team_b = Object.entries(f.assign).filter(([, team]) => team === 'B').map(([pid]) => pid)
    const payload = { type: f.type, kickoff: localIsoFromInputs(f.date, f.time), location: f.location.trim(), team_a_name: f.a.trim() || 'Squadra A', team_b_name: f.b.trim() || 'Squadra B', notes: f.notes.trim(), team_a, team_b }
    const { data, error } = await supabase.rpc('save_match', { p_id: id || null, p: payload })
    if (error) setErr(error.message)
    else { await reload(); nav(`/partite/${data}`, { replace: true }) }
    setBusy(false)
  }

  return <>
    <Link to={id ? `/partite/${id}` : '/partite'} className="link">← Indietro</Link>
    <h1>{id ? 'Modifica partita' : 'Crea partita'}</h1>
    <div className="card stack">
      <label>Tipo partita<select className="input" value={f.type} onChange={set('type')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.perTeam} per squadra)</option>)}</select></label>
      <div className="two-col"><label>Data<input className="input" type="date" value={f.date} onChange={set('date')} required /></label><label>Ora<input className="input" type="time" value={f.time} onChange={set('time')} required /></label></div>
      <label>Luogo<input className="input" value={f.location} onChange={set('location')} placeholder="Campo sportivo…" required /></label>
      <div className="two-col"><label>Nome squadra A<input className="input" value={f.a} onChange={set('a')} /></label><label>Nome squadra B<input className="input" value={f.b} onChange={set('b')} /></label></div>
      <label>Note (opzionale)<textarea className="input textarea" value={f.notes} onChange={set('notes')} rows="3" /></label>
    </div>

    <div className="section-head"><h2>Giocatori</h2><span className={count('A') === max && count('B') === max ? 'success' : 'muted'}>{count('A')}/{max} · {count('B')}/{max}</span></div>
    <div className="card">
      {players.map(p => <div key={p.id} className="row player-pick"><Avatar player={p} size={36}/><span className="grow">{fullName(p)}</span><button className={`chip ${f.assign[p.id] === 'A' ? 'on' : ''}`} disabled={count('A') >= max && f.assign[p.id] !== 'A'} onClick={() => pick(p.id, 'A')}>A</button><button className={`chip ${f.assign[p.id] === 'B' ? 'on' : ''}`} disabled={count('B') >= max && f.assign[p.id] !== 'B'} onClick={() => pick(p.id, 'B')}>B</button></div>)}
    </div>
    {err && <p className="error">{err}</p>}
    <button className="btn primary block" disabled={!valid || busy} onClick={save}>{busy ? 'Salvataggio…' : 'Salva partita'}</button>
  </>
}