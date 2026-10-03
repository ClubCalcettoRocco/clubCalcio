import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar, MatchCard, RatingChart, Section, StatBox } from '../components/ui'
import AvatarUpload from '../components/AvatarUpload'
import { fmt1, fmtDate, fullName } from '../lib/util'

export default function PlayerProfile({ self = false }) {
  const { id } = useParams()
  const { me } = useAuth()
  const { playersById, statsById, matches, reload } = useData()
  const playerId = self ? me.id : id
  const player = playersById[playerId]
  const stats = statsById[playerId]
  const [edit, setEdit] = useState(false)
  const [firstName, setFirstName] = useState(player?.first_name || '')
  const [lastName, setLastName] = useState(player?.last_name || '')
  const [role, setRole] = useState(player?.role_label || '')
  const [photo, setPhoto] = useState(player?.photo_url || '')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!player) return
    setFirstName(player.first_name || '')
    setLastName(player.last_name || '')
    setRole(player.role_label || '')
    setPhoto(player.photo_url || '')
  }, [player?.id, player?.first_name, player?.last_name, player?.role_label, player?.photo_url])

  if (!player) return <p className="muted">Giocatore non trovato.</p>

  const history = useMemo(() => matches.filter(m => m.status === 'played' && m.match_players.some(x => x.player_id === playerId)).sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)), [matches, playerId])
  const points = history.filter(m => m.match_players.find(x => x.player_id === playerId)?.rating != null).reverse().map(m => ({ value: Number(m.match_players.find(x => x.player_id === playerId).rating), label: fmtDate(m.kickoff) }))

  async function saveProfile(e) {
    e.preventDefault(); setErr(''); setMsg('')
    const { error } = await supabase.rpc('update_my_profile', { p_first_name: firstName.trim(), p_last_name: lastName.trim(), p_role_label: role.trim(), p_photo_url: photo.trim() || null })
    if (error) setErr(error.message)
    else { await reload(); setEdit(false); setMsg('Profilo aggiornato.') }
  }

  return <>
    {!self && <Link to="/giocatori" className="link">← Giocatori</Link>}
    <div className="profile-header card">
      <Avatar player={player} size={88}/>
      <div className="profile-main"><span className="eyebrow">PROFILO</span><h1>{fullName(player)}</h1><p className="muted">{player.role_label || 'Giocatore'}</p></div>
      {self && <button className="btn" onClick={() => setEdit(v => !v)}>{edit ? 'Chiudi' : 'Modifica'}</button>}
    </div>

    {edit && <form className="card stack" onSubmit={saveProfile}><div className="two-col"><label>Nome<input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} /></label><label>Cognome<input className="input" value={lastName} onChange={e => setLastName(e.target.value)} /></label></div><label>Ruolo<input className="input" value={role} onChange={e => setRole(e.target.value)} placeholder="Attaccante, difensore…" /></label><AvatarUpload userId={me.user_id} currentUrl={photo} onUploaded={setPhoto} size={96}/>{err && <p className="error">{err}</p>}{msg && <p className="success">{msg}</p>}<button className="btn primary">Salva profilo</button></form>}

    {msg && !edit && <p className="success">{msg}</p>}
    <div className="stats-grid six"><StatBox label="Presenze" value={stats?.presenze ?? 0}/><StatBox label="Gol" value={stats?.gol ?? 0} accent/><StatBox label="Assist" value={stats?.assist ?? 0}/><StatBox label="Media" value={fmt1(stats?.media_voto)}/><StatBox label="MVP" value={stats?.mvp ?? 0}/><StatBox label="Voti" value={stats?.valutazioni ?? 0}/></div>

    <Section title="Andamento voti"><div className="card chart-wrap"><RatingChart points={points}/></div></Section>
    <Section title="Storico personale"><div className="stack">{history.length ? history.map(m => <MatchCardWithPersonal key={m.id} m={m} playerId={playerId} />) : <div className="card empty"><p className="muted">Nessuna partita giocata.</p></div>}</div></Section>
  </>
}

function MatchCardWithPersonal({ m, playerId }) {
  const mp = m.match_players.find(x => x.player_id === playerId)
  const goals = m.goals.filter(g => g.scorer_id === playerId && !g.own_goal).length
  const assists = m.goals.filter(g => g.assist_id === playerId).length
  return <div className="card personal-match"><div><b>{m.team_a_name} {m.score_a} - {m.score_b} {m.team_b_name}</b><span className="muted">{fmtDate(m.kickoff)} · {m.location}</span></div><div className="personal-stats"><span>⚽ {goals}</span><span>🅰 {assists}</span><span>⭐ {mp?.rating == null ? '—' : Number(mp.rating).toFixed(1)}</span></div></div>
}