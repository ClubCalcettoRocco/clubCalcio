import { useEffect, useMemo, useState } from 'react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import {
  fullName,
  fmtDate,
  fmtTime
} from '../lib/util'

export default function Votazioni() {
  const {
    matches,
    playersById
  } = useData()

  const { me } = useAuth()

  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [votes, setVotes] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)

  /*
   * Solo partite già giocate.
   */
  const availableMatches = useMemo(
    () =>
      [...matches]
        .filter(
          match =>
            match.status === 'played'
        )
        .sort(
          (a, b) =>
            new Date(b.kickoff) -
            new Date(a.kickoff)
        ),
    [matches]
  )

  const selectedMatch = useMemo(
    () =>
      availableMatches.find(
        match =>
          match.id === selectedMatchId
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
    if (!me?.user_id) {
      return null
    }

    return Object.values(
      playersById
    ).find(
      player =>
        player.user_id === me.user_id
    ) || null
  }, [
    playersById,
    me
  ])

  /*
   * Solo giocatori registrati della partita,
   * escluso il votante stesso.
   *
   * Gli ospiti vengono esclusi perché
   * player_id è NULL.
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
          playersById[
            participant.player_id
          ]
      )
      .map(participant => ({
        ...participant,
        player:
          playersById[
            participant.player_id
          ]
      }))
  }, [
    selectedMatch,
    mePlayer,
    playersById
  ])

  /*
   * L'utente può votare solo se ha giocato.
   */
  const hasParticipation =
    Boolean(
      selectedMatch &&
      mePlayer &&
      selectedMatch.match_players.some(
        participant =>
          participant.player_id ===
          mePlayer.id
      )
    )

  /*
   * Carica i voti già dati.
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

      const {
        data,
        error
      } = await supabase.rpc(
        'get_my_match_votes',
        {
          p_match_id:
            selectedMatchId
        }
      )

      if (error) {
        setErr(error.message)
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
              : String(
                  existingVote.rating
                )
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

  function setVote(
    playerId,
    value
  ) {
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

    const { error } =
      await supabase.rpc(
        'save_my_match_votes',
        {
          p_match_id:
            selectedMatch.id,
          p_votes:
            payload
        }
      )

    if (error) {
      setErr(error.message)
    } else {
      setSaved(true)
    }

    setSaving(false)
  }

  return (
    <>
      <h1>Votazioni</h1>

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

      {!selectedMatch && (
        <div className="card empty">
          <p className="muted">
            Seleziona una partita per
            iniziare a votare.
          </p>
        </div>
      )}

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

      {selectedMatch &&
        !mePlayer && (
          <div className="card empty">
            <p className="error">
              Non è stato trovato il tuo
              profilo giocatore.
            </p>
          </div>
        )}

      {selectedMatch &&
        mePlayer &&
        hasParticipation && (
          <>
            <div
              className="card"
              style={{
                marginBottom: '32px'
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

            <div className="section-head">
              <h2>
                Vota i giocatori
              </h2>

              <span className="muted">
                Gli ospiti e te stesso
                non possono essere votati
              </span>
            </div>

            <div className="card">
              {loading ? (
                <p className="muted">
                  Caricamento voti…
                </p>
              ) : targets.length === 0 ? (
                <p className="muted">
                  Non ci sono altri giocatori
                  registrati da votare.
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
                        {' '}({target.team})
                      </small>
                    </div>

                    <select
                      className="input rating-input"
                      value={
                        votes[
                          target.player_id
                        ] ?? ''
                      }
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
                        (_, i) => i * 0.5
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

            {err && (
              <p className="error">
                {err}
              </p>
            )}

            {saved && (
              <p className="success">
                Voti salvati correttamente.
              </p>
            )}

            <button
              className="btn primary block"
              disabled={
                saving ||
                loading ||
                !allVoted ||
                targets.length === 0
              }
              onClick={saveVotes}
            >
              {saving
                ? 'Salvataggio…'
                : 'Salva voti'}
            </button>
          </>
        )}
    </>
  )
}