import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
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
  const requestRef = useRef({ admin: null, promise: null })
  const requestIdRef = useRef(0)

  const reload = useCallback(async () => {
    if (requestRef.current.promise && requestRef.current.admin === isAdmin) {
      return requestRef.current.promise
    }

    const requestId = ++requestIdRef.current
    const promise = (async () => {
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

        if (requestId !== requestIdRef.current) return

        const err = p.error || s.error || m.error
        setState({
          players: p.data || [],
          stats: s.data || [],
          matches: m.data || [],
          loading: false,
          error: err ? explainError(err, 'Non è stato possibile caricare i dati.') : null
        })
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setState(current => ({
          ...current,
          loading: false,
          error: explainError(err, 'Non è stato possibile caricare i dati.')
        }))
      }
    })()

    requestRef.current = { admin: isAdmin, promise }
    try {
      return await promise
    } finally {
      if (requestRef.current.promise === promise) {
        requestRef.current = { admin: null, promise: null }
      }
    }
  }, [isAdmin])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    let timer
    const queueReload = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const pending = requestRef.current.promise
        if (pending) {
          pending.then(reload, reload)
          return
        }
        reload()
      }, 180)
    }

    const channel = supabase
      .channel('club-matches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, queueReload)
      .subscribe()

    return () => {
      window.clearTimeout(timer)
      supabase.removeChannel(channel)
    }
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

  const value = useMemo(() => ({
    ...state,
    playersById,
    statsById,
    reload
  }), [state, playersById, statsById, reload])

  return (
    <DataCtx.Provider value={value}>
      {children}
    </DataCtx.Provider>
  )
}

export function useData() {
  return useContext(DataCtx)
}

