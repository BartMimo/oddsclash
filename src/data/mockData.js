// ------------------------------------------------------------------
// mockData.js — Fallback demo-data in EXACT hetzelfde formaat als de
// The Odds API v4-response (raw bookmakers/markets/outcomes).
//
// Wordt gebruikt zonder API-key, bij quota-op of bij een API-fout.
// Bevat gevarieerde markten én — anders dan de gratis live-tier —
// FICTIEVE spelersmarkten (schoten/reddingen) zodat de generieke
// marktrenderer volledig getest kan worden.
// ------------------------------------------------------------------

export const MOCK_SPORTS = [
  {
    key: 'soccer_epl',
    group: 'Soccer',
    title: 'Premier League',
    description: 'Engeland — Premier League',
    active: true,
    has_outcomes: false,
  },
  {
    key: 'soccer_netherlands_eredivisie',
    group: 'Soccer',
    title: 'Eredivisie',
    description: 'Nederland — Eredivisie',
    active: true,
    has_outcomes: false,
  },
  {
    key: 'soccer_spain_la_liga',
    group: 'Soccer',
    title: 'La Liga',
    description: 'Spanje — La Liga',
    active: true,
    has_outcomes: false,
  },
  {
    key: 'soccer_uefa_champs_league',
    group: 'Soccer',
    title: 'Champions League',
    description: 'UEFA Champions League',
    active: true,
    has_outcomes: false,
  },
]

// Fixtures per competitie: [home, away, urenVanafNu, extraMarktenFlag]
const FIXTURES = {
  soccer_epl: [
    ['Manchester City', 'Arsenal', 3, true],
    ['Liverpool', 'Chelsea', 6, false],
    ['Manchester United', 'Tottenham Hotspur', 27, true],
    ['Newcastle United', 'Aston Villa', 30, false],
  ],
  soccer_netherlands_eredivisie: [
    ['Ajax', 'PSV', 5, true],
    ['Feyenoord', 'AZ Alkmaar', 8, false],
    ['FC Twente', 'FC Utrecht', 28, false],
  ],
  soccer_spain_la_liga: [
    ['Real Madrid', 'FC Barcelona', 4, true],
    ['Atletico Madrid', 'Sevilla', 26, false],
    ['Real Sociedad', 'Real Betis', 31, false],
  ],
  soccer_uefa_champs_league: [
    ['Bayern Munich', 'Inter', 7, true],
    ['Paris Saint-Germain', 'FC Porto', 29, false],
  ],
}

const BOOKMAKERS = ['Bet365', 'Unibet', 'Pinnacle']

// Kleine deterministische hash -> [0,1) voor stabiele odds per reload.
function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

// Prijs met per-bookmaker jitter zodat verschillende bookmakers
// verschillende uitkomsten "winnen" (beste odds varieert).
function priced(base, bookIdx, seed) {
  const bookFactor = [1.0, 1.035, 0.985][bookIdx]
  const jitter = 0.94 + hash01(seed + bookIdx) * 0.12
  return Math.round(base * bookFactor * jitter * 100) / 100
}

function mk(name, base, seed, opts = {}) {
  return { name, base, seed, ...opts }
}

