// ------------------------------------------------------------------
// markets.js — Dynamische markt-normalisatie.
//
// De UI hardcodet GEEN marktenlijst. We parsen de API-response
// (The Odds API v4-formaat) en bouwen per wedstrijd exact de markten
// die de API teruggeeft. Per uitkomst kiezen we de BESTE (hoogste)
// quotering over alle bookmakers heen, en onthouden welke bookmaker
// die levert.
// ------------------------------------------------------------------

// Leesbare Nederlandse labels per market.key. Onbekende keys krijgen
// automatisch een nette titel via prettifyKey().
const MARKET_LABELS = {
  h2h: 'Wedstrijduitslag (1X2)',
  h2h_3_way: 'Wedstrijduitslag (1X2)',
  totals: 'Totaal doelpunten',
  alternate_totals: 'Totaal doelpunten (alternatief)',
  spreads: 'Handicap',
  alternate_spreads: 'Handicap (alternatief)',
  btts: 'Beide teams scoren',
  both_teams_to_score: 'Beide teams scoren', // PropLine's naam voor btts
  draw_no_bet: 'Draw No Bet',
  double_chance: 'Dubbele kans',
  team_totals: 'Team totaal doelpunten',
  // Spelersmarkten — bij gratis odds-API's zeldzaam/afwezig voor voetbal
  // (die feeds zijn betaald, bv. Sportradar). In Demo Mode leveren we ze
  // fictief mee zodat de generieke renderer getest kan worden.
  player_shots: 'Speler — Schoten',
  player_shots_on_target: 'Speler — Schoten op doel',
  player_saves: 'Speler — Reddingen',
  player_goal_scorer_anytime: 'Doelpuntenmaker (altijd)',
  player_goal_scorer_first: 'Eerste doelpuntenmaker',
}

