import { useMemo, useState } from 'react'
import { useData } from '../lib/data'
import { PlayerRow, Section } from '../components/ui'
import { fmt1 } from '../lib/util'

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
  return <>
    <h1>Classifiche</h1>
    <div className="tabs scroll-tabs">{Object.entries(labels).map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>)}</div>
    <Section title={labels[tab]}>
      <div className="card leaderboard">{lists[tab].map((s, i) => playersById[s.player_id] && <PlayerRow key={s.player_id} player={playersById[s.player_id]} right={<><span className="rank">{i + 1}</span><strong>{value(s)}</strong></>} />)}</div>
    </Section>
  </>
}