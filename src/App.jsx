import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Zap, Trophy, Receipt, ClipboardList, RefreshCcw, Loader2, WifiOff, AlertCircle, AlertTriangle,
  Search, X, Clock, TrendingUp, Sun, Moon,
} from 'lucide-react'
import { useStore } from './store'
import { isSupabaseConfigured } from './services/supabase'
import {
  fetchSports, fetchOdds, fetchScores, getQuota, hasApiKey, minutesUntilStale,
} from './services/oddsApi'
import { normalizeEvent, bestH2hPrice, withPriceMoves } from './lib/markets'
import { fmt, isToday, isTomorrow } from './lib/format'
import { toast } from './lib/toast'
import { getInitialTheme, applyTheme } from './lib/theme'

import Onboarding from './components/Onboarding'
import MatchCard from './components/MatchCard'
import MatchDetail from './components/MatchDetail'
import BetSlip from './components/BetSlip'
import MyBets from './components/MyBets'
import Leaderboard from './components/Leaderboard'
import ProfileModal from './components/ProfileModal'
import DevToolbar from './components/DevToolbar'
import Toaster from './components/Toaster'
import TeamBadge from './components/TeamBadge'
import SportPills from './components/SportPills'

const NAV = [
  { id: 'matches', label: 'Wedstrijden', icon: Zap },
  { id: 'bets', label: 'Mijn bets', icon: Receipt },
  { id: 'leaderboard', label: 'Ranglijst', icon: Trophy },
]

// Filtert op team-naam (zoekbalk boven de wedstrijdenlijst).
function matchesSearch(ev, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return ev.homeTeam.toLowerCase().includes(q) || ev.awayTeam.toLowerCase().includes(q)
}

// Sorteert op aftrap-tijd (oplopend) of op hoogste 1X2-quotering (aflopend).
function sortEvents(list, sortBy) {
  const sorted = [...list]
  if (sortBy === 'odds') sorted.sort((a, b) => bestH2hPrice(b) - bestH2hPrice(a))
  else sorted.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime))
  return sorted
}

// Balans-badge die kort animeert bij verandering.
function BalanceBadge({ balance }) {
  const [pop, setPop] = useState(false)
  const prev = useRef(balance)
  useEffect(() => {
    if (prev.current !== balance) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 400)
      prev.current = balance
      return () => clearTimeout(t)
    }
  }, [balance])
  return (
    <span className={`flex items-center gap-1.5 bg-gold/10 border border-gold/30 text-gold rounded-full px-3 py-1.5 ${pop ? 'animate-pop' : ''}`}>
      <span className="text-sm nums">{fmt(balance)}</span>
      <span className="text-[10px] opacity-70">cr</span>
    </span>
  )
}

