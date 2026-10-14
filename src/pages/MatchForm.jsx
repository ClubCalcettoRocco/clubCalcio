import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import {
  TYPES,
  fullName,
  localIsoFromInputs,
  toLocalInput
} from '../lib/util'

function createGuestKey() {
  return `guest-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function AssistantAvatar() {
  return (
    <svg className="assistant-avatar-art" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 5v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="4" r="3" fill="currentColor" />
      <rect x="8" y="12" width="32" height="27" rx="10" fill="currentColor" opacity=".18" />
      <rect x="10" y="14" width="28" height="23" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="19" cy="24" r="2.4" fill="currentColor" />
      <circle cx="29" cy="24" r="2.4" fill="currentColor" />
      <path d="M19 30c2.8 2.6 7.2 2.6 10 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 21v7m36-7v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function MatchForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const { matches, players, statsById, reload } = useData()
  const { session } = useAuth()

  const existing = id
    ? matches.find(m => m.id === id)
    : null

  const approvedPlayers = useMemo(
    () => players.filter(p => p.approved === true),
    [players]
  )

  const initial = useMemo(() => {
    if (!existing) {
      return {
        type: 'calcetto5',
        date: '',
        time: '21:00',
        location: '',
        a: 'Squadra A',
        b: 'Squadra B',
        notes: '',
        participants: []
      }
    }

    const d = toLocalInput(existing.kickoff)

    return {
      type: existing.type,
      date: d.slice(0, 10),
      time: d.slice(11, 16),
      location: existing.location || '',
      a: existing.team_a_name || 'Squadra A',
      b: existing.team_b_name || 'Squadra B',
      notes: existing.notes || '',
      participants: existing.match_players.map((x, index) => ({
        key: x.player_id
          ? `player-${x.player_id}`
          : `guest-${x.id || index}`,
        player_id: x.player_id || null,
        guest_first_name: x.guest_first_name || '',
        guest_last_name: x.guest_last_name || '',
        team: x.team
      }))
    }
  }, [existing])

  const [f, setF] = useState(initial)

  const [guestFirstName, setGuestFirstName] = useState('')
  const [guestLastName, setGuestLastName] = useState('')

  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantMessage, setAssistantMessage] = useState('')
  const [assistantAskedPrompt, setAssistantAskedPrompt] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('')

  useEffect(() => {
    setF(initial)
  }, [initial])

  if (id && !existing) {
    return <p className="muted">Partita non trovata.</p>
  }

  const max = TYPES[f.type].perTeam

  const count = team =>
    f.participants.filter(p => p.team === team).length

  const selectedTeam = playerId =>
    f.participants.find(
      p => p.player_id === playerId
    )?.team || null

  const setField = key => event => {
    setF(v => ({
      ...v,
      [key]: event.target.value
    }))
  }

  /*
   * GIOCATORE REGISTRATO
   */
  function toggleRegisteredPlayer(playerId, team) {
    setErr('')

    setF(v => {
      const existingPlayer = v.participants.find(
        p => p.player_id === playerId
      )

      if (!existingPlayer) {
        const teamCount = v.participants.filter(
          p => p.team === team
        ).length

        if (teamCount >= max) {
          return v
        }

        return {
          ...v,
          participants: [
            ...v.participants,
            {
              key: `player-${playerId}`,
              player_id: playerId,
              guest_first_name: '',
              guest_last_name: '',
              team
            }
          ]
        }
      }

      if (existingPlayer.team === team) {
        return {
          ...v,
          participants: v.participants.filter(
            p => p.player_id !== playerId
          )
        }
      }

      const teamCount = v.participants.filter(
        p => p.team === team
      ).length

      if (teamCount >= max) {
        return v
      }

      return {
        ...v,
        participants: v.participants.map(p =>
          p.player_id === playerId
            ? { ...p, team }
            : p
        )
      }
    })
  }

  /*
   * OSPITE
   */
  function addGuest(team) {
    const firstName = guestFirstName.trim()
    const lastName = guestLastName.trim()

    if (!firstName) {
      setErr('Inserisci il nome dell’ospite.')
      return
    }

    if (!lastName) {
      setErr('Inserisci il cognome dell’ospite.')
      return
    }

    if (f.participants.length >= max * 2) {
      setErr('Le due squadre sono già complete.')
      return
    }

    if (team && count(team) >= max) {
      setErr(`La ${team === 'A' ? f.a : f.b} è già completa.`)
      return
    }

    setErr('')

    setF(v => ({
      ...v,
      participants: [
        ...v.participants,
        {
          key: createGuestKey(),
          player_id: null,
          guest_first_name: firstName,
          guest_last_name: lastName,
          team: team || null
        }
      ]
    }))

    setGuestFirstName('')
    setGuestLastName('')
  }

  function setGuestTeam(key, team) {
    setErr('')

    setF(v => {
      const guest = v.participants.find(
        p => p.key === key
      )

      if (!guest) return v

      if (guest.team === team) {
        return {
          ...v,
          participants: v.participants.map(p =>
            p.key === key
              ? { ...p, team: null }
              : p
          )
        }
      }

      const teamCount = v.participants.filter(
        p => p.team === team
      ).length

      if (teamCount >= max) {
        return v
      }

      return {
        ...v,
        participants: v.participants.map(p =>
          p.key === key
            ? { ...p, team }
            : p
        )
      }
    })
  }

  function removeGuest(key) {
    setF(v => ({
      ...v,
      participants: v.participants.filter(
        p => p.key !== key
      )
    }))
  }

  function participantName(p) {
    if (p.player_id) {
      const player = approvedPlayers.find(
        x => x.id === p.player_id
      )

      return player
        ? fullName(player)
        : 'Giocatore'
    }

    return `${p.guest_first_name} ${p.guest_last_name}`
  }

  function participantPlayer(p) {
    if (!p.player_id) return null

    return approvedPlayers.find(
      x => x.id === p.player_id
    )
  }

  async function buildTeamsWithAssistant() {
    const roster = f.participants
    const prompt = assistantPrompt.trim() || 'Dividi i giocatori in due squadre equilibrate, considerando ruolo e rendimento medio.'
    if (roster.length !== max * 2) {
      setAssistantMessage(`Aggiungi ${max * 2 - roster.length} giocatori per completare entrambe le squadre.`)
      return
    }

    setAssistantAskedPrompt(prompt)
    setAssistantBusy(true)
    setAssistantMessage('')
    try {
      const response = await fetch('/api/build-squads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          prompt,
          perTeam: max,
          participants: roster.map(p => {
            const player = participantPlayer(p)
            const stats = player ? statsById[player.id] : null
            return {
              id: p.key,
              name: participantName(p),
              position: player?.position || 'Non specificato',
              role: player?.role_label || '',
              averageRating: stats?.media_voto ?? null,
              goals: stats?.gol ?? 0,
              assists: stats?.assist ?? 0,
              games: stats?.presenze ?? 0
            }
          })
        })
      })
      const responseText = await response.text()
      let result
      try {
        result = responseText ? JSON.parse(responseText) : null
      } catch {
        result = null
      }
      if (!result || typeof result !== 'object') {
        const contentType = response.headers.get('content-type') || ''
        if (!response.ok) {
          throw new Error(`Il server AI ha risposto con errore HTTP ${response.status}.`)
        }
        if (!contentType.includes('application/json')) {
          throw new Error('L’endpoint AI non è raggiungibile: il server ha restituito la pagina dell’app invece della risposta API. Verifica il deploy della funzione su Vercel.')
        }
        throw new Error(`Il server AI ha restituito una risposta vuota o non valida (HTTP ${response.status}).`)
      }
      if (!response.ok) throw new Error(result.error || 'Non è stato possibile generare le squadre.')

      const assignments = result.assignments
      const validIds = new Set(roster.map(p => p.key))
      const assignedIds = assignments.map(item => item.id)
      if (assignments.length !== roster.length || new Set(assignedIds).size !== roster.length || assignedIds.some(key => !validIds.has(key)) || assignments.filter(item => item.team === 'A').length !== max || assignments.filter(item => item.team === 'B').length !== max || assignments.some(item => !['A', 'B'].includes(item.team))) {
        throw new Error('La proposta ricevuta non rispetta il numero dei partecipanti. Riprova.')
      }

      const teamById = new Map(assignments.map(item => [item.id, item.team]))
      setF(current => ({
        ...current,
        participants: current.participants.map(p => ({ ...p, team: teamById.get(p.key) }))
      }))
      setAssistantMessage(result.explanation || 'Squadre generate. Puoi ancora modificarle manualmente.')
    } catch (error) {
      setAssistantMessage(error.message || 'Errore durante la generazione delle squadre.')
    } finally {
      setAssistantBusy(false)
    }
  }

  const valid =
    f.date &&
    f.time &&
    f.location.trim() &&
    count('A') === max &&
    count('B') === max

  const hasUnassigned = f.participants.some(
    p => !p.team
  )

  const availablePlayers = approvedPlayers.filter(player => {
    const assigned = f.participants.some(p => p.player_id === player.id)
    const matchesSearch = fullName(player).toLocaleLowerCase('it').includes(playerSearch.trim().toLocaleLowerCase('it'))
    const matchesPosition = !positionFilter || player.position === positionFilter
    return !assigned && matchesSearch && matchesPosition
  })

  const teamAverage = team => {
    const ratings = f.participants
      .filter(p => p.team === team && p.player_id)
      .map(p => statsById[p.player_id]?.media_voto == null ? NaN : Number(statsById[p.player_id].media_voto))
      .filter(Number.isFinite)
    return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null
  }

  const averageA = teamAverage('A')
  const averageB = teamAverage('B')
  const balanceGap = averageA != null && averageB != null ? Math.abs(averageA - averageB) : null

  async function save() {
    if (!valid || hasUnassigned) return

    setBusy(true)
    setErr('')

    const makeParticipant = p => {
      if (p.player_id) {
        return {
          player_id: p.player_id
        }
      }

      const firstName =
        (p.guest_first_name || '').trim()

      const lastName =
        (p.guest_last_name || '').trim()

      if (!firstName || !lastName) {
        throw new Error(
          'Ogni ospite deve avere nome e cognome.'
        )
      }

      return {
        guest_first_name: firstName,
        guest_last_name: lastName
      }
    }

    let team_a
    let team_b

    try {
      team_a = f.participants
        .filter(p => p.team === 'A')
        .map(makeParticipant)

      team_b = f.participants
        .filter(p => p.team === 'B')
        .map(makeParticipant)
    } catch (e) {
      setErr(e.message)
      setBusy(false)
      return
    }

    const payload = {
      type: f.type,
      kickoff: localIsoFromInputs(
        f.date,
        f.time
      ),
      location: f.location.trim(),
      team_a_name:
        f.a.trim() || 'Squadra A',
      team_b_name:
        f.b.trim() || 'Squadra B',
      notes: f.notes.trim(),
      team_a,
      team_b
    }

    const { data, error } =
      await supabase.rpc(
        'save_match_with_guests',
        {
          p_id: id || null,
          p: payload
        }
      )

    if (error) {
      setErr(error.message)
    } else {
      await reload()

      nav(`/partite/${data}`, {
        replace: true
      })
    }

    setBusy(false)
  }

  function renderTeam(team) {
    const roster = f.participants.filter(p => p.team === team)
    const name = team === 'A' ? f.a || 'Squadra A' : f.b || 'Squadra B'
    const destination = team === 'A' ? 'B' : 'A'
    const destinationName = destination === 'A' ? f.a || 'Squadra A' : f.b || 'Squadra B'

    return (
      <section className={`card team-builder-panel team-builder-${team.toLowerCase()}`} key={team}>
        <header className="team-builder-heading">
          <div className="team-builder-name">
            <span className="team-builder-mark">{team}</span>
            <div><span className="eyebrow">SQUADRA {team}</span><h3>{name}</h3></div>
          </div>
          <strong className={`team-capacity${roster.length === max ? ' is-full' : ''}`}>{roster.length}<span>/{max}</span></strong>
        </header>
        <div className="team-capacity-track"><span style={{ width: `${Math.min(100, (roster.length / max) * 100)}%` }} /></div>
        <div className="team-roster-list">
          {roster.map(participant => {
            const player = participantPlayer(participant)
            const stats = player ? statsById[player.id] : null
            return (
              <div className="team-roster-player" key={participant.key}>
                {player ? <Avatar player={player} size={38} /> : <span className="avatar team-guest-avatar">👤</span>}
                <span className="team-roster-copy">
                  <strong>{participantName(participant)}</strong>
                  <small>{player ? `${player.position || 'Ruolo da definire'}${stats?.media_voto != null ? ` · ⭐ ${Number(stats.media_voto).toFixed(1)}` : ''}` : 'Ospite'}</small>
                </span>
                <div className="team-roster-actions">
                  <button type="button" className="team-move-btn" disabled={count(destination) >= max} title={count(destination) >= max ? `${destinationName} è completa` : `Sposta in ${destinationName}`} onClick={() => player ? toggleRegisteredPlayer(player.id, destination) : setGuestTeam(participant.key, destination)} aria-label={`Sposta ${participantName(participant)} in ${destinationName}`}>→ {destination}</button>
                  <button type="button" className="team-remove-btn" onClick={() => player ? toggleRegisteredPlayer(player.id, team) : removeGuest(participant.key)} aria-label={`Rimuovi ${participantName(participant)} dalla squadra`} title="Rimuovi dalla squadra">×</button>
                </div>
              </div>
            )
          })}
          {roster.length === 0 && <div className="team-empty-state">Aggiungi qui i giocatori</div>}
        </div>
        <div className="team-open-slots" aria-label={`${max - roster.length} posti liberi`}>
          {Array.from({ length: max - roster.length }, (_, index) => <span key={index} title="Posto libero">＋</span>)}
        </div>
      </section>
    )
  }

  return (
    <>
      <Link
        to={id ? `/partite/${id}` : '/partite'}
        className="link"
      >
        ← Indietro
      </Link>

      <h1>
        {id
          ? 'Modifica partita'
          : 'Crea partita'}
      </h1>

      <div className="card stack">

        <label>
          Tipo partita

          <select
            className="input"
            value={f.type}
            onChange={setField('type')}
          >
            {Object.entries(TYPES).map(
              ([key, value]) => (
                <option
                  key={key}
                  value={key}
                >
                  {value.label} ({value.perTeam} per
                  squadra)
                </option>
              )
            )}
          </select>
        </label>

        <div className="two-col">

          <label>
            Data

            <input
              className="input"
              type="date"
              value={f.date}
              onChange={setField('date')}
              required
            />
          </label>

          <label>
            Ora

            <input
              className="input"
              type="time"
              value={f.time}
              onChange={setField('time')}
              required
            />
          </label>

        </div>

        <label>
          Luogo

          <input
            className="input"
            value={f.location}
            onChange={setField('location')}
            placeholder="Campo sportivo…"
            required
          />
        </label>

        <div className="two-col">

          <label>
            Nome squadra A

            <input
              className="input"
              value={f.a}
              onChange={setField('a')}
            />
          </label>

          <label>
            Nome squadra B

            <input
              className="input"
              value={f.b}
              onChange={setField('b')}
            />
          </label>

        </div>

        <label>
          Note (opzionale)

          <textarea
            className="input textarea"
            value={f.notes}
            onChange={setField('notes')}
            rows="3"
          />
        </label>

      </div>


      <section className="roster-builder">
        <div className="roster-builder-title">
          <div>
            <span className="eyebrow">ROSE DELLA PARTITA</span>
            <h2>Componi le squadre</h2>
            <p className="muted">Aggiungi i giocatori e spostali tra le due rose. I posti liberi sono sempre visibili.</p>
          </div>
          <span className={`roster-total${f.participants.length === max * 2 ? ' is-complete' : ''}`}>{f.participants.length}<small>/{max * 2}</small></span>
        </div>

        <div className="team-builder-grid">
          {renderTeam('A')}
          {renderTeam('B')}
        </div>

        <div className={`team-balance-summary${balanceGap != null && balanceGap > 1 ? ' needs-balance' : ''}`}>
          <span className="balance-icon">⚖</span>
          <div className="balance-copy">
            <strong>{balanceGap == null ? 'Confronto delle squadre' : balanceGap <= 0.5 ? 'Squadre ben bilanciate' : `Differenza media ${balanceGap.toFixed(1)}`}</strong>
            <small>{averageA == null && averageB == null ? 'Aggiungi giocatori con voti disponibili per confrontare il rendimento.' : `Media ${f.a || 'Squadra A'}: ${averageA == null ? '—' : averageA.toFixed(1)} · ${f.b || 'Squadra B'}: ${averageB == null ? '—' : averageB.toFixed(1)}`}</small>
          </div>
          {balanceGap != null && <span className="balance-delta">{balanceGap <= 0.5 ? 'OK' : 'DA RIVEDERE'}</span>}
        </div>

        <section className="available-players-section">
          <div className="available-players-heading">
            <div><h3>Giocatori disponibili</h3><span className="muted">{availablePlayers.length} da assegnare</span></div>
            <div className="player-search-filters">
              <input id="player-search" className="input" value={playerSearch} onChange={event => setPlayerSearch(event.target.value)} placeholder="Cerca nome…" aria-label="Cerca giocatore" />
              <select className="input" value={positionFilter} onChange={event => setPositionFilter(event.target.value)} aria-label="Filtra per ruolo">
                <option value="">Tutti i ruoli</option>
                {['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'].map(position => <option key={position} value={position}>{position}</option>)}
              </select>
            </div>
          </div>

          <div className="available-player-list">
            {availablePlayers.map(player => {
              const stats = statsById[player.id]
              return (
                <article className="available-player-card" key={player.id}>
                  <Avatar player={player} size={42} />
                  <span className="available-player-info">
                    <strong>{fullName(player)}</strong>
                    <small>{player.position || 'Ruolo da definire'}{stats?.media_voto != null ? ` · ⭐ ${Number(stats.media_voto).toFixed(1)}` : ''}{stats?.presenze ? ` · ${stats.presenze} pres.` : ''}</small>
                  </span>
                  <div className="available-player-actions">
                    <button type="button" className="chip team-chip-a" disabled={count('A') >= max} onClick={() => toggleRegisteredPlayer(player.id, 'A')} aria-label={`Aggiungi ${fullName(player)} a ${f.a || 'Squadra A'}`}>+ A</button>
                    <button type="button" className="chip team-chip-b" disabled={count('B') >= max} onClick={() => toggleRegisteredPlayer(player.id, 'B')} aria-label={`Aggiungi ${fullName(player)} a ${f.b || 'Squadra B'}`}>+ B</button>
                  </div>
                </article>
              )
            })}
            {availablePlayers.length === 0 && <p className="available-empty">{approvedPlayers.length === f.participants.filter(p => p.player_id).length ? 'Tutti i giocatori approvati sono già in una rosa.' : 'Nessun giocatore trovato con questi filtri.'}</p>}
          </div>
        </section>

        <section className="guest-builder">
          <div className="guest-builder-heading">
            <div><h3>Aggiungi un ospite</h3><p className="muted">Scegli subito la squadra in cui inserirlo.</p></div>
            <span className="guest-builder-icon">＋</span>
          </div>
          <div className="guest-builder-form">
            <input className="input" placeholder="Nome" value={guestFirstName} onChange={event => setGuestFirstName(event.target.value)} aria-label="Nome ospite" />
            <input className="input" placeholder="Cognome" value={guestLastName} onChange={event => setGuestLastName(event.target.value)} aria-label="Cognome ospite" />
            <button type="button" className="btn guest-add-a" disabled={count('A') >= max || f.participants.length >= max * 2} onClick={() => addGuest('A')}>+ {f.a || 'Squadra A'}</button>
            <button type="button" className="btn guest-add-b" disabled={count('B') >= max || f.participants.length >= max * 2} onClick={() => addGuest('B')}>+ {f.b || 'Squadra B'}</button>
          </div>
          {f.participants.some(participant => !participant.player_id) && <p className="guest-list-label">Ospiti già inseriti</p>}
          {f.participants.filter(participant => !participant.player_id).map(guest => <div className="guest-roster-chip" key={guest.key}><span>👤 {participantName(guest)} <small>· Squadra {guest.team || 'da assegnare'}</small></span><button type="button" onClick={() => removeGuest(guest.key)} aria-label={`Rimuovi ${participantName(guest)}`}>×</button></div>)}
        </section>
      </section>


      {hasUnassigned && (
        <p className="muted">
          Alcuni giocatori non sono ancora
          assegnati a una squadra.
        </p>
      )}

      {err && (
        <p className="error">
          {err}
        </p>
      )}

      <button
        className="btn primary block"
        disabled={
          !valid ||
          busy ||
          hasUnassigned
        }
        onClick={save}
      >
        {busy
          ? 'Salvataggio…'
          : 'Salva partita'}
      </button>

      <div className="squad-assistant">
        {assistantOpen && (
          <section className="squad-chat-panel" id="squad-assistant-chat" aria-label="Chat per creare le squadre">
            <header className="squad-chat-header">
              <span className="assistant-avatar"><AssistantAvatar /></span>
              <span className="squad-chat-heading">
                <strong>Assistente squadre</strong>
                <small>Pronto a comporre le formazioni</small>
              </span>
              <button type="button" className="squad-chat-close" onClick={() => setAssistantOpen(false)} aria-label="Chiudi la chat">×</button>
            </header>

            <div className="squad-chat-thread" aria-live="polite">
              <div className="squad-chat-message assistant-message">
                Ciao! Raccontami come vuoi creare le squadre. Posso bilanciare ruoli e rendimento, oppure seguire preferenze come tenere due persone insieme o dividerle.
              </div>
              {assistantAskedPrompt && <div className="squad-chat-message user-message">{assistantAskedPrompt}</div>}
              {assistantBusy && <div className="squad-chat-message assistant-message typing-message"><span /><span /><span /></div>}
              {assistantMessage && <div className="squad-chat-message assistant-message" role="status">{assistantMessage}</div>}
            </div>

            <form className="squad-chat-form" onSubmit={event => { event.preventDefault(); buildTeamsWithAssistant() }}>
              <textarea
                className="input textarea"
                value={assistantPrompt}
                onChange={event => setAssistantPrompt(event.target.value)}
                rows="2"
                maxLength={500}
                placeholder="Es. Marco e Luca in squadre diverse…"
                aria-label="Scrivi come vuoi comporre le squadre"
              />
              <button type="submit" className="btn primary" disabled={assistantBusy}>
                {assistantBusy ? 'Creo…' : 'Crea squadre'}
              </button>
            </form>
            <small className="squad-chat-hint">
              {f.participants.length === max * 2
                ? 'Puoi ancora modificare le assegnazioni a mano.'
                : `Seleziona tutti i ${max * 2} partecipanti per avviare la composizione.`}
            </small>
          </section>
        )}

        <button
          type="button"
          className={`squad-assistant-launcher ${assistantOpen ? 'is-open' : ''}`}
          onClick={() => setAssistantOpen(value => !value)}
          aria-label={assistantOpen ? 'Chiudi assistente squadre' : 'Apri assistente squadre'}
          aria-expanded={assistantOpen}
          aria-controls={assistantOpen ? 'squad-assistant-chat' : undefined}
        >
          {assistantOpen ? <span className="assistant-launcher-close">×</span> : <AssistantAvatar />}
        </button>
      </div>
    </>
  )
}
