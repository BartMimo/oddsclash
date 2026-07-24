// ------------------------------------------------------------------
// settlement.js — Afhandeling van bets op basis van uitslagen.
//
// Pure functies: krijgen bets + scores, geven settlement-beslissingen.
// De store past ze toe (saldo bijwerken etc.).
//
// Afleidbare markten (uit de eindstand): h2h, totals, btts,
// double_chance, draw_no_bet, spreads, team_totals.
// Niet-afleidbaar (bv. spelersstatistieken): leg blijft 'pending' met
// handmatige settlement-optie in de Dev Toolbar.
// ------------------------------------------------------------------

import { isDerivableMarket } from '../lib/markets'

/** Bouw een index eventId -> uitslag uit de scores-API-response. */
export function buildResultIndex(scores) {
  const index = new Map()
  for (const ev of scores || []) {
    if (!ev.completed || !Array.isArray(ev.scores)) continue
    const findScore = (team) => {
      const s = ev.scores.find((x) => x.name === team)
      return s ? Number(s.score) : null
    }
    const homeGoals = findScore(ev.home_team)
    const awayGoals = findScore(ev.away_team)
    if (homeGoals == null || awayGoals == null) continue
    index.set(ev.id, {
      homeTeam: ev.home_team,
      awayTeam: ev.away_team,
      homeGoals,
      awayGoals,
      completed: true,
    })
  }
  return index
}

/**
 * Bepaal de status van één leg gegeven een uitslag.
 * Retour: 'won' | 'lost' | 'void' | 'pending'.
 */
export function settleLeg(leg, result) {
  if (!result || !result.completed) return 'pending'
  if (!isDerivableMarket(leg.marketKey)) return 'pending'

  const { homeGoals: h, awayGoals: a, homeTeam, awayTeam } = result
  const total = h + a
  const name = leg.outcomeName
  const point = leg.point

  switch (leg.marketKey) {
    case 'h2h':
    case 'h2h_3_way':
      if (name === 'Draw') return h === a ? 'won' : 'lost'
      if (name === homeTeam) return h > a ? 'won' : 'lost'
      if (name === awayTeam) return a > h ? 'won' : 'lost'
      return 'pending'

    case 'draw_no_bet':
      if (h === a) return 'void' // inzet terug
      if (name === homeTeam) return h > a ? 'won' : 'lost'
      if (name === awayTeam) return a > h ? 'won' : 'lost'
      return 'pending'

    case 'totals':
    case 'alternate_totals': {
      if (point == null) return 'pending'
      if (total === point) return 'void'
      if (name === 'Over') return total > point ? 'won' : 'lost'
      if (name === 'Under') return total < point ? 'won' : 'lost'
      return 'pending'
    }

    case 'btts':
    case 'both_teams_to_score': {
      const both = h > 0 && a > 0
      if (name === 'Yes') return both ? 'won' : 'lost'
      if (name === 'No') return both ? 'lost' : 'won'
      return 'pending'
    }

    case 'double_chance':
      return settleDoubleChance(name, h, a, homeTeam, awayTeam)

    case 'spreads':
    case 'alternate_spreads': {
      if (point == null) return 'pending'
      const teamGoals = name === homeTeam ? h : name === awayTeam ? a : null
      const otherGoals = name === homeTeam ? a : name === awayTeam ? h : null
      if (teamGoals == null) return 'pending'
      const diff = teamGoals + point - otherGoals
      if (diff === 0) return 'void'
      return diff > 0 ? 'won' : 'lost'
    }

    case 'team_totals': {
      if (point == null) return 'pending'
      const team = leg.description || name
      const teamGoals = team && team.includes(homeTeam) ? h : team && team.includes(awayTeam) ? a : null
      if (teamGoals == null) return 'pending'
      if (teamGoals === point) return 'void'
      if (name === 'Over') return teamGoals > point ? 'won' : 'lost'
      if (name === 'Under') return teamGoals < point ? 'won' : 'lost'
      return 'pending'
    }

    default:
      return 'pending'
  }
}

function settleDoubleChance(name, h, a, home, away) {
  const homeOrDraw = h >= a
  const awayOrDraw = a >= h
  const notDraw = h !== a
  const norm = name
  if (norm === '1X' || norm === `${home}/Draw` || norm === `Draw/${home}`)
    return homeOrDraw ? 'won' : 'lost'
  if (norm === 'X2' || norm === `${away}/Draw` || norm === `Draw/${away}`)
    return awayOrDraw ? 'won' : 'lost'
  if (norm === '12' || norm === `${home}/${away}` || norm === `${away}/${home}`)
    return notDraw ? 'won' : 'lost'
  return 'pending'
}

/**
 * Evalueer een volledige bet (enkel of combi) tegen de uitslag-index.
 * Respecteert reeds handmatig gesettelde legs (leg.manual === true).
 *
 * Retour: { status, payout, legs } waarbij status
 *   'won' | 'lost' | 'open' en payout = inzet × effectieve odds
 *   (void-legs tellen als factor 1.0).
 */
export function evaluateBet(bet, resultIndex) {
  const legs = bet.legs.map((leg) => {
    if (leg.status && leg.status !== 'pending') return leg // reeds beslist (auto of handmatig)
    const result = resultIndex.get(leg.eventId)
    const status = settleLeg(leg, result)
    return status === 'pending' ? leg : { ...leg, status }
  })

  const anyLost = legs.some((l) => l.status === 'lost')
  const anyOpen = legs.some((l) => !l.status || l.status === 'pending')

  let status = 'open'
  if (anyLost) status = 'lost'
  else if (!anyOpen) status = 'won' // alle legs won of void

  let payout = 0
  if (status === 'won') {
    const factor = legs.reduce(
      (acc, l) => acc * (l.status === 'void' ? 1 : Number(l.price)),
      1
    )
    payout = Math.round(bet.stake * factor * 100) / 100
  }

  return { status, payout, legs }
}
