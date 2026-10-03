import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { Avatar } from '../components/ui'
import { fullName } from '../lib/util'

export default function Players() {
  const { players, statsById } = useData()
  const [q, setQ] = useState('')

  // Mostra nella sezione Giocatori solo gli account approvati
  const approvedPlayers = useMemo(
    () => players.filter(p => p.approved === true),
    [players]
  )

  const list = useMemo(
    () =>
      approvedPlayers.filter(p =>
        fullName(p).toLowerCase().includes(q.toLowerCase())
      ),
    [approvedPlayers, q]
  )

  return (
    <>
      <div className="section-head">
        <h1>Giocatori</h1>
        <span className="muted">{approvedPlayers.length} membri</span>
      </div>

      <input
        className="input"
        placeholder="Cerca giocatore…"
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      <div className="player-grid">
        {list.map(p => {
          const s = statsById[p.id]

          return (
            <Link
              to={`/giocatori/${p.id}`}
              key={p.id}
              className="card player-card hover-card"
            >
              <Avatar player={p} size={60} />

              <div className="player-card-main">
                <h3>{fullName(p)}</h3>

                <span className="muted">
                  {p.role_label || 'Giocatore'}
                </span>

                <div className="mini-stats">
                  <span>⚽ {s?.gol || 0}</span>
                  <span>
                    ⭐{' '}
                    {s?.media_voto == null
                      ? '—'
                      : Number(s.media_voto).toFixed(1)}
                  </span>
                  <span>🏟️ {s?.presenze || 0}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

