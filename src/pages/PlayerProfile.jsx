import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

import { BADGES } from '../data/badges'
import BadgeCard from '../components/BadgeCard'

import {
  Avatar,
  RatingChart,
  Section,
  StatBox
} from '../components/ui'

import AvatarUpload from '../components/AvatarUpload'
import PlayerCard from '../components/PlayerCard'

import {
  fmt1,
  fmtDate,
  fullName
} from '../lib/util'

export default function PlayerProfile({ self = false }) {
  const { id } = useParams()
  const { me } = useAuth()

  const {
    playersById,
    statsById,
    matches,
    reload
  } = useData()

  const playerId = self ? me?.id : id

  const player = playersById[playerId]
  const stats = statsById[playerId]

  const [edit, setEdit] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('')
  const [photo, setPhoto] = useState('')

  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  const [position, setPosition] = useState('')
  const [preferredFoot, setPreferredFoot] = useState('')
  const [playStyle, setPlayStyle] = useState('')

  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  /*
   * =========================================================
   * CARICAMENTO DATI PROFILO
   * =========================================================
   */

  useEffect(() => {
    if (!player) return

    setFirstName(player.first_name || '')
    setLastName(player.last_name || '')
    setRole(player.role_label || '')
    setPhoto(player.photo_url || '')

    setHeight(player.height_cm ?? '')
    setWeight(player.weight_kg ?? '')

    setPosition(player.position || '')
    setPreferredFoot(player.preferred_foot || '')
    setPlayStyle(player.play_style || '')
  }, [
    player?.id,
    player?.first_name,
    player?.last_name,
    player?.role_label,
    player?.photo_url,
    player?.height_cm,
    player?.weight_kg,
    player?.position,
    player?.preferred_foot,
    player?.play_style
  ])

  /*
   * =========================================================
   * STORICO PARTITE DEL GIOCATORE
   * =========================================================
   *
   * Ogni partita contiene già:
   *
   * m.match_players
   * m.goals
   *
   * grazie alla query presente in data.jsx:
   *
   * matches
   *   .select('*, match_players(*), goals(*)')
   *
   * Quindi NON dobbiamo fare altre query a Supabase.
   */

  const history = useMemo(
    () =>
      matches
        .filter(
          m =>
            m.status === 'played' &&
            m.match_players?.some(
              x => x.player_id === playerId
            )
        )
        .sort(
          (a, b) =>
            new Date(b.kickoff) -
            new Date(a.kickoff)
        ),
    [matches, playerId]
  )

  /*
   * =========================================================
   * CONTESTO BADGE
   * =========================================================
   *
   * I badge ricevono questo oggetto:
   *
   * {
   *   stats,
   *   history,
   *   playerId,
   *   player
   * }
   *
   * In questo modo badges.js può leggere direttamente
   * lo storico delle partite senza creare nuove colonne
   * nel database.
   */

  const badgeContext = useMemo(
    () => ({
      stats: stats || {},
      history,
      playerId,
      player
    }),
    [
      stats,
      history,
      playerId,
      player
    ]
  )

  /*
   * =========================================================
   * ANDAMENTO VOTI
   * =========================================================
   */

  const points = useMemo(
    () =>
      history
        .filter(
          m =>
            m.match_players.find(
              x => x.player_id === playerId
            )?.rating != null
        )
        .reverse()
        .map(m => {
          const playerMatch =
            m.match_players.find(
              x => x.player_id === playerId
            )

          return {
            value: Number(playerMatch.rating),
            label: fmtDate(m.kickoff)
          }
        }),
    [history, playerId]
  )

  /*
   * =========================================================
   * SALVATAGGIO PROFILO
   * =========================================================
   */

  async function saveProfile(e) {
    e.preventDefault()

    setErr('')
    setMsg('')

    if (
      height !== '' &&
      (
        Number(height) < 120 ||
        Number(height) > 230
      )
    ) {
      setErr(
        'Inserisci un’altezza valida tra 120 e 230 cm.'
      )
      return
    }

    if (
      weight !== '' &&
      (
        Number(weight) < 30 ||
        Number(weight) > 200
      )
    ) {
      setErr(
        'Inserisci un peso valido tra 30 e 200 kg.'
      )
      return
    }

    const { error } = await supabase.rpc(
      'update_my_profile_v2',
      {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_role_label: role.trim(),
        p_photo_url: photo.trim() || null,

        p_height_cm:
          height === ''
            ? null
            : Number(height),

        p_weight_kg:
          weight === ''
            ? null
            : Number(weight),

        p_position:
          position || null,

        p_preferred_foot:
          preferredFoot || null,

        p_play_style:
          playStyle || null
      }
    )

    if (error) {
      setErr(error.message)
      return
    }

    await reload()

    setEdit(false)
    setMsg('Profilo aggiornato.')
  }

  /*
   * =========================================================
   * GIOCATORE NON TROVATO
   * =========================================================
   */

  if (!player) {
    return (
      <p className="muted">
        Giocatore non trovato.
      </p>
    )
  }

  /*
   * =========================================================
   * BADGE SBLOCCATI
   * =========================================================
   */

  const unlockedBadges = BADGES.filter(
    badge =>
      badge.requirement(badgeContext)
  )

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <>
      {!self && (
        <Link
          to="/giocatori"
          className="link"
        >
          ← Giocatori
        </Link>
      )}

      {/* =====================================================
          HEADER PROFILO
          ===================================================== */}

      <div className="profile-header card">
        <Avatar
          player={player}
          size={88}
        />

        <div className="profile-main">
          <span className="eyebrow">
            PROFILO
          </span>

          <h1>
            {fullName(player)}
          </h1>

          <p className="muted">
            {player.role_label || 'Giocatore'}
          </p>
        </div>

        {self && (
          <button
            className="btn"
            onClick={() => {
              setEdit(v => !v)
              setErr('')
              setMsg('')
            }}
          >
            {edit ? 'Chiudi' : 'Modifica'}
          </button>
        )}
      </div>

      {/* =====================================================
          PLAYER CARD
          ===================================================== */}

      <section className="player-card-section">
        <div className="player-card-heading">
          <span className="eyebrow">
            PLAYER CARD
          </span>

          <h2>
            La tua carta
          </h2>
        </div>

        <PlayerCard
          player={player}
          stats={stats}
          matches={history}
          playerId={playerId}
        />
      </section>

      {/* =====================================================
          MODIFICA PROFILO
          ===================================================== */}

      {edit && (
        <form
          className="card stack"
          onSubmit={saveProfile}
        >
          <div className="two-col">
            <label>
              Nome

              <input
                className="input"
                value={firstName}
                onChange={e =>
                  setFirstName(e.target.value)
                }
              />
            </label>

            <label>
              Cognome

              <input
                className="input"
                value={lastName}
                onChange={e =>
                  setLastName(e.target.value)
                }
              />
            </label>
          </div>

          <label>
            Ruolo / descrizione

            <input
              className="input"
              value={role}
              onChange={e =>
                setRole(e.target.value)
              }
              placeholder="Es. Ala, regista..."
            />
          </label>

          <div className="two-col">
            <label>
              Altezza (cm)

              <input
                className="input"
                type="number"
                min="120"
                max="230"
                value={height}
                onChange={e =>
                  setHeight(e.target.value)
                }
                placeholder="170"
              />
            </label>

            <label>
              Peso (kg)

              <input
                className="input"
                type="number"
                min="30"
                max="200"
                step="0.1"
                value={weight}
                onChange={e =>
                  setWeight(e.target.value)
                }
                placeholder="67"
              />
            </label>
          </div>

          <div className="two-col">
            <label>
              Posizione

              <select
                className="input"
                value={position}
                onChange={e =>
                  setPosition(e.target.value)
                }
              >
                <option value="">
                  Seleziona posizione
                </option>

                <option value="Portiere">
                  Portiere
                </option>

                <option value="Difensore">
                  Difensore
                </option>

                <option value="Centrocampista">
                  Centrocampista
                </option>

                <option value="Attaccante">
                  Attaccante
                </option>
              </select>
            </label>

            <label>
              Piede preferito

              <select
                className="input"
                value={preferredFoot}
                onChange={e =>
                  setPreferredFoot(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Seleziona piede
                </option>

                <option value="Destro">
                  Destro
                </option>

                <option value="Sinistro">
                  Sinistro
                </option>

                <option value="Ambidestro">
                  Ambidestro
                </option>
              </select>
            </label>
          </div>

          <label>
            Stile di gioco

            <select
              className="input"
              value={playStyle}
              onChange={e =>
                setPlayStyle(e.target.value)
              }
            >
              <option value="">
                Seleziona stile
              </option>

              <option value="Tecnico">
                Tecnico
              </option>

              <option value="Veloce">
                Veloce
              </option>

              <option value="Fisico">
                Fisico
              </option>

              <option value="Regista">
                Regista
              </option>

              <option value="Difensivo">
                Difensivo
              </option>

              <option value="Offensivo">
                Offensivo
              </option>

              <option value="Completo">
                Completo
              </option>
            </select>
          </label>

          <AvatarUpload
            currentUrl={photo}
            onUploaded={setPhoto}
            size={96}
          />

          {err && (
            <p className="error">
              {err}
            </p>
          )}

          {msg && (
            <p className="success">
              {msg}
            </p>
          )}

          <button
            type="submit"
            className="btn primary"
          >
            Salva profilo
          </button>
        </form>
      )}

      {msg && !edit && (
        <p className="success">
          {msg}
        </p>
      )}

      {/* =====================================================
          STATISTICHE
          ===================================================== */}

      <div className="stats-grid six">
        <StatBox
          label="Presenze"
          value={stats?.presenze ?? 0}
        />

        <StatBox
          label="Gol"
          value={stats?.gol ?? 0}
          accent
        />

        <StatBox
          label="Assist"
          value={stats?.assist ?? 0}
        />

        <StatBox
          label="Media"
          value={fmt1(stats?.media_voto)}
        />

        <StatBox
          label="MVP"
          value={stats?.mvp ?? 0}
        />

        <StatBox
          label="Voti"
          value={stats?.valutazioni ?? 0}
        />
      </div>

      {/* =====================================================
          ANDAMENTO VOTI
          ===================================================== */}

      <Section title="Andamento voti">
        <div className="card chart-wrap">
          <RatingChart
            points={points}
          />
        </div>
      </Section>

      {/* =====================================================
          BADGE
          ===================================================== */}

      <Section title="Badge">
        <div className="badges-header">
          <div>
            <span className="eyebrow">
              ACHIEVEMENTS
            </span>

            <h2>
              I tuoi badge
            </h2>
          </div>

          <span className="badge-counter">
            {unlockedBadges.length} / {BADGES.length}
          </span>
        </div>

        <div className="badges-grid">
          {BADGES.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              context={badgeContext}
            />
          ))}
        </div>
      </Section>

      {/* =====================================================
          STORICO PERSONALE
          ===================================================== */}

      <Section title="Storico personale">
        <div className="stack">
          {history.length ? (
            history.map(m => (
              <MatchCardWithPersonal
                key={m.id}
                m={m}
                playerId={playerId}
              />
            ))
          ) : (
            <div className="card empty">
              <p className="muted">
                Nessuna partita giocata.
              </p>
            </div>
          )}
        </div>
      </Section>
    </>
  )
}

/*
 * ===========================================================
 * CARD PARTITA PERSONALE
 * ===========================================================
 */

function MatchCardWithPersonal({
  m,
  playerId
}) {
  const mp =
    m.match_players.find(
      x => x.player_id === playerId
    )

  const goals =
    m.goals.filter(
      g =>
        g.scorer_id === playerId &&
        !g.own_goal
    ).length

  const assists =
    m.goals.filter(
      g =>
        g.assist_id === playerId
    ).length

  return (
    <div className="card personal-match">
      <div>
        <b>
          {m.team_a_name} {m.score_a} -{' '}
          {m.score_b} {m.team_b_name}
        </b>

        <span className="muted">
          {fmtDate(m.kickoff)} ·{' '}
          {m.location}
        </span>
      </div>

      <div className="personal-stats">
        <span>
          ⚽ {goals}
        </span>

        <span>
          🅰 {assists}
        </span>

        <span>
          ⭐{' '}
          {mp?.rating == null
            ? '—'
            : Number(
                mp.rating
              ).toFixed(1)}
        </span>
      </div>
    </div>
  )
}