// Bouw de markten (per bookmaker identiek van structuur, andere prijzen).
function buildMarkets(home, away, eventId, withPlayerMarkets) {
  // Basis-markten (afleidbaar uit eindstand).
  const specs = [
    {
      key: 'h2h',
      outcomes: [
        mk(home, 2.15, 'h2h-h'),
        mk('Draw', 3.4, 'h2h-d'),
        mk(away, 3.25, 'h2h-a'),
      ],
    },
    {
      key: 'totals',
      outcomes: [
        mk('Over', 1.9, 'tot-o', { point: 2.5 }),
        mk('Under', 1.95, 'tot-u', { point: 2.5 }),
      ],
    },
    {
      key: 'btts',
      outcomes: [mk('Yes', 1.8, 'btts-y'), mk('No', 2.0, 'btts-n')],
    },
    {
      key: 'double_chance',
      outcomes: [
        mk('1X', 1.3, 'dc-1x'),
        mk('12', 1.28, 'dc-12'),
        mk('X2', 1.55, 'dc-x2'),
      ],
    },
    {
      key: 'spreads',
      outcomes: [
        mk(home, 1.95, 'sp-h', { point: -1.5 }),
        mk(away, 1.9, 'sp-a', { point: 1.5 }),
      ],
    },
    {
      key: 'draw_no_bet',
      outcomes: [mk(home, 1.55, 'dnb-h'), mk(away, 2.35, 'dnb-a')],
    },
  ]

  // Fictieve spelersmarkten (alleen demo). Niet afleidbaar uit eindstand
  // -> blijven Lopend met handmatige settlement in de Dev Toolbar.
  if (withPlayerMarkets) {
    specs.push({
      key: 'player_shots',
      outcomes: [
        mk('Over', 2.1, 'psh-a-o', { point: 2.5, description: `${home} — Spits` }),
        mk('Under', 1.7, 'psh-a-u', { point: 2.5, description: `${home} — Spits` }),
        mk('Over', 2.4, 'psh-b-o', { point: 1.5, description: `${away} — Spits` }),
        mk('Under', 1.55, 'psh-b-u', { point: 1.5, description: `${away} — Spits` }),
      ],
    })
    specs.push({
      key: 'player_saves',
      outcomes: [
        mk('Over', 1.85, 'psv-o', { point: 3.5, description: `${home} — Keeper` }),
        mk('Under', 1.9, 'psv-u', { point: 3.5, description: `${home} — Keeper` }),
      ],
    })
  }

  // Genereer per bookmaker een kopie met geprijsde outcomes.
  return BOOKMAKERS.map((title, bookIdx) => ({
    key: title.toLowerCase(),
    title,
    last_update: new Date().toISOString(),
    markets: specs.map((m) => ({
      key: m.key,
      last_update: new Date().toISOString(),
      outcomes: m.outcomes.map((o) => {
        const out = { name: o.name, price: priced(o.base, bookIdx, eventId + o.seed) }
        if (o.point != null) out.point = o.point
        if (o.description) out.description = o.description
        return out
      }),
    })),
  }))
}

function buildEvents(sportKey, sportTitle) {
  const fixtures = FIXTURES[sportKey] || []
  return fixtures.map(([home, away, hours, players], i) => {
    const id = `mock_${sportKey}_${i}`
    const commence = new Date(Date.now() + hours * 3600 * 1000).toISOString()
    return {
      id,
      sport_key: sportKey,
      sport_title: sportTitle,
      commence_time: commence,
      home_team: home,
      away_team: away,
      bookmakers: buildMarkets(home, away, id, players),
    }
  })
}

/** Alle mock-events per competitie, in raw API-vorm. */
export function getMockOdds(sportKey) {
  const sport = MOCK_SPORTS.find((s) => s.key === sportKey)
  if (!sport) return []
  return buildEvents(sportKey, sport.title)
}

/** Alle mock-events over alle competities heen. */
export function getAllMockEvents() {
  return MOCK_SPORTS.flatMap((s) => buildEvents(s.key, s.title))
}

/**
 * Deterministische "eindstand" voor een mock-event, in scores-API-vorm.
 * Zo settelt "Uitslagen ophalen" ook in Demo Mode afleidbare bets.
 */
export function getMockScores(sportKey) {
  return buildEvents(sportKey, sportKey).map((ev) => {
    const hHome = hash01(ev.id + 'home')
    const hAway = hash01(ev.id + 'away')
    const homeGoals = Math.floor(hHome * 4) // 0..3
    const awayGoals = Math.floor(hAway * 4) // 0..3
    return {
      id: ev.id,
      sport_key: ev.sport_key,
      commence_time: ev.commence_time,
      completed: true,
      home_team: ev.home_team,
      away_team: ev.away_team,
      scores: [
        { name: ev.home_team, score: String(homeGoals) },
        { name: ev.away_team, score: String(awayGoals) },
      ],
      last_update: new Date().toISOString(),
    }
  })
}
