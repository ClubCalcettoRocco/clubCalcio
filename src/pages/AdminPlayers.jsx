import { useState } from 'react'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import { fullName } from '../lib/util'

export default function AdminPlayers() {
  const { players, reload } = useData()
  const [open, setOpen] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', role_label: '', photo_url: '', app_role: 'PLAYER', approved: false })

  function start(p) { setOpen(p.id); setErr(''); setForm({ first_name: p.first_name || '', last_name: p.last_name || '', role_label: p.role_label || '', photo_url: p.photo_url || '', app_role: p.app_role, approved: p.approved }) }
  async function save() {
    setSaving(true); setErr('')
    const { error } = await supabase.from('players').update(form).eq('id', open)
    if (error) setErr(error.message)
    else { await reload(); setOpen(null) }
    setSaving(false)
  }
  async function toggle(p) {
    const { error } = await supabase.from('players').update({ approved: !p.approved }).eq('id', p.id)
    if (error) setErr(error.message); else await reload()
  }

  return <>
    <h1>Amministrazione</h1>
    <div className="notice"><b>Account:</b> i nuovi utenti possono registrarsi dalla schermata di accesso. Da qui puoi approvarli e assegnare il ruolo ADMIN.</div>
    {err && <p className="error">{err}</p>}
    <div className="card">
      {players.map(p => <div key={p.id} className="admin-player">
        <Avatar player={p} size={44}/><div className="grow"><b>{fullName(p)}</b><span className="muted">{p.email || '—'} · {p.app_role}</span></div>
        <span className={`status ${p.approved ? 'ok' : 'pending'}`}>{p.approved ? 'Attivo' : 'In attesa'}</span>
        <button className="btn small" onClick={() => start(p)}>Modifica</button>
        <button className={`btn small ${p.approved ? '' : 'primary'}`} onClick={() => toggle(p)}>{p.approved ? 'Disattiva' : 'Approva'}</button>
      </div>)}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(null)}><div className="modal card"><div className="section-head"><h2>Modifica giocatore</h2><button className="icon-btn" onClick={() => setOpen(null)}>×</button></div><div className="stack"><div className="two-col"><label>Nome<input className="input" value={form.first_name} onChange={e => setForm({...form, first_name:e.target.value})}/></label><label>Cognome<input className="input" value={form.last_name} onChange={e => setForm({...form, last_name:e.target.value})}/></label></div><label>Ruolo<input className="input" value={form.role_label} onChange={e => setForm({...form, role_label:e.target.value})}/></label><label>URL foto<input className="input" value={form.photo_url} onChange={e => setForm({...form, photo_url:e.target.value})}/></label><div className="two-col"><label>Ruolo app<select className="input" value={form.app_role} onChange={e => setForm({...form, app_role:e.target.value})}><option value="PLAYER">PLAYER</option><option value="ADMIN">ADMIN</option></select></label><label className="check"><input type="checkbox" checked={form.approved} onChange={e => setForm({...form, approved:e.target.checked})}/> Account approvato</label></div>{err && <p className="error">{err}</p>}<button className="btn primary block" onClick={save} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button></div></div></div>}
  </>
}
