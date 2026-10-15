import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { ActionError, Avatar } from '../components/ui'
import { explainError } from '../lib/errorMessage'
import {
  fullName,
  fmtDate,
  fmtTime
} from '../lib/util'

const VOTING_WINDOW_MS = 24 * 60 * 60 * 1000

export default function Votazioni() {
  const [searchParams] = useSearchParams()
  const {
    matches,
    playersById,
    reload
  } = useData()

  const { me } = useAuth()

  const [selectedMatchId, setSelectedMatchId] = useState(searchParams.get('match') || '')
  const [votes, setVotes] = useState({})
  const [mvpVote, setMvpVote] = useState('')
  const [mvpTallies, setMvpTallies] = useState({})
  const [mvpLoading, setMvpLoading] = useState(false)
  const [mvpSaving, setMvpSaving] = useState(false)
  const [mvpError, setMvpError] = useState('')
  const [mvpSaved, setMvpSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [now, setNow] = useState(Date.now())

  /*
   * Aggiorna il countdown ogni minuto.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  /*
   * Solo partite già giocate.
   */
  const availableMatches = useMemo(
    () =>
      [...matches]
        .filter(
          match => match.status === 'played'
        )
        .sort(
          (a, b) =>
            new Date(b.kickoff) -
            new Date(a.kickoff)
        ),
    [matches]
  )

  /*
   * Partita selezionata.
   */
  const selectedMatch = useMemo(
    () =>
      availableMatches.find(
        match => match.id === selectedMatchId
      ) || null,
    [
      availableMatches,
      selectedMatchId
    ]
  )

  /*
   * Profilo del giocatore autenticato.
   */
  const mePlayer = useMemo(() => {
    if (!me?.id) {
      return null
    }

    return playersById[me.id] || null
  }, [
    playersById,
    me
  ])

  /*
   * Solo giocatori registrati della partita,
   * escluso il votante stesso.
   *
   * Gli ospiti non possono ricevere voti.
   */
  const targets = useMemo(() => {
    if (!selectedMatch || !mePlayer) {
      return []
    }

    return selectedMatch.match_players
      .filter(
        participant =>
          participant.player_id &&
          participant.player_id !== mePlayer.id &&
          playersById[participant.player_id]
      )
      .map(participant => ({
        ...participant,
        player:
          playersById[participant.player_id]
      }))
  }, [
    selectedMatch,
    mePlayer,
    playersById
  ])

  /*
   * L'utente può votare solo se ha partecipato.
   */
  const hasParticipation = Boolean(
    selectedMatch &&
    mePlayer &&
    selectedMatch.match_players.some(
      participant =>
        participant.player_id === mePlayer.id
    )
  )

  /*
   * Deadline:
   * calcio d'inizio + 24 ore.
   */
  const votingDeadline = selectedMatch
    ? new Date(selectedMatch.kickoff).getTime() +
      VOTING_WINDOW_MS
    : 0

  const votesClosed =
    Boolean(selectedMatch) &&
    now >= votingDeadline

  const votingRemaining = Math.max(
    0,
    votingDeadline - now
  )

  function formatRemaining(ms) {
    const totalMinutes = Math.ceil(
      ms / 60000
    )

    const hours = Math.floor(
      totalMinutes / 60
    )

    const minutes =
      totalMinutes % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }

    return `${minutes}m`
  }

  /*
   * Carica i voti già dati.
   *
   * I voti vengono caricati anche quando la finestra
   * è chiusa, perché devono restare consultabili.
   */
  useEffect(() => {
    async function loadVotes() {
      if (
        !selectedMatchId ||
        !mePlayer ||
        !hasParticipation
      ) {
        setVotes({})
        return
      }

      setLoading(true)
      setErr('')
      setSaved(false)

      let voteResult
      try {
        voteResult = await supabase.rpc('get_my_match_votes', {
          p_match_id: selectedMatchId
        })
      } catch (error) {
        setErr(explainError(error, 'Non è stato possibile caricare i voti.'))
        setLoading(false)
        return
      }
      const { data, error } = voteResult

      if (error) {
        setErr(explainError(error, 'Non è stato possibile caricare i voti.'))
        setLoading(false)
        return
      }

      const nextVotes = {}

      for (const target of targets) {
        const existingVote =
          data?.find(
            vote =>
              vote.target_player_id ===
              target.player_id
          )

        nextVotes[target.player_id] =
          existingVote
            ? existingVote.rating == null
              ? 'SV'
              : String(existingVote.rating)
            : ''
      }

      setVotes(nextVotes)
      setLoading(false)
    }

    loadVotes()
  }, [
    selectedMatchId,
    mePlayer,
    hasParticipation,
    targets
  ])

  useEffect(() => {
    let active = true

    async function loadMvpVotes() {
      if (!selectedMatchId || !mePlayer || !hasParticipation) {
        setMvpVote('')
        setMvpTallies({})
        setMvpLoading(false)
        return
      }

      setMvpLoading(true)
      setMvpError('')
      let data
      let error
      try {
        const result = await supabase.rpc('get_match_mvp_vote_data', {
          p_match_id: selectedMatchId
        })
        data = result.data
        error = result.error
      } catch (requestError) {
        if (!active) return
        setMvpError(explainError(requestError, 'Non è stato possibile caricare le nomination MVP.'))
        setMvpLoading(false)
        return
      }

      if (!active) return
      if (error) {
        setMvpError(explainError(error, 'Non è stato possibile caricare le nomination MVP.'))
      } else {
        const rows = data || []
        setMvpTallies(Object.fromEntries(rows.map(row => [row.target_player_id, Number(row.vote_count || 0)])))
        setMvpVote(rows.find(row => row.my_vote)?.my_vote || '')
      }
      setMvpLoading(false)
    }

    loadMvpVotes()
    return () => { active = false }
  }, [selectedMatchId, mePlayer, hasParticipation, selectedMatch?.updated_at])

  function setVote(
    playerId,
    value
  ) {
    /*
     * Sicurezza anche lato frontend.
     */
    if (votesClosed) {
      return
    }

    setSaved(false)
    setErr('')

    setVotes(current => ({
      ...current,
      [playerId]: value
    }))
  }

  const allVoted =
    targets.length > 0 &&
    targets.every(
      target =>
        votes[
          target.player_id
        ] !== undefined &&
        votes[
          target.player_id
        ] !== ''
    )

  const mvpRanking = targets
    .map(target => ({ target, count: mvpTallies[target.player_id] || 0 }))
    .sort((a, b) => b.count - a.count)
  const mvpLeader = mvpRanking[0]
  const mvpSecondCount = mvpRanking[1]?.count || 0

  async function saveVotes() {
    if (!selectedMatch || !mePlayer) {
      return
    }

    if (!hasParticipation) {
      setErr(
        'Non hai partecipato a questa partita.'
      )
      return
    }

    /*
     * Controllo frontend della scadenza.
     */
    if (votesClosed) {
      setErr(
        'Le votazioni sono chiuse. Sono trascorse 24 ore dal calcio d’inizio.'
      )
      return
    }

    if (!allVoted) {
      setErr(
        'Assegna un voto oppure SV a tutti i giocatori.'
      )
      return
    }

    setSaving(true)
    setErr('')
    setSaved(false)

    const payload =
      targets.map(target => ({
        target_player_id:
          target.player_id,

        rating:
          votes[
            target.player_id
          ] === 'SV'
            ? null
            : Number(
                votes[
                  target.player_id
                ]
              )
      }))

    try {
      const { error } = await supabase.rpc('save_my_match_votes', {
        p_match_id: selectedMatch.id,
        p_votes: payload
      })
      if (error) setErr(explainError(error, 'Non è stato possibile salvare i voti.'))
      else setSaved(true)
    } catch (error) {
      setErr(explainError(error, 'Non è stato possibile salvare i voti.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveMvpVote() {
    if (!selectedMatch || !mvpVote || votesClosed) return
    setMvpSaving(true)
    setMvpError('')
    setMvpSaved(false)
    try {
      const { error } = await supabase.rpc('save_my_match_mvp_vote', {
        p_match_id: selectedMatch.id,
        p_target_player_id: mvpVote
      })
      if (error) {
        setMvpError(explainError(error, 'Non è stato possibile salvare la nomination MVP.'))
      } else {
        setMvpSaved(true)
        const { data, error: tallyError } = await supabase.rpc('get_match_mvp_vote_data', {
          p_match_id: selectedMatch.id
        })
        if (tallyError) {
          setMvpError(explainError(tallyError, 'Non è stato possibile aggiornare i voti MVP.'))
        } else {
          const rows = data || []
          setMvpTallies(Object.fromEntries(rows.map(row => [row.target_player_id, Number(row.vote_count || 0)])))
          setMvpVote(rows.find(row => row.my_vote)?.my_vote || '')
          await reload()
        }
      }
    } catch (error) {
      setMvpError(explainError(error, 'Non è stato possibile salvare la nomination MVP.'))
    } finally {
      setMvpSaving(false)
    }
  }

  return (
    <>
      <h1>Votazioni</h1>

      {/* =========================
          SELETTORE PARTITA
          ========================= */}

      <div
        className="card stack"
        style={{
          marginBottom: '40px'
        }}
      >
        <label>
          Seleziona partita

          <select
            className="input"
            value={selectedMatchId}
            onChange={e => {
              setSelectedMatchId(
                e.target.value
              )
              setErr('')
              setSaved(false)
            }}
          >
            <option value="">
              Seleziona una partita...
            </option>

            {availableMatches.map(
              match => (
                <option
                  key={match.id}
                  value={match.id}
                >
                  {fmtDate(match.kickoff)}
                  {' · '}
                  {match.team_a_name}
                  {' '}
                  {match.score_a}
                  {'–'}
                  {match.score_b}
                  {' '}
                  {match.team_b_name}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      {/* =========================
          NESSUNA PARTITA
          ========================= */}

      {!selectedMatch && (
        <div className="card empty">
          <p className="muted">
            Seleziona una partita per
            iniziare a votare.
          </p>
        </div>
      )}

      {/* =========================
          NON HA PARTECIPATO
          ========================= */}

      {selectedMatch &&
        mePlayer &&
        !hasParticipation && (
          <div className="card empty">
            <p className="muted">
              Non hai partecipato a questa
              partita, quindi non puoi votare.
            </p>
          </div>
        )}

      {/* =========================
          PROFILO NON TROVATO
          ========================= */}

      {selectedMatch &&
        !mePlayer && (
          <div className="card empty">
            <p className="error">
              Non è stato trovato il tuo
              profilo giocatore.
            </p>
          </div>
        )}

      {/* =========================
          VOTAZIONE
          ========================= */}

      {selectedMatch &&
        mePlayer &&
        hasParticipation && (
          <>
            {/* HEADER PARTITA */}

            <div
              className="card"
              style={{
                marginBottom: '24px'
              }}
            >
              <div className="match-card-date">

                <span className="match-kicker">
                  PARTITA
                </span>

                <span className="match-date">
                  {fmtDate(
                    selectedMatch.kickoff
                  )}
                  {' · '}
                  {fmtTime(
                    selectedMatch.kickoff
                  )}
                </span>

              </div>

              <div className="match-scoreboard">

                <div className="match-team match-team-a">
                  <span className="team-name">
                    {selectedMatch.team_a_name}
                  </span>
                </div>

                <div className="match-score">
                  <span>
                    {selectedMatch.score_a}
                  </span>

                  <em>—</em>

                  <span>
                    {selectedMatch.score_b}
                  </span>
                </div>

                <div className="match-team match-team-b">
                  <span className="team-name">
                    {selectedMatch.team_b_name}
                  </span>
                </div>

              </div>
            </div>

            {/* =========================
                STATO VOTAZIONI
                ========================= */}

            <div
              className={`notice vote-notice ${
                votesClosed
                  ? 'vote-notice-closed'
                  : ''
              }`}
            >

              {votesClosed ? (
                <>
                  <strong>
                    🔒 Votazioni chiuse
                  </strong>

                  <span>
                    Sono trascorse 24 ore
                    dal calcio d'inizio.
                    Puoi consultare i tuoi
                    voti, ma non modificarli.
                  </span>
                </>
              ) : (
                <>
                  <strong>
                    🗳️ Votazioni aperte
                  </strong>

                  <span>
                    Hai ancora{' '}
                    <b>
                      {formatRemaining(
                        votingRemaining
                      )}
                    </b>{' '}
                    per votare.
                  </span>
                </>
              )}

            </div>

            {/* =========================
                GIOCATORI
                ========================= */}

            <div className="section-head">

              <h2>
                Vota i giocatori
              </h2>

              <span className="muted">
                Gli ospiti e te stesso
                non possono essere votati
              </span>

            </div>

            <div
              className={`card ${
                votesClosed
                  ? 'ratings-locked'
                  : ''
              }`}
            >

              {loading ? (

                <p className="muted">
                  Caricamento voti…
                </p>

              ) : targets.length === 0 ? (

                <p className="muted">
                  Non ci sono altri
                  giocatori registrati
                  da votare.
                </p>

              ) : (

                targets.map(target => (

                  <div
                    key={target.player_id}
                    className="row rating-row"
                  >

                    <Avatar
                      player={target.player}
                      size={38}
                    />

                    <div className="grow">

                      <span>
                        {fullName(
                          target.player
                        )}
                      </span>

                      <small className="muted">
                        {' '}
                        ({target.team})
                      </small>

                    </div>

                    <select
                      className="input rating-input"
                      value={
                        votes[
                          target.player_id
                        ] ?? ''
                      }
                      disabled={votesClosed}
                      onChange={e =>
                        setVote(
                          target.player_id,
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Voto…
                      </option>

                      <option value="SV">
                        SV
                      </option>

                      {Array.from(
                        { length: 21 },
                        (_, i) =>
                          i * 0.5
                      ).map(value => (

                        <option
                          key={value}
                          value={String(value)}
                        >
                          {value}
                        </option>

                      ))}

                    </select>

                  </div>

                ))

              )}

            </div>

            {/* =========================
                MESSAGGI
                ========================= */}

            <ActionError message={err} onRetry={saveVotes} busy={saving || loading} />

            {saved && (
              <p className="success">
                Voti salvati correttamente.
              </p>
            )}

            {/* =========================
                SALVA
                ========================= */}

            <button
              className="btn primary block"
              disabled={
                saving ||
                loading ||
                votesClosed ||
                !allVoted ||
                targets.length === 0
              }
              onClick={saveVotes}
            >
              {votesClosed
                ? '🔒 Votazioni chiuse'
                : saving
                  ? 'Salvataggio…'
                  : 'Salva voti'}
            </button>

            <section className="mvp-vote-section">
              <div className="mvp-vote-heading">
                <div>
                  <span className="eyebrow">IL RICONOSCIMENTO DELLA SERATA</span>
                  <h2>Vota MVP</h2>
                  <p>Scegli chi ha fatto la differenza. L’MVP viene assegnato con almeno 2 voti e va al più votato.</p>
                </div>
                <span className="mvp-trophy" aria-hidden="true">🏆</span>
              </div>

              {selectedMatch.mvp_player_id && playersById[selectedMatch.mvp_player_id] ? (
                <div className="mvp-result-banner">
                  <span aria-hidden="true">✨</span>
                  <div><small>MVP DELLA PARTITA</small><strong>{fullName(playersById[selectedMatch.mvp_player_id])}</strong></div>
                  <b>{mvpTallies[selectedMatch.mvp_player_id] || 0} voti</b>
                </div>
              ) : (
                <div className="mvp-progress-note">
                  {mvpLeader?.count >= 2 && mvpLeader.count === mvpSecondCount
                    ? votesClosed
                      ? 'Parità finale: nessun MVP assegnato perché i primi sono a pari voti.'
                      : 'C’è un pareggio: serve un altro voto per decidere l’MVP.'
                    : `${mvpLeader?.count || 0}/2 voti necessari per assegnare il riconoscimento.`}
                </div>
              )}

              {mvpLoading ? <p className="muted">Caricamento voti MVP…</p> : (
                <div className="mvp-candidates">
                  {targets.map((target, index) => {
                    const count = mvpTallies[target.player_id] || 0
                    const selected = mvpVote === target.player_id
                    return (
                      <button
                        type="button"
                        key={target.player_id}
                        className={`mvp-candidate ${selected ? 'selected' : ''} ${selectedMatch.mvp_player_id === target.player_id ? 'winner' : ''}`}
                        disabled={votesClosed}
                        onClick={() => { setMvpVote(target.player_id); setMvpSaved(false) }}
                      >
                        <Avatar player={target.player} size={42} />
                        <span className="mvp-candidate-name"><strong>{fullName(target.player)}</strong><small>{target.team === 'A' ? selectedMatch.team_a_name : selectedMatch.team_b_name}</small></span>
                        <span className="mvp-candidate-count">{count}<small>{count === 1 ? 'voto' : 'voti'}</small></span>
                        <span className="mvp-candidate-check" aria-hidden="true">{selected ? '✓' : index + 1}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              <ActionError message={mvpError} onRetry={mvpVote ? saveMvpVote : undefined} busy={mvpSaving || mvpLoading} />
              {mvpSaved && <p className="success">La tua nomination MVP è stata salvata.</p>}
              <button className="btn primary block mvp-submit" disabled={!mvpVote || votesClosed || mvpSaving || mvpLoading || targets.length === 0} onClick={saveMvpVote}>
                {votesClosed ? '🔒 Votazioni chiuse' : mvpSaving ? 'Salvataggio…' : mvpSaved ? 'Aggiorna il mio voto MVP' : 'Conferma voto MVP'}
              </button>
            </section>

          </>
        )}
    </>
  )
}
