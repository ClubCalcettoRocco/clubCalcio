import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { fullName } from '../lib/util'

export default function MatchResult() {
  const { id } = useParams()
  const nav = useNavigate()

  const { matches, playersById, reload } = useData()

  const m = matches.find(x => x.id === id)

  const [scoreA, setScoreA] = useState(m?.score_a ?? 0)
  const [scoreB, setScoreB] = useState(m?.score_b ?? 0)
  const [mvp, setMvp] = useState(m?.mvp_player_id || '')
  const [goals, setGoals] = useState([])
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

    setScoreA(m.score_a ?? 0)
    setScoreB(m.score_b ?? 0)
    setMvp(m.mvp_player_id || '')

    setGoals(
      m.goals.map(g => {
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
      })
    )
  }, [
    id,
    m,
    guestRoster
  ])

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
    const { error } =
      await supabase.rpc(
        'save_match_result',
        {
          p_match_id: id,
          p_score_a: Number(scoreA),
          p_score_b: Number(scoreB),
          p_mvp_player_id:
            mvp || null,
          p_ratings: {},
          p_goals:
            normalizedGoals
        }
      )

    if (error) {
      setErr(error.message)
    } else {
      await reload()

      nav(
        `/partite/${id}`,
        { replace: true }
      )
    }

    setBusy(false)
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

        <label>
          MVP

          <select
            className="input"
            value={mvp}
            onChange={e =>
              setMvp(e.target.value)
            }
          >
            <option value="">
              Nessun MVP
            </option>

            {registeredRoster.map(x => (
              <option
                key={x.player_id}
                value={x.player_id}
              >
                {fullName(x.player)}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          goals.map((g, i) => (
            <div
              className="card goal-editor"
              key={i}
            >
              <div className="goal-top">
                <b>
                  Gol {i + 1}
                </b>

                <button
                  className="icon-btn"
                  onClick={() =>
                    removeGoal(i)
                  }
                  aria-label="Rimuovi"
                >
                  ×
                </button>
              </div>

              <div className="goal-grid">
                <select
                  className="input"
                  value={g.scorer_id}
                  onChange={e =>
                    updateGoal(
                      i,
                      'scorer_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Marcatore registrato
                  </option>

                  {registeredRoster.map(x => (
                    <option
                      key={x.player_id}
                      value={x.player_id}
                    >
                      {fullName(x.player)}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={
                    g.guest_scorer_match_player_id
                  }
                  onChange={e =>
                    updateGoal(
                      i,
                      'guest_scorer_match_player_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Marcatore ospite
                  </option>

                  {guestRoster.map(x => (
                    <option
                      key={x.id}
                      value={x.id}
                    >
                      {x.guest_first_name}{' '}
                      {x.guest_last_name}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={g.credited_team}
                  onChange={e =>
                    updateGoal(
                      i,
                      'credited_team',
                      e.target.value
                    )
                  }
                >
                  <option value="A">
                    Gol per {m.team_a_name}
                  </option>

                  <option value="B">
                    Gol per {m.team_b_name}
                  </option>
                </select>

                <select
                  className="input"
                  value={g.assist_id}
                  onChange={e =>
                    updateGoal(
                      i,
                      'assist_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Assist registrato
                  </option>

                  {registeredRoster.map(x => (
                    <option
                      key={x.player_id}
                      value={x.player_id}
                    >
                      {fullName(x.player)}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={
                    g.guest_assist_match_player_id
                  }
                  onChange={e =>
                    updateGoal(
                      i,
                      'guest_assist_match_player_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Assist ospite
                  </option>

                  {guestRoster.map(x => (
                    <option
                      key={x.id}
                      value={x.id}
                    >
                      {x.guest_first_name}{' '}
                      {x.guest_last_name}
                    </option>
                  ))}
                </select>

                <input
                  className="input"
                  type="number"
                  min="0"
                  max="200"
                  placeholder="Minuto"
                  value={g.minute}
                  onChange={e =>
                    updateGoal(
                      i,
                      'minute',
                      e.target.value
                    )
                  }
                />
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  checked={g.own_goal}
                  onChange={e =>
                    updateGoal(
                      i,
                      'own_goal',
                      e.target.checked
                    )
                  }
                />

                Autogol
              </label>
            </div>
          ))
        ) : (
          <div className="card empty">
            <p className="muted">
              Nessun gol inserito.
            </p>
          </div>
        )}
      </div>

      {err && (
        <p className="error">
          {err}
        </p>
      )}

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