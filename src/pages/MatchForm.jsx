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
  function addGuest() {
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
          team: null
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


      {/* ========================= */}
      {/* GIOCATORI REGISTRATI */}
      {/* ========================= */}

      <div className="section-head">
        <h2>Giocatori</h2>

        <span
          className={
            count('A') === max &&
            count('B') === max
              ? 'success'
              : 'muted'
          }
        >
          {count('A')}/{max} · {count('B')}/{max}
        </span>
      </div>

      <div className="card">

        {approvedPlayers.map(player => {
          const team = selectedTeam(player.id)

          return (
            <div
              key={player.id}
              className="row player-pick"
            >
              <Avatar
                player={player}
                size={36}
              />

              <span className="grow">
                {fullName(player)}
              </span>

              <button
                type="button"
                className={`chip ${
                  team === 'A' ? 'on' : ''
                }`}
                disabled={
                  count('A') >= max &&
                  team !== 'A'
                }
                onClick={() =>
                  toggleRegisteredPlayer(
                    player.id,
                    'A'
                  )
                }
              >
                A
              </button>

              <button
                type="button"
                className={`chip ${
                  team === 'B' ? 'on' : ''
                }`}
                disabled={
                  count('B') >= max &&
                  team !== 'B'
                }
                onClick={() =>
                  toggleRegisteredPlayer(
                    player.id,
                    'B'
                  )
                }
              >
                B
              </button>
            </div>
          )
        })}

        {approvedPlayers.length === 0 && (
          <p className="muted">
            Nessun giocatore approvato.
          </p>
        )}

      </div>


      {/* ========================= */}
      {/* OSPITI */}
      {/* ========================= */}

      <div className="section-head">
        <h2>Giocatori non registrati</h2>
      </div>

      <div className="card stack">

        <div className="two-col">

          <input
            className="input"
            placeholder="Nome ospite"
            value={guestFirstName}
            onChange={e =>
              setGuestFirstName(
                e.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Cognome ospite"
            value={guestLastName}
            onChange={e =>
              setGuestLastName(
                e.target.value
              )
            }
          />

        </div>

        <button
          type="button"
          className="btn"
          onClick={addGuest}
        >
          + Aggiungi ospite
        </button>

        {f.participants
          .filter(p => !p.player_id)
          .map(guest => (

            <div
              key={guest.key}
              className="row player-pick"
            >

              <div
                className="avatar"
                style={{
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                👤
              </div>

              <span className="grow">
                {participantName(guest)}

                <small className="muted">
                  {' '}· Ospite
                </small>
              </span>

              <button
                type="button"
                className={`chip ${
                  guest.team === 'A'
                    ? 'on'
                    : ''
                }`}
                disabled={
                  count('A') >= max &&
                  guest.team !== 'A'
                }
                onClick={() =>
                  setGuestTeam(
                    guest.key,
                    'A'
                  )
                }
              >
                A
              </button>

              <button
                type="button"
                className={`chip ${
                  guest.team === 'B'
                    ? 'on'
                    : ''
                }`}
                disabled={
                  count('B') >= max &&
                  guest.team !== 'B'
                }
                onClick={() =>
                  setGuestTeam(
                    guest.key,
                    'B'
                  )
                }
              >
                B
              </button>

              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  removeGuest(guest.key)
                }
              >
                ×
              </button>

            </div>
          ))}

        {!f.participants.some(
          p => !p.player_id
        ) && (
          <p className="muted">
            Nessun ospite aggiunto.
          </p>
        )}

      </div>


      {/* ========================= */}
      {/* RIEPILOGO SQUADRE */}
      {/* ========================= */}

      <div
        style={{
          marginTop: '40px'
        }}
      >

        <div className="two-col">

          {/* SQUADRA A */}

          <div className="card">

            <div className="section-head">

              <h3>
                {f.a || 'Squadra A'}
              </h3>

              <span className="muted">
                {count('A')}/{max}
              </span>

            </div>

            {f.participants
              .filter(p => p.team === 'A')
              .map(p => {

                const player =
                  participantPlayer(p)

                return (
                  <div
                    key={p.key}
                    className="row player-pick"
                  >

                    {player ? (
                      <Avatar
                        player={player}
                        size={36}
                      />
                    ) : (
                      <div
                        className="avatar"
                        style={{
                          width: 36,
                          height: 36,
                          display: 'grid',
                          placeItems: 'center'
                        }}
                      >
                        👤
                      </div>
                    )}

                    <span className="grow">
                      {participantName(p)}

                      {!p.player_id && (
                        <small className="muted">
                          {' '}· Ospite
                        </small>
                      )}
                    </span>

                    <button
                      type="button"
                      className="chip on"
                      onClick={() =>
                        p.player_id
                          ? toggleRegisteredPlayer(
                              p.player_id,
                              'A'
                            )
                          : setGuestTeam(
                              p.key,
                              'A'
                            )
                      }
                    >
                      A
                    </button>

                    <button
                      type="button"
                      className="chip"
                      disabled={
                        count('B') >= max
                      }
                      onClick={() =>
                        p.player_id
                          ? toggleRegisteredPlayer(
                              p.player_id,
                              'B'
                            )
                          : setGuestTeam(
                              p.key,
                              'B'
                            )
                      }
                    >
                      B
                    </button>

                  </div>
                )
              })}

            {count('A') === 0 && (
              <p className="muted">
                Nessun giocatore.
              </p>
            )}

          </div>


          {/* SQUADRA B */}

          <div className="card">

            <div className="section-head">

              <h3>
                {f.b || 'Squadra B'}
              </h3>

              <span className="muted">
                {count('B')}/{max}
              </span>

            </div>

            {f.participants
              .filter(p => p.team === 'B')
              .map(p => {

                const player =
                  participantPlayer(p)

                return (
                  <div
                    key={p.key}
                    className="row player-pick"
                  >

                    {player ? (
                      <Avatar
                        player={player}
                        size={36}
                      />
                    ) : (
                      <div
                        className="avatar"
                        style={{
                          width: 36,
                          height: 36,
                          display: 'grid',
                          placeItems: 'center'
                        }}
                      >
                        👤
                      </div>
                    )}

                    <span className="grow">
                      {participantName(p)}

                      {!p.player_id && (
                        <small className="muted">
                          {' '}· Ospite
                        </small>
                      )}
                    </span>

                    <button
                      type="button"
                      className="chip"
                      disabled={
                        count('A') >= max
                      }
                      onClick={() =>
                        p.player_id
                          ? toggleRegisteredPlayer(
                              p.player_id,
                              'A'
                            )
                          : setGuestTeam(
                              p.key,
                              'A'
                            )
                      }
                    >
                      A
                    </button>

                    <button
                      type="button"
                      className="chip on"
                      onClick={() =>
                        p.player_id
                          ? toggleRegisteredPlayer(
                              p.player_id,
                              'B'
                            )
                          : setGuestTeam(
                              p.key,
                              'B'
                            )
                      }
                    >
                      B
                    </button>

                  </div>
                )
              })}

            {count('B') === 0 && (
              <p className="muted">
                Nessun giocatore.
              </p>
            )}

          </div>

        </div>

      </div>


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
