import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('pwa-update-available'))
  },
  onRegisteredSW(_serviceWorkerUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {})
      }
    }

    window.setInterval(checkForUpdate, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', checkForUpdate)
  }
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App updateServiceWorker={updateServiceWorker} />
  </React.StrictMode>
)
