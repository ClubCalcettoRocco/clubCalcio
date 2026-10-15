import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { fullName } from '../lib/util'
import { explainError } from '../lib/errorMessage'
import { ActionError } from '../components/ui'
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from '../lib/sessionDraft'

const oppositeTeam = team => team === 'A' ? 'B' : 'A'

const scorerTeamForGoal = goal =>
  goal.own_goal
    ? oppositeTeam(goal.credited_team)
    : goal.credited_team

export default function MatchResult() {
  const { id } = useParams()
  const nav = useNavigate()

  const { matches, playersById, reload } = useData()

  const m = matches.find(x => x.id === id)
  const draftKey = `clubcalcio:match-result:${id}`

  const [scoreA, setScoreA] = useState(() => readSessionDraft(draftKey, null)?.scoreA ?? m?.score_a ?? 0)
  const [scoreB, setScoreB] = useState(() => readSessionDraft(draftKey, null)?.scoreB ?? m?.score_b ?? 0)
  const [goals, setGoals] = useState(() => readSessionDraft(draftKey, null)?.goals ?? [])
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  /*
   * Tutti i partecipanti.
   */
  const roster = useMemo(() => {
    if (!m) return []

    return m.match_players.map(x => ({
      ...x,
      player: x.player_id
        ? playersById[x.player_id] || null
        : null
    }))
  }, [m, playersById])

  /*
   * Solo registrati:
   * possono ricevere voti e MVP.
   */
  const registeredRoster = useMemo(
    () =>
      roster.filter(
        x => x.player_id && x.player
      ),
    [roster]
  )

  /*
   * Solo ospiti.
   */
  const guestRoster = useMemo(
    () =>
      roster.filter(
        x => !x.player_id
      ),
    [roster]
  )

  function guestByName(firstName, lastName) {
    return guestRoster.find(
      x =>
        x.guest_first_name === firstName &&
        x.guest_last_name === lastName
    )
  }

  useEffect(() => {
    if (!m) return

    const savedDraft = readSessionDraft(draftKey, null)
    if (savedDraft) {
      setScoreA(savedDraft.scoreA ?? m.score_a ?? 0)
      setScoreB(savedDraft.scoreB ?? m.score_b ?? 0)
      setGoals(savedDraft.goals || [])
    } else {
      setScoreA(m.score_a ?? 0)
      setScoreB(m.score_b ?? 0)
      setGoals(m.goals.map(g => {
        const guestScorer =
          g.guest_scorer_first_name
            ? guestByName(
                g.guest_scorer_first_name,
                g.guest_scorer_last_name
              )
            : null

        const guestAssist =
          g.guest_assist_first_name
            ? guestByName(
                g.guest_assist_first_name,
                g.guest_assist_last_name
              )
            : null

        return {
          scorer_id: g.scorer_id || '',
          guest_scorer_match_player_id:
            guestScorer?.id || '',
          assist_id: g.assist_id || '',
          guest_assist_match_player_id:
            guestAssist?.id || '',
          minute:
            g.minute == null
              ? ''
              : String(g.minute),
          own_goal: Boolean(g.own_goal),
          credited_team:
            g.credited_team || 'A'
        }
      }))
    }
    setDraftLoaded(true)
  }, [
    id,
    m,
    guestRoster
  ])

  useEffect(() => {
    if (!draftLoaded) return
    writeSessionDraft(draftKey, { scoreA, scoreB, goals })
  }, [draftKey, draftLoaded, scoreA, scoreB, goals])

  if (!m) {
    return (
      <p className="muted">
        Partita non trovata.
      </p>
    )
  }

  function addGoal() {
    setGoals(g => [
      ...g,
      {
        scorer_id: '',
        guest_scorer_match_player_id: '',
        assist_id: '',
        guest_assist_match_player_id: '',
        minute: '',
        own_goal: false,
        credited_team: 'A'
      }
    ])
  }

  function updateGoal(index, key, value) {
    setGoals(gs =>
      gs.map((g, i) => {
        if (i !== index) return g

        const updated = {
          ...g,
          [key]: value
        }

        if (
          key === 'scorer_id' &&
          value
        ) {
          updated.guest_scorer_match_player_id = ''
        }

        if (
          key ===
            'guest_scorer_match_player_id' &&
          value
        ) {
          updated.scorer_id = ''
        }

        if (
          key === 'assist_id' &&
          value
        ) {
          updated.guest_assist_match_player_id = ''
        }

        if (
          key ===
            'guest_assist_match_player_id' &&
          value
        ) {
          updated.assist_id = ''
        }

        if (key === 'credited_team' || key === 'own_goal') {
          const scorerTeam = scorerTeamForGoal(updated)
          const scorer = registeredRoster.find(x => x.player_id === updated.scorer_id)
          const guestScorer = guestRoster.find(x => x.id === updated.guest_scorer_match_player_id)
          const assist = registeredRoster.find(x => x.player_id === updated.assist_id)
          const guestAssist = guestRoster.find(x => x.id === updated.guest_assist_match_player_id)

          if (scorer && scorer.team !== scorerTeam) updated.scorer_id = ''
          if (guestScorer && guestScorer.team !== scorerTeam) updated.guest_scorer_match_player_id = ''
          if (assist && assist.team !== scorerTeam) updated.assist_id = ''
          if (guestAssist && guestAssist.team !== scorerTeam) updated.guest_assist_match_player_id = ''
        }

        return updated
      })
    )
  }

  function removeGoal(index) {
    setGoals(gs =>
      gs.filter((_, i) => i !== index)
    )
  }

  async function save() {
    setBusy(true)
    setErr('')

    const normalizedGoals = []

    for (const g of goals) {
      const hasRegisteredScorer =
        Boolean(g.scorer_id)

      const hasGuestScorer =
        Boolean(
          g.guest_scorer_match_player_id
        )

      /*
       * Gol completamente vuoto.
       */
      if (
        !hasRegisteredScorer &&
        !hasGuestScorer
      ) {
        continue
      }

      /*
       * Un solo marcatore.
       */
      if (
        hasRegisteredScorer &&
        hasGuestScorer
      ) {
        setErr(
          'Ogni gol deve avere un solo marcatore.'
        )
        setBusy(false)
        return
      }

      const hasRegisteredAssist =
        Boolean(g.assist_id)

      const hasGuestAssist =
        Boolean(
          g.guest_assist_match_player_id
        )

      /*
       * Un solo assist.
       */
      if (
        hasRegisteredAssist &&
        hasGuestAssist
      ) {
        setErr(
          'Ogni gol può avere un solo assist.'
        )
        setBusy(false)
        return
      }

      normalizedGoals.push({
        scorer_id:
          g.scorer_id || null,

        guest_scorer_match_player_id:
          g.guest_scorer_match_player_id ||
          null,

        assist_id:
          g.assist_id || null,

        guest_assist_match_player_id:
          g.guest_assist_match_player_id ||
          null,

        minute:
          g.minute === ''
            ? null
            : Number(g.minute),

        own_goal:
          Boolean(g.own_goal),

        credited_team:
          g.credited_team
      })
    }

    /*
     * I voti NON vengono più inseriti
     * manualmente dall'amministratore.
     *
     * p_ratings resta vuoto solo per
     * compatibilità con la funzione SQL.
     */
    try {
      const { error } = await supabase.rpc(
        'save_match_result',
        {
          p_match_id: id,
          p_score_a: Number(scoreA),
          p_score_b: Number(scoreB),
          p_mvp_player_id: m.mvp_player_id || null,
          p_ratings: {},
          p_goals:
            normalizedGoals
        }
      )

      if (error) {
        setErr(explainError(error, 'Non è stato possibile salvare il risultato.'))
        return
      }

      await reload()
      clearSessionDraft(draftKey)

      nav(
        `/partite/${id}`,
        { replace: true }
      )
    } catch (error) {
      setErr(explainError(error, 'Non è stato possibile salvare il risultato.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link
        to={`/partite/${id}`}
        className="link"
      >
        ← Partita
      </Link>

      <h1>
        {m.status === 'played'
          ? 'Modifica risultato'
          : 'Inserisci risultato'}
      </h1>
      <p className="draft-saved-note">Punteggio e marcatori vengono conservati temporaneamente in questa scheda finché non riesci a salvarli.</p>

      <div className="card stack">
        <div className="score-edit">
          <div>
            <span>
              {m.team_a_name}
            </span>

            <input
              className="score-input"
              type="number"
              min="0"
              value={scoreA}
              onChange={e =>
                setScoreA(e.target.value)
              }
            />
          </div>

          <strong>–</strong>

          <div>
            <span>
              {m.team_b_name}
            </span>

            <input
              className="score-input"
              type="number"
              min="0"
              value={scoreB}
              onChange={e =>
                setScoreB(e.target.value)
              }
            />
          </div>
        </div>

      </div>

      <p className="muted">
        L’MVP sarà scelto nella pagina Votazioni in base alle nomination dei partecipanti.
      </p>

      <div
        className="section-head"
        style={{
          marginTop: '32px'
        }}
      >
        <h2>Gol</h2>

        <button
          className="btn small"
          onClick={addGoal}
        >
          + Aggiungi gol
        </button>
      </div>

      <p className="muted">
        Puoi registrare gol di giocatori
        registrati oppure ospiti. Gli ospiti
        non ricevono voti e non hanno un profilo.
      </p>

      <div className="stack">
        {goals.length ? (
          goals.map((g, i) => {
            const scorerTeam = scorerTeamForGoal(g)
            const scorerTeamName = scorerTeam === 'A' ? m.team_a_name : m.team_b_name
            const registeredScorers = registeredRoster.filter(x => x.team === scorerTeam)
            const guestScorers = guestRoster.filter(x => x.team === scorerTeam)

            return (
              <div className="card goal-editor" key={i}>
                <div className="goal-top">
                  <b>⚽ Gol {i + 1}</b>
                  <button
                    className="icon-btn goal-remove-btn"
                    onClick={() => removeGoal(i)}
                    aria-label={`Rimuovi gol ${i + 1}`}
                  >
                    ×
                  </button>
                </div>

                <div className="goal-grid">
                  <label className="goal-field goal-team-field">
                    <span>Gol attribuito a</span>
                    <select
                      className="input"
                      value={g.credited_team}
                      onChange={e => updateGoal(i, 'credited_team', e.target.value)}
                    >
                      <option value="A">{m.team_a_name}</option>
                      <option value="B">{m.team_b_name}</option>
                    </select>
                  </label>

                  <label className="goal-field">
                    <span>Marcatore · {scorerTeamName}</span>
                    <select
                      className="input"
                      value={g.scorer_id}
                      onChange={e => updateGoal(i, 'scorer_id', e.target.value)}
                    >
                      <option value="">
                        {registeredScorers.length ? 'Scegli giocatore' : 'Nessun giocatore registrato'}
                      </option>
                      {registeredScorers.map(x => (
                        <option key={x.player_id} value={x.player_id}>{fullName(x.player)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="goal-field">
                    <span>Marcatore ospite · {scorerTeamName}</span>
                    <select
                      className="input"
                      value={g.guest_scorer_match_player_id}
                      onChange={e => updateGoal(i, 'guest_scorer_match_player_id', e.target.value)}
                    >
                      <option value="">
                        {guestScorers.length ? 'Scegli ospite' : 'Nessun ospite in questa squadra'}
                      </option>
                      {guestScorers.map(x => (
                        <option key={x.id} value={x.id}>
                          {x.guest_first_name} {x.guest_last_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="goal-field">
                    <span>Assist · {scorerTeamName}</span>
                    <select
                      className="input"
                      value={g.assist_id}
                      onChange={e => updateGoal(i, 'assist_id', e.target.value)}
                    >
                      <option value="">Nessun assist / scegli giocatore</option>
                      {registeredScorers.map(x => (
                        <option key={x.player_id} value={x.player_id}>{fullName(x.player)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="goal-field">
                    <span>Assist ospite · {scorerTeamName}</span>
                    <select
                      className="input"
                      value={g.guest_assist_match_player_id}
                      onChange={e => updateGoal(i, 'guest_assist_match_player_id', e.target.value)}
                    >
                      <option value="">Nessun assist / scegli ospite</option>
                      {guestScorers.map(x => (
                        <option key={x.id} value={x.id}>
                          {x.guest_first_name} {x.guest_last_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="goal-field goal-minute-field">
                    <span>Minuto (facoltativo)</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="200"
                      inputMode="numeric"
                      placeholder="Es. 12"
                      value={g.minute}
                      onChange={e => updateGoal(i, 'minute', e.target.value)}
                    />
                  </label>
                </div>

                <label className="check goal-own-goal">
                  <input
                    type="checkbox"
                    checked={g.own_goal}
                    onChange={e => updateGoal(i, 'own_goal', e.target.checked)}
                  />
                  Autogol · il marcatore appartiene alla squadra avversaria
                </label>
              </div>
            )
          })
        ) : (
          <div className="card empty">
            <p className="muted">
              Nessun gol inserito.
            </p>
          </div>
        )}
      </div>

      <ActionError message={err} onRetry={save} busy={busy} />

      <button
        className="btn primary block"
        disabled={busy}
        onClick={save}
      >
        {busy
          ? 'Salvataggio…'
          : 'Salva risultato'}
      </button>
    </>
  )
}
