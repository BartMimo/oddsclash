// ------------------------------------------------------------------
// supabase.js — Eén gedeelde Supabase-client + de data-laag.
//
// De client gebruikt de PUBLIEKE anon/publishable key (veilig in de
// browser). Alle schrijf-acties op saldo/bets lopen via SECURITY
// DEFINER-RPC's op de server; Row Level Security beschermt de rest.
// ------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Is Supabase geconfigureerd? Zo niet, draait de app op lokale (gast)modus. */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

// ---------------- Auth ----------------

export async function signUp({ email, password, username, avatarColor }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, avatar_color: avatarColor } },
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  try {
    const { data, error } = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Time-out bij sessie ophalen')), 8000)),
    ])
    if (error) throw error
    return data.session
  } catch {
    // Ongeldige/verlopen sessie (bv. account verwijderd) of netwerk-timeout —
    // nooit de hele app op de auth-check laten hangen. { scope: 'local' } ruimt
    // alleen de lokale opslag op (geen server-call, kan zelf dus niet hangen).
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    return null
  }
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

// ---------------- Profiel & ranglijst ----------------

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, { username, avatarColor }) {
  const patch = {}
  if (username != null) patch.username = username
  if (avatarColor != null) patch.avatar_color = avatarColor
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Globale ranglijst: alle profielen op saldo. */
export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_color, balance')
    .order('balance', { ascending: false })
  if (error) throw error
  return data
}

// ---------------- Bets ----------------

/** Bets van een gebruiker, inclusief legs. */
export async function fetchBets(userId) {
  const { data, error } = await supabase
    .from('bets')
    .select('*, legs:bet_legs(*)')
    .eq('user_id', userId)
    .order('placed_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Plaats een bet via de server-RPC (atomair saldo aftrekken).
 * legs = array met o.a. event_id, price, commence_time, market_key…
 */
export async function placeBet(stake, legs) {
  const { data, error } = await supabase.rpc('place_bet', {
    p_stake: stake,
    p_legs: legs,
  })
  if (error) throw error
  return data // bet id (uuid)
}

export async function resetAccount() {
  const { error } = await supabase.rpc('reset_account')
  if (error) throw error
}

/** Wikkel open bets af o.b.v. uitslagen. results = [{event_id, home_goals, away_goals}]. */
export async function settleOpenBets(results) {
  const { data, error } = await supabase.rpc('settle_open_bets', { p_results: results })
  if (error) throw error
  return data // aantal gesettelde bets
}

export async function forceBet(betId, win) {
  const { error } = await supabase.rpc('force_bet', { p_bet_id: betId, p_win: win })
  if (error) throw error
}

export async function manualSettleLeg(betId, legId, status) {
  const { error } = await supabase.rpc('manual_settle_leg', {
    p_bet_id: betId,
    p_leg_id: legId,
    p_status: status,
  })
  if (error) throw error
}

/** Ranglijst-stats (W/V/totaal) per speler, uit de profile_stats-view. */
export async function fetchProfileStats() {
  const { data, error } = await supabase
    .from('profile_stats')
    .select('*')
    .order('balance', { ascending: false })
  if (error) throw error
  return data
}

/** "Deze week"-ranglijst: netto winst/verlies sinds `sinceIso` (start van de week). */
export async function fetchWeeklyLeaderboard(sinceIso) {
  const { data, error } = await supabase.rpc('get_weekly_leaderboard', { p_since: sinceIso })
  if (error) throw error
  return data
}

// ---------------- Leagues ----------------

export async function createLeague(name) {
  const { data, error } = await supabase.rpc('create_league', { p_name: name })
  if (error) throw error
  return data
}

export async function joinLeague(code) {
  const { data, error } = await supabase.rpc('join_league', { p_code: code })
  if (error) throw error
  return data
}

/** Leagues waar de gebruiker lid van is, met leden + hun profielen. */
export async function fetchMyLeagues() {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, code, owner_id, members:league_members(user_id, profiles(id, username, avatar_color, balance))')
  if (error) throw error
  return data
}

/** Recente bets van alle leden van een league (social activity-feed). */
export async function fetchLeagueActivity(leagueId, limit = 15) {
  const { data, error } = await supabase.rpc('get_league_activity', {
    p_league_id: leagueId,
    p_limit: limit,
  })
  if (error) throw error
  return data
}
