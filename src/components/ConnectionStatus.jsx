import { useEffect, useState } from 'react'

export default function ConnectionStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    let timer
    const handleOffline = () => {
      clearTimeout(timer)
      setRestored(false)
      setOnline(false)
    }
    const handleOnline = () => {
      setOnline(true)
      setRestored(true)
      clearTimeout(timer)
      timer = window.setTimeout(() => setRestored(false), 4500)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (online && !restored) return null

  return (
    <div className={`connection-notice ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">
      <span className="connection-indicator" aria-hidden="true" />
      <span>{online ? 'Connessione ripristinata.' : 'Sei offline. Le modifiche non sono state inviate: i dati inseriti restano nella schermata. Riprova quando torni online.'}</span>
    </div>
  )
}
