import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
    }).finally(() => alive && setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setMe(null)
      return
    }
    let alive = true
    setLoading(true)
    supabase.from('players').select('*').eq('user_id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        setMe(error ? null : data)
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [session?.user?.id])

  const value = {
    session,
    me,
    loading,
    isAdmin: me?.app_role === 'ADMIN',
    isApproved: Boolean(me?.approved),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, first_name, last_name) => supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name, last_name } }
    }),
    signOut: () => supabase.auth.signOut(),
    refreshMe: async () => {
      if (!session?.user?.id) return null
      const { data } = await supabase.from('players').select('*').eq('user_id', session.user.id).maybeSingle()
      setMe(data || null)
      return data
    }
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)