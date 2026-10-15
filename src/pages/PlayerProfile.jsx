import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

import { BADGES } from '../data/badges'
import BadgeCard from '../components/BadgeCard'

import {
  Avatar,
  ActionError,
  TrendChart,
  Section,
  StatBox
} from '../components/ui'

import AvatarUpload from '../components/AvatarUpload'
import { explainError } from '../lib/errorMessage'
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from '../lib/sessionDraft'
import PlayerCard, { CARD_STYLE_OPTIONS } from '../components/PlayerCard'

import {
  fmt1,
  fmtDate,
  fullName
} from '../lib/util'

export default function PlayerProfile({ self = false }) {
  const { id } = useParams()
  const { me, isAdmin } = useAuth()

  const {
    playersById,
    statsById,
    matches,
    reload
  } = useData()

  const playerId = self ? me?.id : id
  const draftKey = `clubcalcio:profile:${playerId || 'unknown'}`

  const player = playersById[playerId]
  const stats = statsById[playerId]

  const [edit, setEdit] = useState(false)
  const [trendTab, setTrendTab] = useState('media')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('')
  const [photo, setPhoto] = useState('')

  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  const [position, setPosition] = useState('')
  const [preferredFoot, setPreferredFoot] = useState('')
  const [playStyle, setPlayStyle] = useState('')
  const [cardStyle, setCardStyle] = useState('auto')

  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  /*
   * =========================================================
   * CARICAMENTO DATI PROFILO
   * =========================================================
   */

  useEffect(() => {
    if (!player) return

    const draft = readSessionDraft(draftKey, null)
    const source = draft || player
    setFirstName(source.first_name || '')
    setLastName(source.last_name || '')
    setRole(source.role_label || '')
    setPhoto(source.photo_url || '')
    setHeight(source.height_cm ?? '')
    setWeight(source.weight_kg ?? '')
    setPosition(source.position || '')
    setPreferredFoot(source.preferred_foot || '')
    setPlayStyle(source.play_style || '')
    setCardStyle(source.card_style || 'auto')
  }, [
    draftKey,
    player?.id,
    player?.first_name,
    player?.last_name,
    player?.role_label,
    player?.photo_url,
    player?.height_cm,
    player?.weight_kg,
    player?.position,
    player?.preferred_foot,
    player?.play_style,
    player?.card_style
  ])

  useEffect(() => {
    if (!edit) return
    writeSessionDraft(draftKey, {
      first_name: firstName,
      last_name: lastName,
      role_label: role,
      photo_url: photo,
      height_cm: height,
      weight_kg: weight,
      position,
      preferred_foot: preferredFoot,
      play_style: playStyle,
      card_style: cardStyle
    })
  }, [draftKey, edit, firstName, lastName, role, photo, height, weight, position, preferredFoot, playStyle, cardStyle])

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

  const trends = useMemo(() => {
    let appearances = 0
    let goals = 0
    return [...history].reverse().map(match => {
      const playerMatch = match.match_players.find(x => x.player_id === playerId)
      appearances += 1
      goals += match.goals.filter(g => g.scorer_id === playerId && !g.own_goal).length
      return {
        label: fmtDate(match.kickoff),
        media: playerMatch?.rating == null ? null : Number(playerMatch.rating),
        presenze: appearances,
        gol: goals
      }
    })
  }, [history, playerId])

  const trendConfig = {
    media: { label: 'Media voto', color: 'var(--accent-2)', value: trends.filter(p => p.media != null).map(p => ({ label: p.label, value: p.media })) },
    presenze: { label: 'Presenze totali', color: '#68d7aa', value: trends.map(p => ({ label: p.label, value: p.presenze })) },
    gol: { label: 'Gol totali', color: '#ffbd69', value: trends.map(p => ({ label: p.label, value: p.gol })) }
  }[trendTab]

  /*
   * =========================================================
   * SALVATAGGIO PROFILO
   * =========================================================
   */

  async function saveProfile(e) {
    e?.preventDefault()
    if (saving) return
    setSaving(true)

    setErr('')
    setMsg('')

    try {

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

    const { error: cardStyleError } = await supabase.rpc(
      'set_my_card_style',
      { p_card_style: cardStyle }
    )

    if (cardStyleError) {
      setErr(explainError(cardStyleError, 'Impossibile salvare lo stile della carta.'))
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
      setErr(explainError(error, 'Non è stato possibile salvare il profilo.'))
      return
    }

    await reload()

    clearSessionDraft(draftKey)
    setEdit(false)
    setMsg('Profilo aggiornato.')
    } catch (error) {
      setErr(explainError(error, 'Non è stato possibile salvare il profilo.'))
    } finally {
      setSaving(false)
    }
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

          <p className="muted">{player.role_label || 'Giocatore'}</p>
          <div className="profile-tags">
            <span>{player.position || 'Ruolo da definire'}</span>
            <span>{player.preferred_foot ? `Piede ${player.preferred_foot.toLowerCase()}` : 'Piede da definire'}</span>
            {player.play_style && <span>{player.play_style}</span>}
          </div>
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

      <details className="privacy-access-card card">
        <summary>Visibilità e permessi</summary>
        <div className="privacy-access-content">
          <p><strong>Visibile ai membri approvati:</strong> nome, foto, ruolo, preferenze di gioco, convocazioni, risultati e statistiche del profilo.</p>
          <p><strong>Dati riservati:</strong> email e identificativo dell’account non sono mostrati nei profili e sono accessibili solo tramite le funzioni amministrative protette.</p>
          <p>{isAdmin
            ? 'Con il ruolo amministratore puoi gestire convocazioni, risultati, profili e approvazione degli account.'
            : self
              ? 'Puoi modificare il tuo profilo e votare; convocazioni, risultati e profili degli altri giocatori sono gestiti dagli amministratori.'
              : 'Il giocatore può aggiornare il proprio profilo. Convocazioni, risultati e profili degli altri giocatori sono gestiti dagli amministratori.'}</p>
        </div>
      </details>

      {/* =====================================================
          MODIFICA PROFILO
          ===================================================== */}

      {edit && (
        <form
          className="card stack profile-edit-panel"
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

          <fieldset className="card-style-picker">
            <legend>Estetica della carta</legend>
            <p className="muted">Cambia solo il design: OVR e statistiche restano invariati.</p>
            <div className="card-style-options">
              {CARD_STYLE_OPTIONS.map(option => (
                <button
                  type="button"
                  key={option.id}
                  className={`card-style-option${cardStyle === option.id ? ' selected' : ''}`}
                  aria-pressed={cardStyle === option.id}
                  onClick={() => setCardStyle(option.id)}
                >
                  <span className={`card-style-swatch card-style-swatch-${option.id}`} aria-hidden="true" />
                  <span className="card-style-option-copy"><strong>{option.label}</strong><small>{option.note}</small></span>
                  {cardStyle === option.id && <span className="card-style-check">✓</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <AvatarUpload
            currentUrl={photo}
            onUploaded={setPhoto}
            size={96}
          />

          <ActionError message={err} onRetry={() => saveProfile()} busy={saving} />

          {msg && (
            <p className="success">
              {msg}
            </p>
          )}

          <button
            type="submit"
            className="btn primary"
            disabled={saving}
          >
            {saving ? 'Salvataggio…' : 'Salva profilo'}
          </button>
        </form>
      )}

      {msg && !edit && (
        <p className="success">
          {msg}
        </p>
      )}

      {/* =====================================================
          PLAYER CARD
          ===================================================== */}

      <section className={`player-card-section${edit ? ' profile-card-shift' : ''}`}>
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
          previewRarity={edit ? cardStyle : null}
        />
      </section>

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

      <Section title="Andamento statistiche">
        <div className="card chart-wrap">
          <div className="trend-chart-head">
            <div><span className="eyebrow">NEL TEMPO</span><h3>{trendConfig.label}</h3></div>
            <div className="tabs trend-tabs" aria-label="Seleziona statistica">
              {[['media', 'Media'], ['presenze', 'Presenze'], ['gol', 'Gol']].map(([key, label]) => <button key={key} className={trendTab === key ? 'on' : ''} onClick={() => setTrendTab(key)}>{label}</button>)}
            </div>
          </div>
          <TrendChart points={trendConfig.value} label={`Andamento ${trendConfig.label.toLowerCase()}`} color={trendConfig.color} emptyMessage="Servono voti registrati per mostrare la media." />
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
