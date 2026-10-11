import { useState } from 'react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import { fullName } from '../lib/util'
import AvatarUpload from '../components/AvatarUpload'
import {
  removeBackgroundFromProfiles,
  restoreOriginalProfilePhotos
} from '../lib/avatarBackgroundBatch'

export default function AdminPlayers() {
  const { players, reload } = useData()
  const { me } = useAuth()

  const [open, setOpen] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [backgroundJob, setBackgroundJob] = useState(null)
  const [backgroundMessage, setBackgroundMessage] = useState('')
  const [backgroundErrors, setBackgroundErrors] = useState([])
  const [backgroundError, setBackgroundError] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    role_label: '',
    photo_url: '',
    app_role: 'PLAYER',
    approved: false
  })

  const editingPlayer = players.find(
    p => p.id === open
  )

  const approvedPlayers = players.filter(
    p => p.approved === true
  )

  const pendingPlayers = players.filter(
    p => p.approved === false
  )

  const photosToProcess = players.filter(
    p => p.photo_url && !p.photo_url_original
  ).length
  const photosToRestore = players.filter(
    p => p.photo_url_original
  ).length

  function start(p) {
    setOpen(p.id)
    setErr('')

    setForm({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      role_label: p.role_label || '',
      photo_url: p.photo_url || '',
      app_role: p.app_role || 'PLAYER',
      approved: p.approved === true
    })
  }

  async function save() {
    setSaving(true)
    setErr('')

    const { error } = await supabase
      .from('players')
      .update(form)
      .eq('id', open)

    if (error) {
      setErr(error.message)
    } else {
      await reload()
      setOpen(null)
    }

    setSaving(false)
  }

  async function approve(p) {
    setErr('')

    const { error } = await supabase
      .from('players')
      .update({ approved: true })
      .eq('id', p.id)

    if (error) {
      setErr(error.message)
      return
    }

    await reload()
  }

  async function processAllPhotoBackgrounds() {
    setBackgroundError('')
    setBackgroundMessage('')
    setBackgroundErrors([])

    if (!photosToProcess) {
      setBackgroundMessage('Non ci sono foto da elaborare.')
      return
    }

    const { error: schemaError } = await supabase
      .from('players')
      .select('photo_url_original')
      .limit(1)

    if (schemaError) {
      setBackgroundError('Prima esegui supabase/avatar-background-history.sql nel SQL Editor di Supabase, poi ricarica questa pagina.')
      return
    }

    if (!window.confirm(`Rimuovere lo sfondo da ${photosToProcess} foto? Gli originali resteranno salvati e potrai ripristinarli da qui.`)) return

    setBackgroundJob({ action: 'remove', done: 0, total: photosToProcess })
    try {
      const result = await removeBackgroundFromProfiles(players, me?.user_id, progress => {
        setBackgroundJob(current => ({ ...current, ...progress }))
      })
      await reload()
      setBackgroundErrors(result.errors)
      setBackgroundMessage(`${result.success} foto aggiornate${result.errors.length ? `, ${result.errors.length} non riuscite` : ''}.`)
    } catch (error) {
      setBackgroundError(error?.message || 'Errore durante l’elaborazione delle foto.')
    } finally {
      setBackgroundJob(null)
    }
  }

  async function restoreAllPhotoBackgrounds() {
    setBackgroundError('')
    setBackgroundMessage('')
    setBackgroundErrors([])

    if (!photosToRestore) return
    if (!window.confirm(`Ripristinare le foto originali di ${photosToRestore} profili?`)) return

    setBackgroundJob({ action: 'restore', done: 0, total: photosToRestore })
    try {
      const result = await restoreOriginalProfilePhotos(players, progress => {
        setBackgroundJob(current => ({ ...current, ...progress }))
      })
      await reload()
      setBackgroundErrors(result.errors)
      setBackgroundMessage(`${result.success} foto originali ripristinate${result.errors.length ? `, ${result.errors.length} non riuscite` : ''}.`)
    } catch (error) {
      setBackgroundError(error?.message || 'Errore durante il ripristino delle foto.')
    } finally {
      setBackgroundJob(null)
    }
  }

  async function reject(p) {
    const confirmed = window.confirm(
      `Vuoi rifiutare ed eliminare definitivamente l'account di ${fullName(p)}?`
    )

    if (!confirmed) return

    setErr('')

    const { error } = await supabase.functions.invoke(
      'delete-user',
      {
        body: {
          playerId: p.id
        }
      }
    )

    if (error) {
      let message = error.message

      if (error.context) {
        try {
          const body = await error.context.json()

          if (body?.error) {
            message = body.error
          } else if (body?.message) {
            message = body.message
          } else {
            message = JSON.stringify(body)
          }
        } catch {
          // Manteniamo il messaggio originale
        }
      }

      setErr(message)
      return
    }

    await reload()
  }

  return (
    <>
      <h1>Amministrazione</h1>

      <div className="notice">
        <b>Account:</b> i nuovi utenti possono registrarsi
        dalla schermata di accesso. Gli account in attesa
        devono essere approvati prima di comparire tra
        i giocatori.
      </div>

      <section className="card avatar-background-tool">
        <div>
          <span className="eyebrow">FOTO PROFILO</span>
          <h2>Sfondo trasparente</h2>
          <p className="muted">
            Elabora le foto già caricate. Le immagini originali restano salvate; il ritaglio viene eseguito nel browser.
          </p>
        </div>

        <div className="avatar-background-actions">
          <button
            className="btn primary"
            type="button"
            onClick={processAllPhotoBackgrounds}
            disabled={Boolean(backgroundJob) || photosToProcess === 0}
          >
            {backgroundJob?.action === 'remove'
              ? 'Elaborazione…'
              : `Rimuovi sfondo (${photosToProcess})`}
          </button>
          {photosToRestore > 0 && (
            <button
              className="btn"
              type="button"
              onClick={restoreAllPhotoBackgrounds}
              disabled={Boolean(backgroundJob)}
            >
              {backgroundJob?.action === 'restore'
                ? 'Ripristino…'
                : `Ripristina originali (${photosToRestore})`}
            </button>
          )}
        </div>

        {backgroundJob && (
          <div className="avatar-background-progress" role="status">
            <span className="muted">
              {backgroundJob.action === 'remove' ? 'Rimozione sfondo' : 'Ripristino originali'}
              {' · '}{backgroundJob.done}/{backgroundJob.total}
              {backgroundJob.name ? ` · ${backgroundJob.name}` : ''}
            </span>
            {backgroundJob.modelProgress?.total > 0 && (
              <span className="muted small-text">
                Download modello {Math.round((backgroundJob.modelProgress.current / backgroundJob.modelProgress.total) * 100)}%
              </span>
            )}
            <progress value={backgroundJob.done} max={backgroundJob.total || 1} />
          </div>
        )}
        {backgroundError && <p className="error">{backgroundError}</p>}
        {backgroundMessage && <p className="success">{backgroundMessage}</p>}
        {backgroundErrors.length > 0 && (
          <ul className="avatar-background-errors">
            {backgroundErrors.slice(0, 5).map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {item.name}: {item.message}
              </li>
            ))}
            {backgroundErrors.length > 5 && (
              <li>Altri {backgroundErrors.length - 5} errori.</li>
            )}
          </ul>
        )}
      </section>

      {err && (
        <p className="error">
          {err}
        </p>
      )}

      {/* ========================= */}
      {/* ACCOUNT IN ATTESA */}
      {/* ========================= */}

      {pendingPlayers.length > 0 && (
        <div className="card">

          <div className="section-head">
            <h2>Account in attesa</h2>

            <span className="muted">
              {pendingPlayers.length} da approvare
            </span>
          </div>

          <div className="pending-list">

            {pendingPlayers.map(p => (
              <div
                key={p.id}
                className="admin-player"
              >

                <Avatar
                  player={p}
                  size={44}
                />

                <div className="grow">
                  <b>{fullName(p)}</b>

                  <span className="muted">
                    {p.email || '—'}
                  </span>
                </div>

                <span className="status pending">
                  In attesa
                </span>

                <button
                  className="btn small primary"
                  onClick={() => approve(p)}
                >
                  Approva
                </button>

                <button
                  className="btn small"
                  onClick={() => reject(p)}
                >
                  Rifiuta
                </button>

              </div>
            ))}

          </div>
        </div>
      )}

      {/* ========================= */}
      {/* GIOCATORI APPROVATI */}
      {/* ========================= */}

      <div
        style={{
          marginTop:
            pendingPlayers.length > 0
              ? '40px'
              : '0'
        }}
      >
        <div className="card">

          <div className="section-head">
            <h2>Giocatori</h2>

            <span className="muted">
              {approvedPlayers.length} giocatori
            </span>
          </div>

          {approvedPlayers.length === 0 ? (
            <p className="muted">
              Nessun giocatore approvato.
            </p>
          ) : (
            approvedPlayers.map(p => (
              <div
                key={p.id}
                className="admin-player"
              >

                <Avatar
                  player={p}
                  size={44}
                />

                <div className="grow">

                  <b>{fullName(p)}</b>

                  <span className="muted">
                    {p.email || '—'} · {p.app_role}
                  </span>

                </div>

                <span className="status ok">
                  Attivo
                </span>

                <button
                  className="btn small"
                  onClick={() => start(p)}
                >
                  Modifica
                </button>

                <button
                  className="btn small"
                  onClick={() => approve(p)}
                >
                  Attivo
                </button>

              </div>
            ))
          )}

        </div>
      </div>

      {/* ========================= */}
      {/* MODALE MODIFICA */}
      {/* ========================= */}

      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={e =>
            e.target === e.currentTarget &&
            setOpen(null)
          }
        >
          <div className="modal card">

            <div className="section-head">

              <h2>
                Modifica giocatore
              </h2>

              <button
                className="icon-btn"
                onClick={() => setOpen(null)}
              >
                ×
              </button>

            </div>

            <div className="stack">

              <div className="two-col">

                <label>
                  Nome

                  <input
                    className="input"
                    value={form.first_name}
                    onChange={e =>
                      setForm({
                        ...form,
                        first_name:
                          e.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Cognome

                  <input
                    className="input"
                    value={form.last_name}
                    onChange={e =>
                      setForm({
                        ...form,
                        last_name:
                          e.target.value
                      })
                    }
                  />
                </label>

              </div>

              <label>
                Ruolo

                <input
                  className="input"
                  value={form.role_label}
                  onChange={e =>
                    setForm({
                      ...form,
                      role_label:
                        e.target.value
                    })
                  }
                />
              </label>

              <AvatarUpload
                userId={
                  editingPlayer?.user_id ||
                  me.user_id
                }
                currentUrl={form.photo_url}
                onUploaded={url =>
                  setForm({
                    ...form,
                    photo_url: url
                  })
                }
                size={80}
              />

              <div className="two-col">

                <label>
                  Ruolo app

                  <select
                    className="input"
                    value={form.app_role}
                    onChange={e =>
                      setForm({
                        ...form,
                        app_role:
                          e.target.value
                      })
                    }
                  >
                    <option value="PLAYER">
                      PLAYER
                    </option>

                    <option value="ADMIN">
                      ADMIN
                    </option>
                  </select>
                </label>

                <label className="check">

                  <input
                    type="checkbox"
                    checked={form.approved}
                    onChange={e =>
                      setForm({
                        ...form,
                        approved:
                          e.target.checked
                      })
                    }
                  />

                  Account approvato

                </label>

              </div>

              {err && (
                <p className="error">
                  {err}
                </p>
              )}

              <button
                className="btn primary block"
                onClick={save}
                disabled={saving}
              >
                {saving
                  ? 'Salvataggio…'
                  : 'Salva'}
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  )
}
