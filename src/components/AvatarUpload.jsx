import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AvatarUpload({ userId, currentUrl, onUploaded, size = 96 }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(currentUrl || '')

  async function handleChange(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''

    if (!file) return

    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La foto deve essere più piccola di 5 MB.')
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setUploading(true)

    try {
      const extension =
        (file.name.split('.').pop() || 'jpg')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'jpg'

      const path = `${userId}/${crypto.randomUUID()}.${extension}`

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

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      if (!data || !data.publicUrl) {
        throw new Error('Impossibile ottenere l\'indirizzo della foto.')
      }

      onUploaded(data.publicUrl)

    } catch (err) {
      setPreview(currentUrl || '')
      setError(err.message || 'Errore durante il caricamento della foto.')
    } finally {
      URL.revokeObjectURL(localPreview)
      setUploading(false)
    }
  }

  return (
    <div className="photo-upload">
      <div className="photo-upload-row">

        {preview ? (
          <img
            className="avatar"
            style={{ width: size, height: size }}
            src={preview}
            alt="Anteprima foto profilo"
          />
        ) : (
          <div
            className="avatar"
            style={{
              width: size,
              height: size,
              fontSize: size * 0.34
            }}
          >
            📷
          </div>
        )}

        <div className="stack photo-upload-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            hidden
          />

          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current && inputRef.current.click()}
            disabled={uploading}
          >
            {uploading ? 'Caricamento…' : '📷 Scegli foto'}
          </button>

          <span className="muted small-text">
            JPG, PNG, WEBP · massimo 5 MB
          </span>
        </div>

      </div>

      {error && <p className="error">{error}</p>}
    </div>
  )
}