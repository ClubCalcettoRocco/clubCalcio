export const TYPES = {
  calcetto5: { label: 'Calcetto 5', perTeam: 5 },
  calciotto8: { label: 'Calciotto 8', perTeam: 8 },
  calcio11: { label: 'Calcio 11', perTeam: 11 }
}

export const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Senza nome' : '—')
export const initials = (p) => (p ? `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`.toUpperCase() || '?' : '?')

export const fmtDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const fmtTime = (d) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
export const fmt1 = (v) => (v == null ? '—' : Number(v).toFixed(1))

export const toLocalInput = (d) => {
  const t = new Date(d)
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset())
  return t.toISOString().slice(0, 16)
}

export const localIsoFromInputs = (date, time) => {
  if (!date || !time) return null
  return new Date(`${date}T${time}`).toISOString()
}

export const statusLabel = (status) => status === 'played' ? 'Giocata' : 'In programma'