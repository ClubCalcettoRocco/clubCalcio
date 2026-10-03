import { useState } from 'react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui'
import { fullName } from '../lib/util'
import AvatarUpload from '../components/AvatarUpload'

export default function AdminPlayers() {
  const { players, reload } = useData()
  const { me } = useAuth()

  const [open, setOpen] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

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