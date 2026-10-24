let removalModule

async function optimizeTransparentImage(blob) {
  if (typeof createImageBitmap !== 'function') return blob

  let bitmap
  try {
    bitmap = await createImageBitmap(blob)
    const maxDimension = 768
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext('2d')
    if (!context) return blob
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const optimized = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/webp', 0.84)
    })

    return optimized?.type === 'image/webp' ? optimized : blob
  } catch {
    return blob
  } finally {
    bitmap?.close?.()
  }
}

export async function removeImageBackground(file, onProgress) {
  removalModule ||= import('@imgly/background-removal')

  try {
    const { removeBackground } = await removalModule
    const result = await removeBackground(file, {
      model: 'small',
      output: { format: 'image/png' },
      progress: (key, current, total) => {
        onProgress?.({ key, current, total })
      }
    })

    const optimized = await optimizeTransparentImage(result)
    const isWebp = optimized.type === 'image/webp'

    return new File(
      [optimized],
      `avatar-${crypto.randomUUID()}.${isWebp ? 'webp' : 'png'}`,
      { type: isWebp ? 'image/webp' : 'image/png', lastModified: Date.now() }
    )
  } catch (error) {
    removalModule = null
    throw error
  }
}
