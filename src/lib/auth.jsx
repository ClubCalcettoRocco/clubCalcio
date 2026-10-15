import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { explainError } from './errorMessage'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [profileError, setProfileError] = useState('')

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
        setProfileError('')
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      setProfileError('')
      try {
        const { data, error } = await supabase.rpc('get_my_profile')
        if (!alive) return
        if (error) {
          setProfileError(explainError(error, 'Non è stato possibile caricare il profilo.'))
          setMe(null)
        } else {
          setMe(data ? {
            ...data,
            user_id: session.user.id,
            email: session.user.email || ''
          } : null)
        }
      } catch (error) {
        if (!alive) return
        setProfileError(explainError(error, 'Non è stato possibile caricare il profilo.'))
        setMe(null)
      } finally {
        if (alive) setProfileLoading(false)
      }
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
    profileError,

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

      setProfileError('')
      try {
        const { data, error } = await supabase.rpc('get_my_profile')
        if (error) throw error
        const next = data ? { ...data, user_id: session.user.id, email: session.user.email || '' } : null
        setMe(next)
        return next
      } catch (error) {
        setProfileError(explainError(error, 'Non è stato possibile caricare il profilo.'))
        return null
      }
    }
  }

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
