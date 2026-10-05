import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)

  const [sessionLoading, setSessionLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  const loading = sessionLoading || profileLoading

  useEffect(() => {
    let alive = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()

      if (!alive) return

      setSession(data.session)
      setSessionLoading(false)
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return
      setSession(newSession)
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let alive = true

    async function loadProfile() {
      if (!session?.user?.id) {
        setMe(null)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!alive) return

      setMe(error ? null : data)
      setProfileLoading(false)
    }

    loadProfile()

    return () => {
      alive = false
    }
  }, [session?.user?.id])

  const value = {
    session,
    me,
    loading,

    isAdmin: me?.app_role === 'ADMIN',
    isApproved: Boolean(me?.approved),

    signIn: (email, password) =>
      supabase.auth.signInWithPassword({
        email,
        password
      }),

    signUp: (email, password, first_name, last_name) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name,
            last_name
          }
        }
      }),

    signOut: () => supabase.auth.signOut(),

    refreshMe: async () => {
      if (!session?.user?.id) return null

      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      setMe(data || null)

      return data
    }
  }

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)