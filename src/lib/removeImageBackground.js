let removalModule

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

    return new File(
      [result],
      `avatar-${crypto.randomUUID()}.png`,
      { type: 'image/png', lastModified: Date.now() }
    )
  } catch (error) {
    removalModule = null
    throw error
  }
}
