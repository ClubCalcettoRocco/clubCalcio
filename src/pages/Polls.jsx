import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { ActionError } from '../components/ui'
import { explainError } from '../lib/errorMessage'
import { TYPES, fmtDate, fmtTime, localIsoFromInputs } from '../lib/util'

function dateDefaults() {
  const value = new Date()
  value.setDate(value.getDate() + 1)
  value.setHours(21, 0, 0, 0)
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)
  return { date: local.slice(0, 10), time: local.slice(11, 16) }
}

export default function Polls() {
  const location = useLocation()
  const navigate = useNavigate()
  const { reload } = useData()
  const initialDate = useMemo(dateDefaults, [])
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(location.pathname.endsWith('/nuovo'))
  const [form, setForm] = useState({ type: 'calcetto5', ...initialDate, location: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [voteBusy, setVoteBusy] = useState('')
  const [voteErrors, setVoteErrors] = useState({})
  const [voteRetry, setVoteRetry] = useState({})

  useEffect(() => setShowForm(location.pathname.endsWith('/nuovo')), [location.pathname])

  const refresh = useCallback(async () => {
    setLoadError('')
    try {
      const { data, error } = await supabase.rpc('get_match_polls')
      if (error) throw error
      setPolls(data || [])
    } catch (error) {
      setLoadError(explainError(error, 'Non è stato possibile caricare i sondaggi.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('match-polls-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_polls' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  function updateForm(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function createPoll(event) {
    event.preventDefault()
    setFormError('')
    const kickoff = localIsoFromInputs(form.date, form.time)
    if (!kickoff || new Date(kickoff) <= new Date()) {
      setFormError('Scegli una data e un’ora future.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('create_match_poll', {
        p_type: form.type,
        p_kickoff: kickoff,
        p_location: form.location.trim()
      })
      if (error) throw error
      setForm({ type: 'calcetto5', ...dateDefaults(), location: '' })
      setShowForm(false)
      navigate('/sondaggi', { replace: true })
      await refresh()
    } catch (error) {
      setFormError(explainError(error, 'Non è stato possibile creare il sondaggio.'))
    } finally {
      setSaving(false)
    }
  }

  async function castVote(poll, present) {
    setVoteBusy(poll.id)
    setVoteRetry(current => ({ ...current, [poll.id]: present }))
    setVoteErrors(current => ({ ...current, [poll.id]: '' }))
    try {
      const { error } = await supabase.rpc('cast_match_poll_vote', {
        p_poll_id: poll.id,
        p_present: present
      })
      if (error) throw error
      await Promise.all([refresh(), reload()])
    } catch (error) {
      setVoteErrors(current => ({ ...current, [poll.id]: explainError(error, 'Non è stato possibile registrare la risposta.') }))
    } finally {
      setVoteBusy('')
    }
  }

  return (
    <>
      <div className="section-head poll-page-heading">
        <div>
          <span className="eyebrow">Organizziamoci</span>
          <h1>Sondaggi partita</h1>
          <p className="muted">Dai la tua disponibilità: al raggiungimento dei posti la partita si crea da sola.</p>
        </div>
        <button
          type="button"
          className="btn primary poll-create-button"
          onClick={() => {
            setShowForm(value => !value)
            navigate(showForm ? '/sondaggi' : '/sondaggi/nuovo')
          }}
        >
          {showForm ? 'Chiudi' : '+ Crea sondaggio'}
        </button>
      </div>

      {showForm && (
        <form className="card stack poll-create-card" onSubmit={createPoll}>
          <div className="poll-create-intro">
            <span aria-hidden="true">⚽</span>
            <div><strong>Proponi una partita</strong><small>La creazione è aperta a tutti i membri approvati.</small></div>
          </div>
          <div className="poll-form-grid">
            <label className="poll-field">Tipo partita
              <select className="input" value={form.type} onChange={event => updateForm('type', event.target.value)}>
                {Object.entries(TYPES).map(([key, type]) => (
                  <option key={key} value={key}>{type.label} · servono {type.perTeam * 2}</option>
                ))}
              </select>
            </label>
            <label className="poll-field">Data
              <input className="input" type="date" required min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={event => updateForm('date', event.target.value)} />
            </label>
            <label className="poll-field">Ora
              <input className="input" type="time" required value={form.time} onChange={event => updateForm('time', event.target.value)} />
            </label>
            <label className="poll-field poll-location-field">Luogo
              <input className="input" required minLength={2} maxLength={120} placeholder="Es. Centro sportivo comunale" value={form.location} onChange={event => updateForm('location', event.target.value)} />
            </label>
          </div>
          <p className="poll-capacity-note">La partita si crea automaticamente quando rispondono “Ci sono” {TYPES[form.type].perTeam * 2} giocatori.</p>
          {formError && <ActionError message={formError} />}
          <div className="poll-form-actions">
            <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Creo il sondaggio…' : 'Pubblica sondaggio'}</button>
          </div>
        </form>
      )}

      {loadError ? <ActionError message={loadError} onRetry={refresh} /> : loading ? (
        <div className="card empty"><p className="muted">Caricamento sondaggi…</p></div>
      ) : polls.length === 0 ? (
        <div className="card empty poll-empty-state">
          <span aria-hidden="true">🗳️</span>
          <h2>Nessun sondaggio attivo</h2>
          <p className="muted">Proponi tu la prossima partita e raccogliamo le disponibilità.</p>
          {!showForm && <button className="btn primary" onClick={() => { setShowForm(true); navigate('/sondaggi/nuovo') }}>Crea il primo sondaggio</button>}
        </div>
      ) : (
        <div className="poll-list">
          {polls.map(poll => {
            const remaining = Math.max(0, poll.capacity - poll.yes_count)
            const isConverted = poll.status === 'converted'
            const canJoin = !isConverted || poll.yes_count < poll.capacity || poll.my_vote === true
            return (
              <article className={`card poll-card ${isConverted ? 'is-converted' : ''}`} key={poll.id}>
                <div className="poll-card-header">
                  <div>
                    <span className={`pill ${isConverted ? 'gold' : ''}`}>{isConverted ? 'Partita creata' : 'Disponibilità aperte'}</span>
                    <h2>{TYPES[poll.match_type]?.label || 'Partita'}</h2>
                  </div>
                  <span className="poll-capacity">{poll.yes_count}<small>/{poll.capacity}</small></span>
                </div>
                <div className="poll-meta-grid">
                  <span><b>📅</b>{fmtDate(poll.kickoff)} · {fmtTime(poll.kickoff)}</span>
                  <span><b>📍</b>{poll.location}</span>
                  <span><b>👤</b>Proposto da {poll.creator_name}</span>
                  <span><b>🙋</b>{poll.no_count} {poll.no_count === 1 ? 'non ci sarà' : 'non ci saranno'}</span>
                </div>
                <div className="poll-progress" role="progressbar" aria-valuenow={poll.yes_count} aria-valuemin={0} aria-valuemax={poll.capacity}>
                  <span style={{ width: `${Math.min(100, poll.yes_count / poll.capacity * 100)}%` }} />
                </div>
                {isConverted ? (
                  <div className="poll-result-row">
                    <span className="poll-result-copy">{remaining > 0 ? `Si è liberato ${remaining === 1 ? 'un posto' : `${remaining} posti`}.` : 'La rosa è al completo.'}</span>
                    {poll.match_id && <Link className="btn small" to={`/partite/${poll.match_id}`}>Apri partita</Link>}
                  </div>
                ) : (
                  <p className={`poll-remaining ${remaining === 1 ? 'is-one-left' : ''}`}>
                    {remaining === 1 ? 'Ne manca uno! 👀' : remaining === 0 ? 'Ci siamo, la partita si sta creando…' : `Mancano ${remaining} ${remaining === 1 ? 'adesione' : 'adesioni'} per creare la partita.`}
                  </p>
                )}
                <div className="poll-vote-actions">
                  <button type="button" className={`btn poll-vote-yes ${poll.my_vote === true ? 'is-selected' : ''}`} disabled={voteBusy === poll.id || (isConverted && poll.my_vote !== true && !canJoin)} onClick={() => castVote(poll, true)}>
                    {voteBusy === poll.id ? 'Salvo…' : poll.my_vote === true ? '✓ Ci sono' : 'Ci sono'}
                  </button>
                  <button type="button" className={`btn poll-vote-no ${poll.my_vote === false ? 'is-selected' : ''}`} disabled={voteBusy === poll.id} onClick={() => castVote(poll, false)}>
                    {poll.my_vote === false ? '✓ Non ci sono' : 'Non ci sono'}
                  </button>
                  {poll.my_vote == null && <small>La tua risposta è ancora attesa</small>}
                </div>
                {voteErrors[poll.id] && <ActionError message={voteErrors[poll.id]} onRetry={() => castVote(poll, voteRetry[poll.id] ?? (poll.my_vote === true))} busy={voteBusy === poll.id} />}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
