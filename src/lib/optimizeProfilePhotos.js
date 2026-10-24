import { supabase } from './supabase'

const MAX_DIMENSION = 768
const WEBP_QUALITY = 0.82

function createOptimizedImage(blob) {
  return new Promise(async resolve => {
    if (typeof createImageBitmap !== 'function') {
      resolve(null)
      return
    }

    let bitmap
    try {
      bitmap = await createImageBitmap(blob)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))

      const context = canvas.getContext('2d')
      if (!context) {
        resolve(null)
        return
      }

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(result => resolve(result?.type === 'image/webp' ? result : null), 'image/webp', WEBP_QUALITY)
    } catch {
      resolve(null)
    } finally {
      bitmap?.close?.()
    }
  })
}

export async function optimizeExistingProfilePhotos(players, ownerId, onProgress) {
  if (!ownerId) throw new Error('Non riesco a identificare l’account amministratore.')

  const candidates = players.filter(player => player.photo_url)
  const results = { success: 0, skipped: 0, errors: [] }

  for (let index = 0; index < candidates.length; index += 1) {
    const player = candidates[index]
    const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Giocatore'
    onProgress?.({ done: index, total: candidates.length, name })

    let uploadedPath = null
    try {
      const response = await fetch(player.photo_url, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`Impossibile scaricare la foto (${response.status})`)

      const source = await response.blob()
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(source.type)) {
        results.skipped += 1
        onProgress?.({ done: index + 1, total: candidates.length, name })
        continue
      }

      const optimized = await createOptimizedImage(source)
      if (!optimized) throw new Error('Il browser non è riuscito a preparare una versione WebP')

      // Se è già piccolo e il WebP non riduce i dati, riutilizziamo i byte originali.
      const useOptimized = optimized.size < source.size * 0.95
      const file = useOptimized ? optimized : source
      const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
      uploadedPath = `${ownerId}/optimized/${player.id}-${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(uploadedPath, file, {
          cacheControl: '31536000',
          upsert: false,
          contentType: file.type
        })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadedPath)

      const { data, error } = await supabase
        .from('players')
        .update({ photo_url: publicData.publicUrl })
        .eq('id', player.id)
        .eq('photo_url', player.photo_url)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('La foto è stata modificata durante l’ottimizzazione')

      results.success += 1
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from('avatars').remove([uploadedPath])
      }
      results.errors.push({ name, message: error?.message || 'Errore durante l’ottimizzazione' })
    }

    onProgress?.({ done: index + 1, total: candidates.length, name })
  }

  return results
}
