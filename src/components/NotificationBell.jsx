import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TYPE_ICON = {
  match_created: '⚽',
  result_entered: '📊',
  voting_open: '🗳️'
}

export default function NotificationBell({ userId }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const pushSupported = typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  const refresh = useCallback(async () => {
    if (!userId) return
    const { data, error: queryError } = await supabase
      .from('notifications')
      .select('id, match_id, type, title, body, created_at, read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25)

    if (queryError) {
      setError(queryError.message)
      return
    }
    setError('')
    setItems(data || [])
  }, [userId])

  useEffect(() => {
    refresh()
    if (!userId) return undefined

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`
      }, refresh)
      .subscribe()

    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [refresh, userId])

  useEffect(() => {
    let active = true
    if (!pushSupported) return undefined
    navigator.serviceWorker.ready
      .then(registration => registration.pushManager.getSubscription())
      .then(subscription => { if (active) setPushEnabled(Boolean(subscription)) })
      .catch(() => {})
    return () => { active = false }
  }, [pushSupported])

  const unread = items.filter(item => !item.read_at).length

  async function markRead(ids) {
    if (!ids.length) return
    const readAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .in('id', ids)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setItems(current => current.map(item => ids.includes(item.id) ? { ...item, read_at: readAt } : item))
  }

  async function openNotification(item) {
    await markRead([item.id])
    setOpen(false)
    if (item.type === 'voting_open' && item.match_id) navigate(`/votazioni?match=${item.match_id}`)
    else if (item.match_id) navigate(`/partite/${item.match_id}`)
  }

  function decodeVapidKey(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4)
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(base64), character => character.charCodeAt(0))
  }

  async function togglePush() {
    if (!pushSupported) {
      setPushMessage('Questo browser non supporta le notifiche push. Su iPhone aggiungi prima Calcetto Club alla schermata Home.')
      return
    }
    if (!vapidPublicKey) {
      setPushMessage('Manca VITE_VAPID_PUBLIC_KEY nelle variabili Vercel. Dopo averla aggiunta, ricompila e ridistribuisci l’app.')
      return
    }

    setPushBusy(true)
    setPushMessage('')
    try {
      if (!pushEnabled) {
        let permission = Notification.permission
        if (permission === 'default') permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          throw new Error('Permesso notifiche non concesso. Puoi abilitarlo dalle impostazioni del browser.')
        }
      }
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      if (current) {
        await current.unsubscribe()
        const { error: removeError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', current.endpoint)
        if (removeError) throw removeError
        setPushEnabled(false)
        setPushMessage('Notifiche push disattivate su questo dispositivo.')
      } else {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(vapidPublicKey)
        })
        const { error: saveError } = await supabase
          .from('push_subscriptions')
          .upsert({
            endpoint: subscription.endpoint,
            user_id: userId,
            subscription: subscription.toJSON(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'endpoint' })
        if (saveError) {
          await subscription.unsubscribe()
          throw saveError
        }
        setPushEnabled(true)
        setPushMessage('Notifiche attive su questo dispositivo.')
      }
    } catch (pushError) {
      setPushMessage(pushError.message || 'Non è stato possibile configurare le notifiche push.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className="notification-bell"
        aria-label={unread ? `Notifiche, ${unread} non lette` : 'Notifiche'}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <section className="notification-panel" aria-label="Le tue notifiche">
          <header className="notification-panel-head">
            <div><strong>Notifiche</strong><small>{unread ? `${unread} da leggere` : 'Sei aggiornato'}</small></div>
            {unread > 0 && <button type="button" className="notification-read-all" onClick={() => markRead(items.filter(item => !item.read_at).map(item => item.id))}>Segna lette</button>}
          </header>
          <div className="push-settings">
            <div><strong>Avvisi sul dispositivo</strong><small>{pushEnabled ? 'Attivi su questo dispositivo' : 'Ricevi gli avvisi anche con l’app chiusa'}</small></div>
            <button type="button" className={`btn small ${pushEnabled ? '' : 'primary'}`} onClick={togglePush} disabled={pushBusy}>
              {pushBusy ? 'Attendi…' : pushEnabled ? 'Disattiva' : 'Attiva'}
            </button>
            {pushMessage && <p role="status">{pushMessage}</p>}
          </div>
          {error ? <p className="notification-empty">Attiva le notifiche eseguendo il file <code>supabase/notifications.sql</code> nel SQL Editor di Supabase.</p> : items.length === 0 ? <p className="notification-empty">Qui vedrai gli aggiornamenti sulle partite e sulle votazioni.</p> : (
            <div className="notification-list">
              {items.map(item => (
                <button key={item.id} type="button" className={`notification-item ${item.read_at ? '' : 'is-unread'}`} onClick={() => openNotification(item)}>
                  <span className="notification-item-icon" aria-hidden="true">{TYPE_ICON[item.type] || '🔔'}</span>
                  <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.created_at))}</small></span>
                  {!item.read_at && <i aria-label="Non letta" />}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
