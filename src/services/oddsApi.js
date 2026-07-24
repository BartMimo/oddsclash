// ------------------------------------------------------------------
// oddsApi.js — Eén abstractielaag over alle odds-data.
//
// Provider: The Odds API (https://the-odds-api.com), v4 — maar de
// rest van de app praat hier NOOIT rechtstreeks mee. Alle calls gaan
// via de Supabase Edge Function `odds-proxy`: de ODDS_API_KEY-secret
// leeft alleen daar (server), nooit in de browser-bundle.
//
// De proxy houdt ook één GEDEELDE cache bij (cached_odds-tabel, TTL
// 30 min) voor alle gebruikers samen — dat is waar de quotum-winst
// vandaan komt t.o.v. een cache per browser.
//
// Valt automatisch terug op Demo Mode (mockData) als de server geen
// key heeft, bij quota-op, of bij een API-fout.
// ------------------------------------------------------------------

import { supabase } from './supabase'
import { getMockOdds, getMockScores, MOCK_SPORTS } from '../data/mockData'

const TTL_MS = 30 * 60 * 1000

// Laatst bekende status, bijgewerkt na elke proxy-call.
let lastQuotaRemaining = null
let lastQuotaUsed = null
let lastNoApiKey = false
const lastFetchedAt = new Map() // cacheKey -> ISO-timestamp

export function getQuota() {
  return { remaining: lastQuotaRemaining, used: lastQuotaUsed }
}

/** Is er (voor zover bekend) een API-key geconfigureerd op de server? */
export function hasApiKey() {
  return !lastNoApiKey
}

/** Minuten tot de servercache voor deze resource verloopt (0 = onbekend/verlopen). */
export function minutesUntilStale(cacheKey) {
  const iso = lastFetchedAt.get(cacheKey)
  if (!iso) return 0
  const ageMs = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.ceil((TTL_MS - ageMs) / 60000))
}

/** Roep de odds-proxy Edge Function aan. Gooit nooit — geeft altijd een resultaat terug. */
async function callProxy(resource, sport, force) {
  const params = new URLSearchParams({ resource })
  if (sport) params.set('sport', sport)
  if (force) params.set('force', 'true')

  const { data, error } = await supabase.functions.invoke(`odds-proxy?${params}`, {
    method: 'GET',
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)

  lastNoApiKey = !!data?.noApiKey
  if (data?.requestsRemaining != null) lastQuotaRemaining = data.requestsRemaining
  if (data?.requestsUsed != null) lastQuotaUsed = data.requestsUsed
  if (data?.fetchedAt) {
    const cacheKey = resource === 'sports' ? 'sports' : `${resource}:${sport}`
    lastFetchedAt.set(cacheKey, data.fetchedAt)
  }
  return data
}

// Bewust beperkte scope: alleen voetbal, en daarbinnen alleen de
// Europese clubcompetities + de 9 grootste Europese landencompetities.
// Elke extra competitie is een extra cache-entry (dus potentieel extra
// API-calls) — deze allowlist zet een harde bovengrens op het aantal
// competities dat ooit quotum kan verbruiken, ongeacht wat de API
// verder allemaal aanbiedt (offseason-competities leveren gewoon 0
// wedstrijden totdat hun seizoen weer begint).
//
// Waarde = leesbare Nederlandse titel die de vaak cryptische/Engelse
// API-titel (bv. "EPL") overschrijft voor de UI.
const ALLOWED_SPORTS = new Map([
  // Europese clubcompetities (UEFA)
  ['soccer_uefa_champs_league', 'Champions League'],
  ['soccer_uefa_europa_league', 'Europa League'],
  ['soccer_uefa_europa_conference_league', 'Conference League'],
  // 9 grootste Europese landencompetities
  ['soccer_epl', 'Premier League — Engeland'],
  ['soccer_spain_la_liga', 'La Liga — Spanje'],
  ['soccer_germany_bundesliga', 'Bundesliga — Duitsland'],
  ['soccer_italy_serie_a', 'Serie A — Italië'],
  ['soccer_france_ligue_one', 'Ligue 1 — Frankrijk'],
  ['soccer_netherlands_eredivisie', 'Eredivisie — Nederland'],
  ['soccer_portugal_primeira_liga', 'Primeira Liga — Portugal'],
  ['soccer_belgium_first_div', 'Pro League — België'],
  ['soccer_spl', 'Premiership — Schotland'],
])

function filterSoccer(sports) {
  // Let op: geen 'active'-filter. The Odds API's `active`-vlag betekent
  // "heeft nu bookmaker-odds", niet "heeft nu geen wedstrijden". Een
  // competitie in onze scope blijft dus zichtbaar als pill ook als er
  // tijdelijk geen odds beschikbaar zijn (bv. vroege kwalificatierondes) —
  // de detailpagina toont dan gewoon "geen wedstrijden met odds".
  return (sports || [])
    .filter((s) => typeof s.key === 'string' && ALLOWED_SPORTS.has(s.key))
    .map((s) => ({ ...s, title: ALLOWED_SPORTS.get(s.key) }))
}

// ------------------------------------------------------------------
// Publieke API
// Elke functie geeft: { data, demo, cached, error }
// ------------------------------------------------------------------

export async function fetchSports({ force = false, demoOverride = false } = {}) {
  if (demoOverride) {
    return { data: filterSoccer(MOCK_SPORTS), demo: true, cached: false, error: null }
  }
  try {
    const res = await callProxy('sports', null, force)
    if (res.noApiKey) {
      return { data: filterSoccer(MOCK_SPORTS), demo: true, cached: false, error: null }
    }
    return { data: filterSoccer(res.data), demo: false, cached: !!res.cached, error: null }
  } catch (error) {
    return { data: filterSoccer(MOCK_SPORTS), demo: true, cached: false, error: error.message }
  }
}

export async function fetchOdds(sportKey, { force = false, demoOverride = false } = {}) {
  if (demoOverride) {
    return { data: getMockOdds(sportKey), demo: true, cached: false, error: null }
  }
  try {
    const res = await callProxy('odds', sportKey, force)
    if (res.noApiKey) {
      return { data: getMockOdds(sportKey), demo: true, cached: false, error: null }
    }
    return { data: res.data, demo: false, cached: !!res.cached, error: null }
  } catch (error) {
    return { data: getMockOdds(sportKey), demo: true, cached: false, error: error.message }
  }
}

export async function fetchScores(sportKeys, { force = false, demoOverride = false } = {}) {
  const keys = Array.isArray(sportKeys) ? sportKeys : [sportKeys]

  if (demoOverride) {
    const data = keys.flatMap((k) => getMockScores(k))
    return { data, demo: true, cached: false, error: null }
  }

  const results = []
  let anyError = null
  let anyLive = false
  let anyNoKey = false
  for (const key of keys) {
    try {
      const res = await callProxy('scores', key, force)
      if (res.noApiKey) {
        anyNoKey = true
        results.push(...getMockScores(key))
        continue
      }
      results.push(...res.data)
      anyLive = true
    } catch (error) {
      anyError = error.message
      results.push(...getMockScores(key))
    }
  }
  return { data: results, demo: anyNoKey || !anyLive, cached: false, error: anyError }
}
