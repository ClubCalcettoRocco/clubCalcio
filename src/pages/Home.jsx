import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import {
  EmptyState,
  Lineups,
  MatchCard,
  PlayerRow,
  Section,
  StatBox
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { TYPES, fmtDate, fmtTime, fmt1 } from '../lib/util'

export default function Home() {
  const { matches, stats, playersById } = useData()
  const { me } = useAuth()

  const played = matches
    .filter(m => m.status === 'played')
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))

  const upcoming = matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))

  const next = upcoming[0]
  const last = played[0]

  const top = [...stats]
    .filter(s => Number(s.gol) > 0)
    .sort((a, b) => Number(b.gol) - Number(a.gol))
    .slice(0, 5)

  const myStats = stats.find(s => s.player_id === me?.id)

  /* =========================
     MIGLIOR MARCATORE DELL'ULTIMA PARTITA
     ========================= */

  let bestScorerId = null
  let bestScorerGoals = 0

  if (last?.goals?.length) {
    const tally = {}

    last.goals
      .filter(g => !g.own_goal && g.scorer_id)
      .forEach(g => {
        tally[g.scorer_id] = (tally[g.scorer_id] || 0) + 1
      })

    const best = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])[0]

    if (best) {
      bestScorerId = best[0]
      bestScorerGoals = best[1]
    }
  }

  const mvpPlayer = last?.mvp_player_id
    ? playersById[last.mvp_player_id]
    : null

  const bestScorer = bestScorerId
    ? playersById[bestScorerId]
    : null

  return (
    <>
      {/* =========================
          HERO
          ========================= */}

      <section className="dashboard-hero">

        <div className="dashboard-hero-copy">

          {me && (
            <div className="home-profile">
              {me.photo_url ? (
                <img
                  src={me.photo_url}
                  alt={`Foto profilo di ${me.first_name || 'Giocatore'}`}
                  className="home-profile-image"
                />
              ) : (
                <div className="home-profile-placeholder">
                  {me.first_name
                    ? me.first_name.charAt(0).toUpperCase()
                    : '👤'}
                </div>
              )}
            </div>
          )}

          <span className="eyebrow">
            CALCETTO CLUB
          </span>

          <h1>
            Ciao, {me?.first_name || 'Giocatore'}{' '}
            <span aria-hidden="true">👋</span>
          </h1>

          <p className="muted">
            Partite, risultati e statistiche del tuo gruppo.
            Tutto in un unico posto.
          </p>

        </div>

        <div
          className="home-orb"
          aria-hidden="true"
        >
          <span className="home-orb-core">
            ⚽
          </span>
        </div>

      </section>

      {/* =========================
          STATISTICHE
          ========================= */}

      <div className="stats-grid four dashboard-stats">

        <StatBox
          label="Presenze"
          value={myStats?.presenze ?? 0}
          icon="◷"
        />

        <StatBox
          label="Gol"
          value={myStats?.gol ?? 0}
          accent
          icon="⚽"
        />

        <StatBox
          label="Assist"
          value={myStats?.assist ?? 0}
          icon="↗"
        />

        <StatBox
          label="Media voto"
          value={fmt1(myStats?.media_voto)}
          icon="★"
        />

      </div>

      {/* =========================
          PROSSIMA PARTITA
          ========================= */}

      <Section
        title="Prossima partita"
        action={
          next
            ? <span className="section-note">MATCHDAY</span>
            : null
        }
      >

        {next ? (

          <div className="card upcoming-card">

            <div className="match-card-top">

              <div>

                <span className="match-date">
                  {fmtDate(next.kickoff)} · {fmtTime(next.kickoff)}
                </span>

                <span className="match-kicker">
                  PROSSIMA PARTITA
                </span>

              </div>

              <span className="pill match-badge">
                {TYPES[next.type]?.label}
              </span>

            </div>

            <p className="match-location">
              📍 {next.location}
            </p>

            <Lineups
              m={next}
              playersById={playersById}
            />

            <Link
              to={`/partite/${next.id}`}
              className="link match-action"
            >
              Apri partita
              <span aria-hidden="true">→</span>
            </Link>

          </div>

        ) : (

          <EmptyState>
            Nessuna partita in programma.
          </EmptyState>

        )}

      </Section>

      {/* =========================
          ULTIMA PARTITA
          ========================= */}

      <Section
        title="Ultima partita giocata"
        action={
          last
            ? (
              <Link
                to={`/partite/${last.id}`}
                className="link"
              >
                Dettagli →
              </Link>
            )
            : null
        }
      >

        {last ? (

          <div className="stack">

            <MatchCard
              m={last}
              featured
            />

            <div className="card last-match-summary">

              {/* MVP */}

              {mvpPlayer ? (

                <PlayerRow
                  player={mvpPlayer}
                  right={
                    <span className="pill gold">
                      MVP
                    </span>
                  }
                />

              ) : null}

              {/* MIGLIOR MARCATORE */}

              {bestScorer ? (

                <PlayerRow
                  player={bestScorer}
                  right={
                    <span className="pill">
                      {bestScorerGoals}{' '}
                      {bestScorerGoals === 1 ? 'gol' : 'gol'}
                    </span>
                  }
                />

              ) : null}

              {/* NESSUN MVP / MARCATORE */}

              {!mvpPlayer && !bestScorer && (

                <p className="muted">
                  Nessun dettaglio registrato.
                </p>

              )}

            </div>

          </div>

        ) : (

          <EmptyState>
            Ancora nessuna partita giocata.
          </EmptyState>

        )}

      </Section>

      {/* =========================
          CLASSIFICA MARCATORI
          ========================= */}

      <Section
        title="Classifica marcatori"
        action={
          <Link
            to="/classifiche"
            className="link"
          >
            Tutte →
          </Link>
        }
      >

        <div className="card leaderboard-card">

          {top.length ? (

            top.map((s, i) => {

              const player = playersById[s.player_id]

              if (!player) return null

              return (
                <PlayerRow
                  key={s.player_id}
                  player={player}
                  right={
                    <>
                      <span className="rank-chip">
                        #{i + 1}
                      </span>

                      <b className="leader-goals">
                        {s.gol}
                      </b>
                    </>
                  }
                />
              )
            })

          ) : (

            <p className="muted">
              Nessun gol registrato.
            </p>

          )}

        </div>

      </Section>

      {/* =========================
          ULTIME PARTITE
          ========================= */}

      <Section
        title="Ultime partite"
        action={
          <Link
            to="/partite"
            className="link"
          >
            Storico →
          </Link>
        }
      >

        <div className="stack">

          {played.slice(0, 5).map(m => (
            <MatchCard
              key={m.id}
              m={m}
            />
          ))}

        </div>

      </Section>
    </>
  )
}