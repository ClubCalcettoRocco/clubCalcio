import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AvatarUpload({
  currentUrl,
  onUploaded,
  size = 96
}) {
  const inputRef = useRef(null)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(currentUrl || '')

  async function handleChange(e) {
    const file = e.target.files && e.target.files[0]

    // Permette di selezionare nuovamente lo stesso file
    e.target.value = ''

    if (!file) return

    setError('')

    // Controllo formato
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine.')
      return
    }

    // Controllo dimensione: massimo 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setError('La foto deve essere più piccola di 5 MB.')
      return
    }

    // Anteprima locale immediata
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setUploading(true)

    try {
      // Recupera l'utente attualmente autenticato
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(
          'Devi essere autenticato per caricare una foto.'
        )
      }

      // Estensione del file
      const extension =
        (file.name.split('.').pop() || 'jpg')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'jpg'

      /*
       * Struttura:
       *
       * avatars/
       *   USER_ID/
       *     UUID.jpg
       *
       * USER_ID è auth.uid(), quindi coincide con
       * quello controllato dalle Storage Policies.
       */
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`

      // Upload su Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (uploadError) {
        throw uploadError
      }

      // Recupera URL pubblico
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      if (!data?.publicUrl) {
        throw new Error(
          "Impossibile ottenere l'indirizzo della foto."
        )
      }

      // Comunica al componente padre il nuovo URL
      onUploaded(data.publicUrl)

    } catch (err) {
      console.error('Errore upload avatar:', err)

      // Torna alla foto precedente
      setPreview(currentUrl || '')

      setError(
        err?.message ||
        'Errore durante il caricamento della foto.'
      )
    } finally {
      URL.revokeObjectURL(localPreview)
      setUploading(false)
    }
  }

  return (
    <div className="photo-upload">
      <div className="photo-upload-row">

        {/* Anteprima */}
        {preview ? (
          <img
            className="avatar"
            style={{
              width: size,
              height: size,
              objectFit: 'cover'
            }}
            src={preview}
            alt="Anteprima foto profilo"
          />
        ) : (
          <div
            className="avatar"
            style={{
              width: size,
              height: size,
              fontSize: size * 0.34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            📷
          </div>
        )}

        <div className="stack photo-upload-actions">

          {/* Input nascosto */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleChange}
            hidden
          />

          {/* Pulsante */}
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.click()
              }
            }}
            disabled={uploading}
          >
            {uploading
              ? 'Caricamento…'
              : '📷 Scegli foto'}
          </button>

          <span className="muted small-text">
            JPG, PNG, WEBP · massimo 5 MB
          </span>

        </div>
      </div>

      {/* Errore */}
      {error && (
        <p className="error">
          {error}
        </p>
      )}
    </div>
  )
}