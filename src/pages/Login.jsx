import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [message, setMessage] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(''); setMessage('')
    try {
      if (mode === 'login') {
        const { error } = await signIn(email.trim(), password)
        if (error) throw error
      } else {
        const { data, error } = await signUp(email.trim(), password, firstName.trim(), lastName.trim())
        if (error) throw error
        if (!data.session) setMessage('Account creato. Controlla la tua email se Supabase richiede la conferma.')
        else setMessage('Account creato. L’amministratore dovrà approvarlo.')
      }
    } catch (e) {
      setErr(e.message || 'Operazione non riuscita')
    } finally { setBusy(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">⚽</div>
        <h1>Calcetto Club</h1>
        <p className="muted">Partite, marcatori, voti e statistiche del tuo gruppo.</p>

        <div className="tabs login-tabs">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); setMessage('') }}>Accedi</button>
          <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); setMessage('') }}>Crea account</button>
        </div>

        <form onSubmit={submit} className="card stack flat-card">
          {mode === 'signup' && <>
            <div className="two-col">
              <label>Nome<input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required /></label>
              <label>Cognome<input className="input" value={lastName} onChange={e => setLastName(e.target.value)} /></label>
            </div>
          </>}
          <label>Email<input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {err && <p className="error">{err}</p>}
          {message && <p className="success">{message}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Attendi…' : mode === 'login' ? 'Entra' : 'Registrati'}</button>
        </form>
        <p className="tiny muted">Gli account nuovi restano in attesa finché l’amministratore non li approva.</p>
      </div>
    </div>
  )
}