const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000

export function readSessionDraft(key, fallback = null) {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return fallback
    const parsed = JSON.parse(stored)
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_DRAFT_AGE_MS) {
      sessionStorage.removeItem(key)
      return fallback
    }
    return parsed.value ?? fallback
  } catch {
    return fallback
  }
}

export function writeSessionDraft(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // Storage can be disabled or full; the in-memory form remains usable.
  }
}

export function clearSessionDraft(key) {
  try { sessionStorage.removeItem(key) } catch { /* No-op */ }
}
