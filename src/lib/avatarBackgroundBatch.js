import { supabase } from './supabase'
import { removeImageBackground } from './removeImageBackground'

export async function removeBackgroundFromProfiles(players, ownerId, onProgress) {
  if (!ownerId) throw new Error('Non riesco a identificare l’account amministratore.')

  const candidates = players.filter(player => player.photo_url && !player.photo_url_original)
  const results = { success: 0, errors: [] }

  for (let index = 0; index < candidates.length; index += 1) {
    const player = candidates[index]
    onProgress?.({ done: index, total: candidates.length, name: player.first_name })

    let uploadedPath = null
    try {
      const response = await fetch(player.photo_url)
      if (!response.ok) throw new Error(`Impossibile scaricare la foto (${response.status})`)

      const source = await response.blob()
      if (!source.type.startsWith('image/')) throw new Error('Il file collegato non è un’immagine valida')

      const input = new File([source], `profile-${player.id}`, {
        type: source.type || 'image/jpeg'
      })
      const transparent = await removeImageBackground(input, progress => {
        onProgress?.({
          done: index,
          total: candidates.length,
          name: player.first_name,
          modelProgress: progress
        })
      })

      uploadedPath = `${ownerId}/background-removed/${player.id}-${crypto.randomUUID()}.png`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(uploadedPath, transparent, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png'
        })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadedPath)

      const { data, error } = await supabase
        .from('players')
        .update({
          photo_url: publicData.publicUrl,
          photo_url_original: player.photo_url
        })
        .eq('id', player.id)
        .eq('photo_url', player.photo_url)
        .is('photo_url_original', null)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('La foto del profilo è cambiata durante l’elaborazione')

      results.success += 1
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from('avatars').remove([uploadedPath])
      }
      results.errors.push({
        name: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Giocatore',
        message: error?.message || 'Errore durante l’elaborazione'
      })
    }

    onProgress?.({ done: index + 1, total: candidates.length })
  }

  return results
}

export async function restoreOriginalProfilePhotos(players, onProgress) {
  const candidates = players.filter(player => player.photo_url_original)
  const results = { success: 0, errors: [] }

  for (let index = 0; index < candidates.length; index += 1) {
    const player = candidates[index]
    onProgress?.({ done: index, total: candidates.length, name: player.first_name })

    const { data, error } = await supabase
      .from('players')
      .update({
        photo_url: player.photo_url_original,
        photo_url_original: null
      })
      .eq('id', player.id)
      .eq('photo_url', player.photo_url)
      .eq('photo_url_original', player.photo_url_original)
      .select('id')
      .maybeSingle()

    if (error || !data) {
      results.errors.push({
        name: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Giocatore',
        message: error?.message || 'La foto del profilo è cambiata durante il ripristino'
      })
    } else {
      results.success += 1
    }

    onProgress?.({ done: index + 1, total: candidates.length })
  }

  return results
}
