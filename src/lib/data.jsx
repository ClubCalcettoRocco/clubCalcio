import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { Spinner } from '../components/ui'

const DataCtx = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState({
    players: [],
    stats: [],
    matches: [],
    loading: true,
    error: null
  })

  const reload = useCallback(async () => {
    const [p, s, m] = await Promise.all([
      supabase
        .from('players')
        .select('*')
        .order('first_name'),

      supabase
        .from('player_stats')
        .select('*')
        .order('gol', { ascending: false }),

      supabase
        .from('matches')
        .select('*, match_players(*), goals(*)')
        .order('kickoff', { ascending: false })
    ])

    const err = p.error || s.error || m.error

    setState({
      players: p.data || [],
      stats: s.data || [],
      matches: m.data || [],
      loading: false,
      error: err?.message || null
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const playersById = useMemo(
    () => Object.fromEntries(
      state.players.map((p) => [p.id, p])
    ),
    [state.players]
  )

  const statsById = useMemo(
    () => Object.fromEntries(
      state.stats.map((s) => [s.player_id, s])
    ),
    [state.stats]
  )

  if (state.loading) {
    return <Spinner label="Caricamento dati…" />
  }

  if (state.error) {
    return (
      <div className="center">
        <p className="error">
          Errore nel caricamento: {state.error}
        </p>
      </div>
    )
  }

  return (
    <DataCtx.Provider
      value={{
        ...state,
        playersById,
        statsById,
        reload
      }}
    >
      {children}
    </DataCtx.Provider>
  )
}

export const useData = () => useContext(DataCtx)

