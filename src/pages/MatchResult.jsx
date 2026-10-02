import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import { fullName } from '../lib/util'

export default function MatchResult() {
  const { id } = useParams()
  const nav = useNavigate()
  const { matches, players, playersById, reload } = useData()
  const m = matches.find(x => x.id === id)
  const [scoreA, setScoreA] = useState(m?.score_a ?? 0)
  const [scoreB, setScoreB] = useState(m?.score_b ?? 0)
  const [mvp, setMvp] = useState(m?.mvp_player_id || '')
  const [ratings, setRatings] = useState({})
  const [goals, setGoals] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!m) return
    setScoreA(m.score_a ?? 0)
    setScoreB(m.score_b ?? 0)
    setMvp(m.mvp_player_id || '')
    setRatings(Object.fromEntries(m.match_players.map(x => [x.player_id, x.rating == null ? '' : String(x.rating)])))
    setGoals(m.goals.map(g => ({ scorer_id: g.scorer_id || '', assist_id: g.assist_id || '', minute: g.minute == null ? '' : String(g.minute), own_goal: Boolean(g.own_goal), credited_team: g.credited_team || 'A' })))
  }, [id])

  const roster = useMemo(() => m ? m.match_players.map(x => ({ ...x, player: playersById[x.player_id] })).filter(x => x.player) : [], [m, playersById])
  if (!m) return <p className="muted">Partita non trovata.</p>

  function addGoal() {
    setGoals(g => [...g, { scorer_id: '', assist_id: '', minute: '', own_goal: false, credited_team: 'A' }])
  }
  function updateGoal(index, key, value) {
    setGoals(gs => gs.map((g, i) => i === index ? { ...g, [key]: value } : g))
  }
  function removeGoal(index) {
    setGoals(gs => gs.filter((_, i) => i !== index))
  }
  function teamOf(pid) {
    return m.match_players.find(x => x.player_id === pid)?.team || ''
  }

  async function save() {
    setBusy(true); setErr('')
    const normalizedGoals = goals.filter(g => g.scorer_id).map(g => ({
      scorer_id: g.scorer_id,
      assist_id: g.assist_id || null,
      minute: g.minute === '' ? null : Number(g.minute),
      own_goal: Boolean(g.own_goal),
      credited_team: g.credited_team
    }))
    const normalizedRatings = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v !== '').map(([pid, v]) => [pid, Number(v)]))
    const { error } = await supabase.rpc('save_match_result', {
      p_match_id: id,
      p_score_a: Number(scoreA),
      p_score_b: Number(scoreB),
      p_mvp_player_id: mvp || null,
      p_ratings: normalizedRatings,
      p_goals: normalizedGoals
    })
    if (error) setErr(error.message)
    else { await reload(); nav(`/partite/${id}`, { replace: true }) }
    setBusy(false)
  }

  return <>
    <Link to={`/partite/${id}`} className="link">← Partita</Link>
    <h1>{m.status === 'played' ? 'Modifica risultato' : 'Inserisci risultato'}</h1>

    <div className="card stack">
      <div className="score-edit">
        <div><span>{m.team_a_name}</span><input className="score-input" type="number" min="0" value={scoreA} onChange={e => setScoreA(e.target.value)} /></div>
        <strong>–</strong>
        <div><span>{m.team_b_name}</span><input className="score-input" type="number" min="0" value={scoreB} onChange={e => setScoreB(e.target.value)} /></div>
      </div>
      <label>MVP<select className="input" value={mvp} onChange={e => setMvp(e.target.value)}><option value="">Nessun MVP</option>{roster.map(x => <option key={x.player_id} value={x.player_id}>{fullName(x.player)}</option>)}</select></label>
    </div>

    <h2>Voti</h2>
    <div className="card">
      {roster.map(x => <div key={x.player_id} className="row rating-row"><Avatar player={x.player} size={34}/><span className="grow">{fullName(x.player)} <small className="muted">({x.team})</small></span><input className="input rating-input" type="number" min="-1" max="10" step="0.5" placeholder="—" value={ratings[x.player_id] ?? ''} onChange={e => setRatings(r => ({ ...r, [x.player_id]: e.target.value }))}/></div>)}
    </div>

    <div className="section-head"><h2>Gol</h2><button className="btn small" onClick={addGoal}>+ Aggiungi gol</button></div>
    <p className="muted">Puoi registrare i gol anche senza minuto o assist. Per un autogol scegli il giocatore che lo ha segnato e la squadra che riceve il gol.</p>
    <div className="stack">
      {goals.length ? goals.map((g, i) => <div className="card goal-editor" key={i}>
        <div className="goal-top"><b>Gol {i + 1}</b><button className="icon-btn" onClick={() => removeGoal(i)} aria-label="Rimuovi">×</button></div>
        <div className="goal-grid">
          <select className="input" value={g.scorer_id} onChange={e => updateGoal(i, 'scorer_id', e.target.value)}><option value="">Marcatore</option>{roster.map(x => <option key={x.player_id} value={x.player_id}>{fullName(x.player)}</option>)}</select>
          <select className="input" value={g.credited_team} onChange={e => updateGoal(i, 'credited_team', e.target.value)}><option value="A">Gol per {m.team_a_name}</option><option value="B">Gol per {m.team_b_name}</option></select>
          <select className="input" value={g.assist_id} onChange={e => updateGoal(i, 'assist_id', e.target.value)}><option value="">Assist (opzionale)</option>{roster.map(x => <option key={x.player_id} value={x.player_id}>{fullName(x.player)}</option>)}</select>
          <input className="input" type="number" min="0" max="200" placeholder="Minuto" value={g.minute} onChange={e => updateGoal(i, 'minute', e.target.value)} />
        </div>
        <label className="check"><input type="checkbox" checked={g.own_goal} onChange={e => updateGoal(i, 'own_goal', e.target.checked)} /> Autogol</label>
      </div>) : <div className="card empty"><p className="muted">Nessun gol inserito.</p></div>}
    </div>

    {err && <p className="error">{err}</p>}
    <button className="btn primary block" disabled={busy} onClick={save}>{busy ? 'Salvataggio…' : 'Salva risultato'}</button>
  </>
}