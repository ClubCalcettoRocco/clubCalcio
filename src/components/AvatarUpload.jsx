import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { removeImageBackground } from '../lib/removeImageBackground'

export default function AvatarUpload({
  currentUrl,
  onUploaded,
  size = 96
}) {
  const inputRef = useRef(null)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(currentUrl || '')
  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState('')

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
    let processedPreview = ''
    setPreview(localPreview)
    setUploading(true)

    try {
      setProcessing(true)
      setProcessingProgress('Carico il modello di rimozione sfondo…')
      const processedFile = await removeImageBackground(file, ({ current, total }) => {
        if (total > 0) {
          setProcessingProgress(`Preparo il modello… ${Math.round((current / total) * 100)}%`)
        }
      })
      processedPreview = URL.createObjectURL(processedFile)
      setPreview(processedPreview)
      setProcessing(false)
      setProcessingProgress('Carico la foto…')

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

      /*
       * Struttura:
       *
       * avatars/
       *   USER_ID/
       *     UUID.png
       *
       * USER_ID è auth.uid(), quindi coincide con
       * quello controllato dalle Storage Policies.
       */
      const path = `${user.id}/${processedFile.name}`

      // Upload su Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, processedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: processedFile.type
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
      setPreview(data.publicUrl)
      if (processedPreview) URL.revokeObjectURL(processedPreview)
      onUploaded(data.publicUrl)

    } catch (err) {
      console.error('Errore upload avatar:', err)

      // Torna alla foto precedente
      setPreview(currentUrl || '')
      if (processedPreview) URL.revokeObjectURL(processedPreview)

      setError(
        err?.message ||
        'Errore durante il caricamento della foto.'
      )
    } finally {
      URL.revokeObjectURL(localPreview)
      setProcessing(false)
      setProcessingProgress('')
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
              ? processing
                ? 'Rimozione sfondo…'
                : 'Caricamento…'
              : '📷 Scegli foto'}
          </button>

          <span className="muted small-text">
            JPG, PNG, WEBP · massimo 5 MB · sfondo rimosso automaticamente
          </span>

          {processingProgress && (
            <span className="muted small-text" role="status">
              {processingProgress}
            </span>
          )}

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
