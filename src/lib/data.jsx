import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { ActionError, Spinner } from '../components/ui'
import { useAuth } from './auth'
import { explainError } from './errorMessage'

const DataCtx = createContext(null)

export function DataProvider({ children }) {
  const { isAdmin } = useAuth()
  const [state, setState] = useState({
    players: [],
    stats: [],
    matches: [],
    loading: true,
    error: null
  })

  const reload = useCallback(async () => {
    try {
      const playersQuery = isAdmin
        ? supabase.rpc('admin_list_players')
        : supabase
          .from('players')
          .select('id,first_name,last_name,photo_url,role_label,approved,position,preferred_foot,play_style,height_cm,weight_kg,card_style')
          .order('first_name')

      const [p, s, m] = await Promise.all([
        playersQuery,
        supabase.from('player_stats').select('*').order('gol', { ascending: false }),
        supabase.from('matches').select('*, match_players(*), goals(*)').order('kickoff', { ascending: false })
      ])

      const err = p.error || s.error || m.error
      setState({
        players: p.data || [],
        stats: s.data || [],
        matches: m.data || [],
        loading: false,
        error: err ? explainError(err, 'Non è stato possibile caricare i dati.') : null
      })
    } catch (err) {
      setState(current => ({
        ...current,
        loading: false,
        error: explainError(err, 'Non è stato possibile caricare i dati.')
      }))
    }
  }, [isAdmin])

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
      <div className="center page-pad">
        <div className="card data-error-card">
          <h2>Non riesco a caricare il club</h2>
          <ActionError message={state.error} onRetry={reload} />
        </div>
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

