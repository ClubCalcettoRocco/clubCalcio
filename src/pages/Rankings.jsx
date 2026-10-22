import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { Avatar, EmptyState, PlayerRow, Section } from '../components/ui'
import { fmt1, fullName } from '../lib/util'

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m3 3v7m6-7v7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

export default function Rankings() {
  const { stats, playersById } = useData()
  const [tab, setTab] = useState('gol')
  const lists = useMemo(() => ({
    gol: [...stats].sort((a, b) => Number(b.gol) - Number(a.gol)),
    assist: [...stats].sort((a, b) => Number(b.assist) - Number(a.assist)),
    media: [...stats].filter(s => Number(s.valutazioni) > 0).sort((a, b) => Number(b.media_voto) - Number(a.media_voto)),
    presenze: [...stats].sort((a, b) => Number(b.presenze) - Number(a.presenze)),
    mvp: [...stats].sort((a, b) => Number(b.mvp) - Number(a.mvp))
  }), [stats])
  const labels = { gol: 'Marcatori', assist: 'Assist', media: 'Media voto', presenze: 'Presenze', mvp: 'MVP' }
  const value = s => tab === 'gol' ? s.gol : tab === 'assist' ? s.assist : tab === 'media' ? fmt1(s.media_voto) : tab === 'presenze' ? s.presenze : s.mvp
  const valueLabels = { gol: 'GOL', assist: 'ASSIST', media: 'MEDIA', presenze: 'PRESENZE', mvp: 'MVP' }
  const rankedEntries = lists[tab].filter(s => playersById[s.player_id])
  const podium = rankedEntries.slice(0, 3)
  const remaining = rankedEntries.slice(3)
  return <div className="leaderboard-page">
    <h1>Classifiche</h1>
    <div className="tabs scroll-tabs">{Object.entries(labels).map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>)}</div>
    <Section title={`Podio ${labels[tab]}`}>
      {podium.length ? <div key={tab} className="ranking-podium" role="list" aria-label={`Podio ${labels[tab]}`}>
        {[podium[1], podium[0], podium[2]].filter(Boolean).map(s => {
          const rank = rankedEntries.indexOf(s) + 1
          const player = playersById[s.player_id]
          return <Link key={`${tab}-${s.player_id}`} to={`/giocatori/${player.id}`} className={`ranking-podium-place ranking-podium-place-${rank}`} role="listitem">
            <span className="ranking-podium-rank">{rank === 1 ? '1°' : rank === 2 ? '2°' : '3°'}</span>
            <span className={`ranking-podium-avatar${rank === 1 ? ' has-crown' : ''}`}>
              {rank === 1 && <span className="ranking-crown"><img src="/crown-gold.png" alt="" draggable="false" /></span>}
              <Avatar player={player} size={rank === 1 ? 62 : 52} />
            </span>
            <strong className="ranking-podium-name">{fullName(player)}</strong>
            <span className="ranking-podium-result"><strong>{value(s)}</strong><small>{valueLabels[tab]}</small></span>
            <span className="ranking-podium-step" aria-hidden="true"><span>{rank}</span>{rank === rankedEntries.length && <span className="ranking-podium-trash"><TrashIcon /></span>}</span>
          </Link>
        })}
      </div> : <EmptyState>Nessun dato disponibile per questa classifica.</EmptyState>}
    </Section>
    {remaining.length > 0 && <Section title="Classifica">
      <div className="card leaderboard">{remaining.map((s, i) => <PlayerRow key={`${tab}-${s.player_id}`} player={playersById[s.player_id]} right={<><span className="rank">{i + 4}</span><strong className="leaderboard-value">{value(s)}</strong>{i === remaining.length - 1 && <span className="ranking-last-place-trash" role="img" title="Ultimo posto" aria-label="Ultimo posto"><TrashIcon /></span>}</>} />)}</div>
    </Section>}
  </div>
}