export default function App() {
  const authLoading = useStore((s) => s.authLoading)
  const session = useStore((s) => s.session)
  const profile = useStore((s) => s.profile)
  const balance = useStore((s) => s.balance)
  const bets = useStore((s) => s.bets)
  const demoManual = useStore((s) => s.demoManual)
  const demoMode = useStore((s) => s.demoMode)
  const demoReason = useStore((s) => s.demoReason)
  const setRuntime = useStore((s) => s.setRuntime)
  const settleBets = useStore((s) => s.settleBets)
  const initAuth = useStore((s) => s.initAuth)
  const signOutUser = useStore((s) => s.signOutUser)

  const [tab, setTab] = useState('matches')
  const [sports, setSports] = useState([])
  const [activeSport, setActiveSport] = useState(null)
  const [events, setEvents] = useState([])
  const [dateFilter, setDateFilter] = useState(null) // null | 'today' | 'tomorrow'
  const [groupedEvents, setGroupedEvents] = useState([]) // [{ sportKey, sportTitle, events }]
  const [groupedLoading, setGroupedLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [settling, setSettling] = useState(false)
  const [error, setError] = useState(null)
  const [profileId, setProfileId] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('time') // 'time' | 'odds'
  const [theme, setTheme] = useState(getInitialTheme)
  const didInit = useRef(false)
  const didInitAuth = useRef(false)
  const priceHistory = useRef(new Map()) // eventId -> Map(outcomeId -> price), voor odds-bewegingspijltjes

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Eenmalig: Supabase-sessie ophalen + luisteren naar auth-wijzigingen.
  useEffect(() => {
    if (didInitAuth.current) return
    didInitAuth.current = true
    initAuth()
  }, [initAuth])

  // Werk runtime-status (demo/quota) bij na een fetch-resultaat.
  const syncRuntime = useCallback(
    (res) => {
      const q = getQuota()
      setRuntime({
        demoMode: res.demo,
        demoReason: res.error || null,
        quotaRemaining: q.remaining,
        quotaUsed: q.used,
      })
    },
    [setRuntime]
  )

  // Laad competities + eerste odds.
  const loadSports = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchSports({ demoOverride: demoManual })
    syncRuntime(res)
    setSports(res.data)
    const first = res.data[0]?.key || null
    setActiveSport((cur) => cur || first)
    setLoading(false)
    return res.data
  }, [demoManual, syncRuntime])

  // Laad odds voor een competitie (cache-bewust).
  const loadOdds = useCallback(
    async (sportKey, { force = false } = {}) => {
      if (!sportKey) return
      const res = await fetchOdds(sportKey, { force, demoOverride: demoManual })
      syncRuntime(res)
      if (res.error && !res.demo) setError(res.error)
      // De /odds-endpoint levert zijn eigen (vaak Engelse/cryptische)
      // sport_title per event — overschrijf die met onze nette titel uit
      // de /sports-lijst, zodat "EPL" nergens meer verschijnt.
      const niceTitle = sports.find((s) => s.key === sportKey)?.title
      const normalized = res.data.map(normalizeEvent).map((ev) => (niceTitle ? { ...ev, sportTitle: niceTitle } : ev))
      setEvents(withPriceMoves(normalized, priceHistory.current))
    },
    [demoManual, syncRuntime, sports]
  )

  // Laad odds voor ALLE competities en groepeer op vandaag/morgen — voor
  // de "Vandaag"/"Morgen"-tabs, die competitie-overstijgend wedstrijden tonen.
  const loadGroupedOdds = useCallback(
    async (filter) => {
      if (!sports.length) return
      setGroupedLoading(true)
      const perSport = await Promise.all(
        sports.map(async (s) => {
          const res = await fetchOdds(s.key, { demoOverride: demoManual })
          syncRuntime(res)
          return res.data.map(normalizeEvent).map((ev) => ({ ...ev, sportTitle: s.title }))
        })
      )
      const dayCheck = filter === 'tomorrow' ? isTomorrow : isToday
      const matches = withPriceMoves(perSport.flat(), priceHistory.current)
        .filter((ev) => dayCheck(ev.commenceTime))
        .sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime))

      const bySport = new Map()
      for (const ev of matches) {
        if (!bySport.has(ev.sportKey)) {
          bySport.set(ev.sportKey, { sportKey: ev.sportKey, sportTitle: ev.sportTitle, events: [] })
        }
        bySport.get(ev.sportKey).events.push(ev)
      }
      // Volgorde van de competitie-lijst aanhouden i.p.v. alfabetisch.
      setGroupedEvents(sports.map((s) => bySport.get(s.key)).filter(Boolean))
      setGroupedLoading(false)
    },
    [sports, demoManual, syncRuntime]
  )

  // Settlement: haal scores + wikkel open bets af.
  const runSettlement = useCallback(async () => {
    const keys = (sports.length ? sports : []).map((s) => s.key)
    if (keys.length === 0) return
    setSettling(true)
    const res = await fetchScores(keys, { demoOverride: demoManual })
    const count = await settleBets(res.data)
    setSettling(false)
    return count
  }, [sports, demoManual, settleBets])

  // Init bij eerste render (alleen als ingelogd).
  useEffect(() => {
    if (!session || didInit.current) return
    didInit.current = true
    loadSports()
  }, [session, loadSports])

  // Herlaad bij wissel Demo Mode.
  useEffect(() => {
    if (!session || !didInit.current) return
    setSelectedEvent(null)
    loadSports().then(() => {
      // activeSport blijft; odds worden hieronder herladen.
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoManual])

  // Laad odds telkens de actieve competitie wijzigt.
  useEffect(() => {
    if (activeSport) {
      setLoading(true)
      loadOdds(activeSport).finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSport])

  // Laad de gegroepeerde lijst zodra "Vandaag"/"Morgen" actief is (of
  // opnieuw als de competitielijst wijzigt, bv. bij een Demo Mode-switch).
  useEffect(() => {
    if (dateFilter) loadGroupedOdds(dateFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, sports])

  function selectSport(key) {
    setDateFilter(null)
    setActiveSport(key)
  }

  function selectDateFilter(filter) {
    setDateFilter((cur) => (cur === filter ? null : filter))
  }

  // Zoeken (teamnaam) + sorteren toepassen op de actief getoonde lijst(en).
  const filteredEvents = useMemo(
    () => sortEvents(events.filter((ev) => matchesSearch(ev, search)), sortBy),
    [events, search, sortBy]
  )
  const filteredGroupedEvents = useMemo(
    () =>
      groupedEvents
        .map((g) => ({ ...g, events: sortEvents(g.events.filter((ev) => matchesSearch(ev, search)), sortBy) }))
        .filter((g) => g.events.length > 0),
    [groupedEvents, search, sortBy]
  )

  // Settlement-check bij app-start (na laden competities).
  useEffect(() => {
    if (sports.length > 0) {
      runSettlement()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sports.length])

  async function handleRefresh(sportKey) {
    setRefreshing(true)
    const fresh = minutesUntilStale(`odds:${sportKey}`) > 0
    // Respecteer cache-TTL: alleen een nieuwe API-call als de cache verlopen is.
    await loadOdds(sportKey, { force: fresh ? false : true })
    // Herbouw het geselecteerde event met verse data.
    if (selectedEvent) {
      const updated = events.find((e) => e.id === selectedEvent.id)
      if (updated) setSelectedEvent(updated)
    }
    setRefreshing(false)
  }

  async function handleSettlement() {
    // Per-bet toasts komen al uit settleBets() zelf; hier alleen de
    // "niets nieuws"-melding als er echt niets is afgewikkeld.
    const count = await runSettlement()
    if (count === 0) toast.info('Geen nieuwe uitslagen om af te wikkelen.')
  }

  // Sync geselecteerd event met verse events-lijst.
  useEffect(() => {
    if (selectedEvent) {
      const updated = events.find((e) => e.id === selectedEvent.id)
      if (updated && updated !== selectedEvent) setSelectedEvent(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="max-w-sm text-center bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <AlertTriangle className="w-8 h-8 text-gold mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-1.5">Supabase niet geconfigureerd</h3>
          <p className="text-sm text-slate-400">
            Zet <code className="text-slate-300">VITE_SUPABASE_URL</code> en{' '}
            <code className="text-slate-300">VITE_SUPABASE_ANON_KEY</code> in je{' '}
            <code className="text-slate-300">.env</code>-bestand en herstart de dev-server.
          </p>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <Onboarding />
        <Toaster />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )
  }

  const openBets = bets.filter((b) => b.status === 'open')
  const gameOver = balance < 1 && openBets.length === 0

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => { setTab('matches'); setSelectedEvent(null) }}
            className="flex items-center gap-2 rounded-lg transition hover:opacity-80"
            title="Naar home"
          >
            <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-brand" size={18} />
            </div>
            <span className="font-bold tracking-tight hidden sm:inline">
              Odds<span className="text-brand">Clash</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <button
                  key={n.id}
                  onClick={() => { setTab(n.id); setSelectedEvent(null) }}
                  className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 transition ${
                    tab === n.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon size={15} /> {n.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Licht thema' : 'Donker thema'}
              className="flex items-center justify-center w-8 h-8 shrink-0 text-slate-300 hover:text-brand bg-slate-800 border border-slate-700/50 rounded-full transition"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={handleSettlement}
              disabled={settling}
              title="Uitslagen ophalen & bets afwikkelen"
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-brand bg-slate-800 border border-slate-700/50 rounded-full px-2.5 py-1.5 transition disabled:opacity-50"
            >
              {settling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              <span className="hidden sm:inline">Uitslagen</span>
            </button>
            <BalanceBadge balance={balance} />
            <button
              onClick={() => setProfileId(profile.id)}
              className="shrink-0"
              title="Mijn profiel"
            >
              <TeamBadge name={profile.username} color={profile.avatarColor} size="md" />
            </button>
          </div>
        </div>
      </header>

      {/* Demo Mode banner */}
      {demoMode && (
        <div className="bg-gold/10 border-b border-gold/20">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-start gap-2 text-xs text-gold">
            <WifiOff size={14} className="shrink-0 mt-0.5" />
            <span>
              <b>Demo Mode — mock-odds.</b>{' '}
              {demoManual
                ? 'Handmatig ingeschakeld via de Dev Toolbar.'
                : !hasApiKey()
                ? 'Geen odds API-key geconfigureerd op de server (gratis key via the-odds-api.com) voor live odds.'
                : demoReason
                ? `Live data niet beschikbaar (${demoReason}).`
                : 'Live data niet beschikbaar — fictieve odds inclusief spelersmarkten.'}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-24 md:pb-8">
        {gameOver && (
          <div className="mb-4 rounded-2xl border border-loss/40 bg-loss/10 p-5 text-center animate-scale-in">
            <AlertCircle className="w-8 h-8 text-loss mx-auto mb-2" />
            <h3 className="font-bold text-lg">Game Over</h3>
            <p className="text-sm text-slate-300 mt-1">
              Je credits zijn op en je hebt geen open bets meer. Reset via de Dev Toolbar om opnieuw te beginnen.
            </p>
          </div>
        )}

        {tab === 'matches' &&
          (selectedEvent ? (
            <MatchDetail
              event={selectedEvent}
              onBack={() => setSelectedEvent(null)}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              freshMins={activeSport ? minutesUntilStale(`odds:${activeSport}`) : 0}
            />
          ) : (
            <div className="animate-fade-in">
              {/* Competitie-filter (dynamisch uit /sports) + Vandaag/Morgen */}
              <SportPills
                sports={sports}
                activeSport={activeSport}
                onSelect={selectSport}
                dateFilter={dateFilter}
                onDateFilter={selectDateFilter}
              />

              {/* Zoeken op team + sorteren */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Zoek op team…"
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-full pl-8 pr-8 py-1.5 text-xs outline-none focus:border-brand transition"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1 bg-slate-800 border border-slate-700/50 rounded-full p-1 shrink-0">
                  <button
                    onClick={() => setSortBy('time')}
                    title="Sorteer op aftraptijd"
                    className={`flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-1 transition ${
                      sortBy === 'time' ? 'bg-brand/15 text-brand' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Clock size={12} /> Tijd
                  </button>
                  <button
                    onClick={() => setSortBy('odds')}
                    title="Sorteer op hoogste odds"
                    className={`flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-1 transition ${
                      sortBy === 'odds' ? 'bg-brand/15 text-brand' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <TrendingUp size={12} /> Odds
                  </button>
                </div>
              </div>

              {dateFilter ? (
                groupedLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-sm">Odds laden…</span>
                  </div>
                ) : filteredGroupedEvents.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-16">
                    {search
                      ? `Geen wedstrijden gevonden voor "${search}".`
                      : `Geen wedstrijden met odds ${dateFilter === 'tomorrow' ? 'morgen' : 'vandaag'}.`}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {filteredGroupedEvents.map((group) => (
                      <div key={group.sportKey}>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-0.5">
                          {group.sportTitle}
                        </h3>
                        <div className="space-y-2.5">
                          {group.events.map((ev) => (
                            <MatchCard key={ev.id} event={ev} onOpen={setSelectedEvent} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-sm">Odds laden…</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-16">
                  {search
                    ? `Geen wedstrijden gevonden voor "${search}".`
                    : 'Geen wedstrijden met odds voor deze competitie.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredEvents.map((ev) => (
                    <MatchCard key={ev.id} event={ev} onOpen={setSelectedEvent} />
                  ))}
                </div>
              )}
            </div>
          ))}

        {tab === 'bets' && <MyBets />}
        {tab === 'leaderboard' && <Leaderboard onPlayer={setProfileId} />}

        <p className="text-[10px] text-slate-700 text-center mt-8 mb-2">
          OddsClash gebruikt uitsluitend virtuele credits zonder geldwaarde — geen kansspel om geld. 18+.
        </p>
      </main>

      {/* Bottom nav (mobiel) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-800">
        <div className="max-w-2xl mx-auto flex">
          {NAV.map((n) => {
            const Icon = n.icon
            const active = tab === n.id
            return (
              <button
                key={n.id}
                onClick={() => { setTab(n.id); setSelectedEvent(null) }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition ${
                  active ? 'text-brand' : 'text-slate-500'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{n.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <BetSlip />
      <DevToolbar />
      <Toaster />
      {profileId && <ProfileModal playerId={profileId} onClose={() => setProfileId(null)} />}
    </div>
  )
}