/** Zet een onbekende market.key om in een nette titel. */
function prettifyKey(key = '') {
  return key
    .replace(/_/g, ' ')
    .replace(/\bh2h\b/gi, 'Wedstrijduitslag')
    .replace(/\bbtts\b/gi, 'Beide teams scoren')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function marketLabel(key) {
  return MARKET_LABELS[key] || prettifyKey(key)
}

// Markten waarvan de uitslag NIET automatisch uit de eindstand
// afleidbaar is (spelersstatistieken e.d.) — deze blijven na
// settlement Lopend met handmatige settlement-optie in de Dev Toolbar.
const DERIVABLE_MARKETS = new Set([
  'h2h',
  'h2h_3_way',
  'totals',
  'alternate_totals',
  'btts',
  'both_teams_to_score',
  'double_chance',
  'draw_no_bet',
  'spreads',
  'alternate_spreads',
  'team_totals',
])

export function isDerivableMarket(key) {
  return DERIVABLE_MARKETS.has(key)
}

// Sommige bookmakers zijn betting exchanges (bv. Betfair Exchange,
// Smarkets) en leveren naast de normale 'back'-markt ook een losse
// '_lay'-variant (bv. h2h_lay): daarbij zet je in TEGEN een uitkomst,
// met een ander risico-/uitbetalingsmodel dan inzet × odds. Die passen
// niet in dit fixed-odds-model en worden bij normalisatie overgeslagen.
export function isExchangeLayMarket(key = '') {
  return key.endsWith('_lay')
}

/** Stabiele, unieke id voor een uitkomst binnen één wedstrijd. */
export function outcomeId(marketKey, outcome) {
  return [
    marketKey,
    outcome.name ?? '',
    outcome.point ?? '',
    outcome.description ?? '',
  ].join('::')
}

/**
 * Leesbaar label voor een uitkomst, afhankelijk van de markt.
 * homeTeam/awayTeam worden meegegeven voor 1X2-context.
 */
export function outcomeLabel(marketKey, outcome, homeTeam, awayTeam) {
  const name = outcome.name ?? ''
  const point = outcome.point
  const desc = outcome.description

  // Spelersmarkt: "Speler — Over 1.5"
  if (desc) {
    const line = point != null ? ` ${localizeName(name)} ${point}` : ` ${localizeName(name)}`
    return `${desc} —${line}`
  }

  switch (marketKey) {
    case 'h2h':
    case 'h2h_3_way':
    case 'draw_no_bet':
      if (name === 'Draw') return 'Gelijkspel'
      return name
    case 'totals':
    case 'alternate_totals':
      return `${localizeName(name)} ${point}`
    case 'team_totals':
      return `${name}${point != null ? ` ${point}` : ''}`
    case 'spreads':
    case 'alternate_spreads': {
      const p = point != null ? (point > 0 ? `+${point}` : `${point}`) : ''
      return `${name} ${p}`.trim()
    }
    case 'btts':
    case 'both_teams_to_score':
      return name === 'Yes' ? 'Ja' : name === 'No' ? 'Nee' : name
    case 'double_chance':
      return localizeDoubleChance(name, homeTeam, awayTeam)
    default:
      // Generiek: toon naam + evt. punt
      return point != null ? `${localizeName(name)} ${point}` : localizeName(name)
  }
}

function localizeName(name = '') {
  const map = { Over: 'Over', Under: 'Under', Yes: 'Ja', No: 'Nee', Draw: 'Gelijkspel' }
  return map[name] || name
}

function localizeDoubleChance(name, home, away) {
  // The Odds API levert combi-namen zoals "Home/Draw" of team-combinaties.
  const map = {
    '1X': `${home} of gelijk`,
    '12': `${home} of ${away}`,
    X2: `${away} of gelijk`,
  }
  if (map[name]) return map[name]
  if (home && away) {
    if (name === `${home}/Draw`) return `${home} of gelijk`
    if (name === `${away}/Draw` || name === `Draw/${away}`) return `${away} of gelijk`
    if (name === `${home}/${away}`) return `${home} of ${away}`
  }
  return name
}

/**
 * Normaliseer één event (API-vorm) naar app-vorm met beste odds per uitkomst.
 * Geeft { id, sportKey, sportTitle, homeTeam, awayTeam, commenceTime, markets[] }.
 */
export function normalizeEvent(event) {
  const homeTeam = event.home_team
  const awayTeam = event.away_team

  // Verzamel per market.key -> per outcomeId -> beste prijs + bookmaker.
  const marketMap = new Map()

  for (const bm of event.bookmakers || []) {
    for (const market of bm.markets || []) {
      // Exchange-'lay'-markten (bv. h2h_lay van Betfair Exchange) sla je
      // over: dat is de tegenovergestelde weddenschap ("tegen een uitkomst
      // inzetten", met ander risico/uitbetalingsmodel dan onze standaard
      // inzet × odds-logica). Die passen niet in dit fixed-odds-model.
      if (isExchangeLayMarket(market.key)) continue
      if (!marketMap.has(market.key)) {
        marketMap.set(market.key, { key: market.key, outcomes: new Map() })
      }
      const bucket = marketMap.get(market.key).outcomes
      for (const oc of market.outcomes || []) {
        const id = outcomeId(market.key, oc)
        const price = Number(oc.price)
        if (!Number.isFinite(price)) continue
        const existing = bucket.get(id)
        // Beste (hoogste) quotering wint.
        if (!existing || price > existing.price) {
          bucket.set(id, {
            id,
            name: oc.name,
            point: oc.point ?? null,
            description: oc.description ?? null,
            price,
            bookmaker: bm.title,
            label: outcomeLabel(market.key, oc, homeTeam, awayTeam),
          })
        }
      }
    }
  }

  const markets = [...marketMap.values()].map((m) => ({
    key: m.key,
    label: marketLabel(m.key),
    derivable: isDerivableMarket(m.key),
    outcomes: sortOutcomes(m.key, [...m.outcomes.values()], homeTeam, awayTeam),
  }))

  // Zet h2h vooraan, daarna de rest zoals de API ze aanleverde.
  markets.sort((a, b) => marketSortWeight(a.key) - marketSortWeight(b.key))

  return {
    id: event.id,
    sportKey: event.sport_key,
    sportTitle: event.sport_title,
    homeTeam,
    awayTeam,
    commenceTime: event.commence_time,
    markets,
  }
}

function marketSortWeight(key) {
  const order = ['h2h', 'h2h_3_way', 'double_chance', 'draw_no_bet', 'totals', 'btts', 'spreads']
  const idx = order.indexOf(key)
  return idx === -1 ? 100 : idx
}

function sortOutcomes(key, outcomes, home, away) {
  if (key === 'h2h' || key === 'h2h_3_way') {
    const rank = (o) => (o.name === home ? 0 : o.name === 'Draw' ? 1 : o.name === away ? 2 : 3)
    return [...outcomes].sort((a, b) => rank(a) - rank(b))
  }
  if (key === 'totals' || key === 'alternate_totals') {
    return [...outcomes].sort(
      (a, b) => (a.point ?? 0) - (b.point ?? 0) || (a.name < b.name ? -1 : 1)
    )
  }
  return outcomes
}

/** Aantal distinct markten voor de "+N markten"-teller op de kaart. */
export function marketCount(normalized) {
  return normalized.markets.length
}

/** Haal de 1X2 quick-odds (home / draw / away) voor een kaart. */
export function h2hQuickOdds(normalized) {
  const h2h = normalized.markets.find((m) => m.key === 'h2h' || m.key === 'h2h_3_way')
  if (!h2h) return null
  const home = h2h.outcomes.find((o) => o.name === normalized.homeTeam)
  const draw = h2h.outcomes.find((o) => o.name === 'Draw')
  const away = h2h.outcomes.find((o) => o.name === normalized.awayTeam)
  return { marketKey: h2h.key, home, draw, away }
}

/** Hoogste 1X2-quotering van een wedstrijd (0 als er geen h2h-markt is) — voor sortering op "hoogste odds". */
export function bestH2hPrice(normalized) {
  const q = h2hQuickOdds(normalized)
  if (!q) return 0
  return Math.max(q.home?.price || 0, q.draw?.price || 0, q.away?.price || 0)
}

/**
 * Markeer per uitkomst of de prijs gestegen/gedaald is t.o.v. de vorige
 * fetch ('up' | 'down' | null), door te vergelijken met `priceHistory`
 * (Map eventId -> Map outcomeId -> price). `priceHistory` wordt in-place
 * bijgewerkt met de nieuwe prijzen, zodat de volgende fetch weer kan
 * vergelijken. Puur client-side (geen odds-geschiedenis op de server).
 */
export function withPriceMoves(events, priceHistory) {
  return events.map((ev) => {
    const prevOutcomes = priceHistory.get(ev.id)
    const markets = ev.markets.map((m) => ({
      ...m,
      outcomes: m.outcomes.map((o) => {
        const prevPrice = prevOutcomes?.get(o.id)
        const move = prevPrice == null || prevPrice === o.price ? null : o.price > prevPrice ? 'up' : 'down'
        return { ...o, move }
      }),
    }))
    priceHistory.set(ev.id, new Map(markets.flatMap((m) => m.outcomes.map((o) => [o.id, o.price]))))
    return { ...ev, markets }
  })
}
