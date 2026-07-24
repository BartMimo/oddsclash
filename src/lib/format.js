// Kleine formatting-helpers.

/** Format een getal met 2 decimalen (odds, credits). */
export function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0.00'
  return v.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Initialen uit een teamnaam, bv. "Manchester United" -> "MU". */
export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Deterministische kleur (hsl) op basis van een string — voor team-badges. */
export function colorFromString(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 42%)`
}

/** Valt een ISO-timestamp op dezelfde kalenderdag als vandaag? */
export function isToday(iso) {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

/** Valt een ISO-timestamp op de kalenderdag van morgen? */
export function isTomorrow(iso) {
  if (!iso) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return new Date(iso).toDateString() === tomorrow.toDateString()
}

/** Leesbare datum/tijd voor een ISO-string. */
export function formatKickoff(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const time = d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (isToday(iso)) return `Vandaag ${time}`
  if (isTomorrow(iso)) return `Morgen ${time}`
  return d.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) + ` ${time}`
}

/** Is de wedstrijd al begonnen? Dan is wedden gesloten. */
export function hasStarted(iso) {
  if (!iso) return false
  return new Date(iso).getTime() <= Date.now()
}

// Geen live-scores per wedstrijd beschikbaar in deze app — benader de
// "live"-periode met een vast venster na aftrap (speeltijd + rust + marge).
const LIVE_WINDOW_MS = 130 * 60 * 1000

/** Is de wedstrijd (naar schatting) nu bezig? */
export function isLive(iso) {
  if (!iso) return false
  const start = new Date(iso).getTime()
  const now = Date.now()
  return start <= now && now < start + LIVE_WINDOW_MS
}

/** Is de wedstrijd (naar schatting) al afgelopen? */
export function isFinished(iso) {
  if (!iso) return false
  return new Date(iso).getTime() + LIVE_WINDOW_MS <= Date.now()
}

/** Begin (maandag 00:00) van de kalenderweek van een datum — voor de "Deze week"-ranglijst. */
export function startOfWeek(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay() // 0 = zondag
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function randomId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}
