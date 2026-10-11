import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(body)
}

function authorized(req, expected) {
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
  const actualBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Metodo non consentito.' })
  }

  const webhookSecret = process.env.PUSH_WEBHOOK_SECRET
  if (!webhookSecret) return json(res, 503, { error: 'Webhook push non configurato.' })
  if (!authorized(req, webhookSecret)) return json(res, 401, { error: 'Non autorizzato.' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json(res, 503, { error: 'Configurazione push server incompleta.' })
  }

  const payload = req.body || {}
  const notification = payload.record || payload
  if (payload.type && payload.type !== 'INSERT') return json(res, 200, { skipped: true })
  if (!notification.user_id || !notification.title || !notification.body) {
    return json(res, 400, { error: 'Notifica non valida.' })
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  try {
    const { data: devices, error } = await client
      .from('push_subscriptions')
      .select('endpoint, subscription')
      .eq('user_id', notification.user_id)
    if (error) throw error
    if (!devices?.length) return json(res, 200, { sent: 0 })

    const url = notification.type === 'voting_open' && notification.match_id
      ? `/votazioni?match=${encodeURIComponent(notification.match_id)}`
      : notification.match_id
        ? `/partite/${encodeURIComponent(notification.match_id)}`
        : '/'
    const message = JSON.stringify({
      title: String(notification.title).slice(0, 100),
      body: String(notification.body).slice(0, 240),
      url,
      tag: `calcetto-${notification.id || notification.type}`
    })

    const results = await Promise.allSettled(devices.map(async device => {
      try {
        await webpush.sendNotification(device.subscription, message, {
          TTL: 60 * 60 * 24,
          urgency: 'normal',
          vapidDetails: {
            subject: vapidSubject,
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey
          }
        })
        return true
      } catch (sendError) {
        if (sendError.statusCode === 404 || sendError.statusCode === 410) {
          await client.from('push_subscriptions').delete().eq('endpoint', device.endpoint)
        }
        throw sendError
      }
    }))

    const sent = results.filter(result => result.status === 'fulfilled').length
    return json(res, 200, { sent, failed: results.length - sent })
  } catch (error) {
    console.error('Push notification delivery failed:', error.message || 'Unknown error')
    return json(res, 500, { error: 'Invio della notifica push non riuscito.' })
  }
}
