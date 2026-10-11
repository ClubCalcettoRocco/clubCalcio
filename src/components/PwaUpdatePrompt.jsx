import { useEffect, useState } from 'react'

export default function PwaUpdatePrompt({ updateServiceWorker }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const showUpdate = () => setAvailable(true)
    window.addEventListener('pwa-update-available', showUpdate)
    return () => window.removeEventListener('pwa-update-available', showUpdate)
  }, [])

  if (!available) return null

  return (
    <aside className="pwa-update-prompt" role="status" aria-live="polite">
      <div className="pwa-update-copy">
        <strong>Nuova versione disponibile</strong>
        <span>Aggiorna quando hai finito quello che stai facendo.</span>
      </div>
      <button
        className="btn primary small"
        type="button"
        onClick={() => updateServiceWorker(true)}
      >
        Aggiorna
      </button>
      <button
        className="icon-btn pwa-update-dismiss"
        type="button"
        aria-label="Aggiorna più tardi"
        onClick={() => setAvailable(false)}
      >
        ×
      </button>
    </aside>
  )
}
