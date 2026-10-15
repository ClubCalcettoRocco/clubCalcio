export function explainError(error, fallback = 'Operazione non riuscita.') {
  const message = typeof error === 'string' ? error : error?.message || fallback
  const normalized = message.toLowerCase()

  if (typeof navigator !== 'undefined' && !navigator.onLine || /failed to fetch|networkerror|network request failed|fetch failed|timed out|timeout/i.test(message)) {
    return 'Connessione assente o instabile. I dati inseriti sono ancora qui: riprova appena la connessione torna disponibile.'
  }
  if (/jwt expired|refresh token|session.*expired|invalid jwt|unauthenticated|401/.test(normalized)) {
    return 'La sessione non è più valida. Accedi di nuovo e ripeti il salvataggio.'
  }
  if (/row-level security|permission denied|not authorized|solo un amministratore|non autorizzato/.test(normalized)) {
    return 'Non hai i permessi necessari per questa operazione. Se pensi sia un errore, contatta l’amministratore.'
  }
  if (/invalid login credentials|invalid email or password/.test(normalized)) {
    return 'Email o password non corretti. Controlla i dati e riprova.'
  }
  if (/email not confirmed|email_not_confirmed/.test(normalized)) {
    return 'Conferma il tuo indirizzo email prima di accedere.'
  }
  if (/user already registered|already been registered/.test(normalized)) {
    return 'Esiste già un account con questa email. Prova ad accedere.'
  }
  return message
}
