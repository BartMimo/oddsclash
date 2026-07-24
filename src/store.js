// ------------------------------------------------------------------
// store.js — Centrale Zustand-store.
//
// Supabase is de bron van waarheid voor saldo, bets en leagues: de
// server (RPC's met SECURITY DEFINER + RLS) valideert en muteert,
// deze store leest de resultaten terug en houdt lokaal alleen de
// bet slip-selecties en de odds-demo-toggle bij (die horen niet bij
// een account).
// ------------------------------------------------------------------

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from './lib/toast'
import { fmt, startOfWeek } from './lib/format'
import { buildResultIndex } from './logic/settlement'
import {
  supabase,
  isSupabaseConfigured,
  onAuthChange,
  getSession,
  signOut as supabaseSignOut,
  fetchProfile,
  fetchBets,
  fetchProfileStats,
  fetchMyLeagues,
  placeBet as apiPlaceBet,
  settleOpenBets,
  forceBet as apiForceBet,
  manualSettleLeg as apiManualSettleLeg,
  resetAccount as apiResetAccount,
  createLeague as apiCreateLeague,
  joinLeague as apiJoinLeague,
  fetchLeagueActivity,
  fetchWeeklyLeaderboard,
} from './services/supabase'

const MAX_LEGS = 8

// ---------------- Mappers: DB (snake_case) -> UI (camelCase) ----------------

function mapLeg(l) {
  return {
    id: l.id,
    eventId: l.event_id,
    sportKey: l.sport_key,
    sportTitle: l.sport_title,
    homeTeam: l.home_team,
    awayTeam: l.away_team,
    commenceTime: l.commence_time,
    marketKey: l.market_key,
    marketLabel: l.market_label,
    outcomeId: l.outcome_id,
    outcomeName: l.outcome_name,
    outcomeLabel: l.outcome_label,
    point: l.point != null ? Number(l.point) : null,
    description: l.description,
    price: Number(l.price),
    bookmaker: l.bookmaker,
    derivable: l.derivable,
    status: l.status,
  }
}

function mapBet(b) {
  return {
    id: b.id,
    stake: Number(b.stake),
    totalOdds: Number(b.total_odds),
    type: b.type,
    status: b.status,
    payout: Number(b.payout),
    placedAt: b.placed_at ? new Date(b.placed_at).getTime() : null,
    settledAt: b.settled_at ? new Date(b.settled_at).getTime() : null,
    legs: (b.legs || []).map(mapLeg),
  }
}

/** Selectie (bet slip, camelCase) -> leg-payload voor de place_bet RPC. */
function selectionToLegPayload(sel) {
  return {
    event_id: sel.eventId,
    sport_key: sel.sportKey,
    sport_title: sel.sportTitle,
    home_team: sel.homeTeam,
    away_team: sel.awayTeam,
    commence_time: sel.commenceTime,
    market_key: sel.marketKey,
    market_label: sel.marketLabel,
    outcome_id: sel.outcomeId,
    outcome_name: sel.outcomeName,
    outcome_label: sel.outcomeLabel,
    point: sel.point ?? null,
    description: sel.description ?? null,
    price: sel.price,
    bookmaker: sel.bookmaker ?? null,
    derivable: sel.derivable ?? true,
  }
}

function friendlyRpcError(message = '') {
  const map = {
    'Geen selecties': 'Geen selecties.',
    'Maximaal 8 legs': `Maximaal ${MAX_LEGS} legs in een combi.`,
    'Minimale inzet is 1 credit': 'Minimale inzet is 1 credit.',
    'Max. 1 weddenschap per wedstrijd': 'Max. 1 weddenschap per wedstrijd.',
    'Een wedstrijd is al gestart (gesloten)': 'Een wedstrijd is al gestart (gesloten).',
    'Inzet is hoger dan je saldo': 'Inzet is hoger dan je saldo.',
    'Geen league gevonden met deze code': 'Geen league gevonden met deze code.',
  }
  return map[message] || message || 'Er ging iets mis. Probeer het opnieuw.'
}

export const useStore = create(
  persist(
    (set, get) => ({
      // ---------------- Auth / cloud state (niet gepersisteerd) ----------------
      authLoading: true,
      session: null,
      profile: null, // { id, username, avatarColor, balance }
      balance: 0, // spiegel van profile.balance, voor makkelijke component-toegang
      bets: [],
      leaderboard: [],
      myLeagues: [],
      leagueActivity: {}, // leagueId -> array van recente bets (leden-activiteit)
      leagueActivityLoading: {}, // leagueId -> bool
      weeklyLeaderboard: [],
      weeklyLeaderboardLoading: false,

      // ---------------- Lokaal (bet slip + odds-demo, wél gepersisteerd) ----------------
      selections: {},
      demoManual: false,

      // ---------------- Runtime odds-status (niet gepersisteerd) ----------------
      demoMode: false,
      demoReason: null,
      quotaRemaining: null,
      quotaUsed: null,

      // ================= Auth lifecycle =================
      async initAuth() {
        if (!isSupabaseConfigured) {
          set({ authLoading: false })
          return
        }
        const session = await getSession()
        set({ session })
        if (session) await get().refreshAll()
        set({ authLoading: false })

        onAuthChange((session) => {
          const hadSession = !!get().session
          set({ session })
          if (session && !hadSession) {
            get().refreshAll()
          } else if (!session) {
            set({ profile: null, balance: 0, bets: [], leaderboard: [], myLeagues: [] })
          }
        })
      },

      async signOutUser() {
        try {
          await supabaseSignOut()
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      // ================= Data ophalen =================
      async refreshProfile() {
        const uid = get().session?.user?.id
        if (!uid) return
        try {
          const p = await fetchProfile(uid)
          set({
            profile: { id: p.id, username: p.username, avatarColor: p.avatar_color, balance: Number(p.balance) },
            balance: Number(p.balance),
          })
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async refreshBets() {
        const uid = get().session?.user?.id
        if (!uid) return
        try {
          const rows = await fetchBets(uid)
          set({ bets: rows.map(mapBet) })
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async refreshLeaderboard() {
        try {
          const rows = await fetchProfileStats()
          const uid = get().session?.user?.id
          const board = rows
            .map((r) => ({
              id: r.id,
              name: r.username,
              color: r.avatar_color,
              credits: Number(r.balance),
              totalBets: r.total_bets,
              wins: r.wins,
              losses: r.losses,
              isMe: r.id === uid,
            }))
            .sort((a, b) => b.credits - a.credits)
          set({ leaderboard: board })
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async refreshWeeklyLeaderboard() {
        set({ weeklyLeaderboardLoading: true })
        try {
          const since = startOfWeek().toISOString()
          const rows = await fetchWeeklyLeaderboard(since)
          const uid = get().session?.user?.id
          const board = rows.map((r) => ({
            id: r.user_id,
            name: r.username,
            color: r.avatar_color,
            net: Number(r.net),
            betsSettled: r.bets_settled,
            isMe: r.user_id === uid,
          }))
          set({ weeklyLeaderboard: board })
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        } finally {
          set({ weeklyLeaderboardLoading: false })
        }
      },

      async refreshLeagues() {
        const uid = get().session?.user?.id
        if (!uid) return
        try {
          const rows = await fetchMyLeagues()
          const leagues = rows.map((lg) => ({
            id: lg.id,
            name: lg.name,
            code: lg.code,
            isOwner: lg.owner_id === uid,
            memberIds: (lg.members || []).map((m) => m.user_id),
          }))
          set({ myLeagues: leagues })
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async loadLeagueActivity(leagueId) {
        set((s) => ({ leagueActivityLoading: { ...s.leagueActivityLoading, [leagueId]: true } }))
        try {
          const rows = await fetchLeagueActivity(leagueId)
          const activity = rows.map((r) => ({
            betId: r.bet_id,
            userId: r.user_id,
            username: r.username,
            avatarColor: r.avatar_color,
            type: r.type,
            stake: Number(r.stake),
            totalOdds: Number(r.total_odds),
            status: r.status,
            payout: Number(r.payout),
            placedAt: r.placed_at ? new Date(r.placed_at).getTime() : null,
            legs: r.legs || [],
          }))
          set((s) => ({ leagueActivity: { ...s.leagueActivity, [leagueId]: activity } }))
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        } finally {
          set((s) => ({ leagueActivityLoading: { ...s.leagueActivityLoading, [leagueId]: false } }))
        }
      },

      async refreshAll() {
        await Promise.all([
          get().refreshProfile(),
          get().refreshBets(),
          get().refreshLeaderboard(),
          get().refreshLeagues(),
        ])
      },

      // ================= Runtime odds-status =================
      setRuntime(patch) {
        set(patch)
      },
      toggleDemoManual() {
        set((s) => ({ demoManual: !s.demoManual }))
      },

      // ================= Bet slip / selecties (lokaal) =================
      toggleSelection(sel) {
        const selections = { ...get().selections }
        const existing = selections[sel.eventId]

        if (existing && existing.outcomeId === sel.outcomeId) {
          delete selections[sel.eventId]
          set({ selections })
          return { action: 'removed' }
        }

        if (!existing) {
          const count = Object.keys(selections).length
          if (count >= MAX_LEGS) {
            toast.error(`Maximaal ${MAX_LEGS} legs in een combi.`)
            return { action: 'rejected' }
          }
          selections[sel.eventId] = sel
          set({ selections })
          return { action: 'added' }
        }

        selections[sel.eventId] = sel
        set({ selections })
        toast.info('Selectie vervangen — maximaal 1 weddenschap per wedstrijd.')
        return { action: 'replaced' }
      },

      removeSelection(eventId) {
        const selections = { ...get().selections }
        delete selections[eventId]
        set({ selections })
      },

      clearSelections() {
        set({ selections: {} })
      },

      // ================= Bet plaatsen (server-RPC) =================
      async placeBet(stake) {
        const legs = Object.values(get().selections)
        if (legs.length === 0) {
          toast.error('Geen selecties.')
          return false
        }
        const amount = Number(stake)
        if (!Number.isFinite(amount) || amount < 1) {
          toast.error('Minimale inzet is 1 credit.')
          return false
        }
        try {
          await apiPlaceBet(amount, legs.map(selectionToLegPayload))
          set({ selections: {} })
          await Promise.all([get().refreshProfile(), get().refreshBets(), get().refreshLeaderboard()])
          toast.success('Weddenschap geplaatst! ✅')
          return true
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
          return false
        }
      },

      // ================= Settlement (server-RPC) =================
      // scores = raw response van de /scores-odds-endpoint (of mock-scores).
      async settleBets(scores) {
        const resultIndex = buildResultIndex(scores)
        if (resultIndex.size === 0) return 0
        const results = [...resultIndex.entries()].map(([eventId, r]) => ({
          event_id: eventId,
          home_goals: r.homeGoals,
          away_goals: r.awayGoals,
        }))
        const betsBefore = get().bets.filter((b) => b.status === 'open')
        try {
          await settleOpenBets(results)
          await Promise.all([get().refreshProfile(), get().refreshBets(), get().refreshLeaderboard()])
          const bets = get().bets
          const settled = betsBefore
            .map((before) => bets.find((b) => b.id === before.id))
            .filter((b) => b && b.status !== 'open')

          // Eén toast per afgewikkelde bet i.p.v. één samengevatte toast —
          // zo zie je direct welke wedstrijd(en) je won/verloor.
          for (const bet of settled) {
            const label =
              bet.legs.length > 1
                ? `Combi (${bet.legs.length} legs)`
                : `${bet.legs[0].homeTeam} — ${bet.legs[0].awayTeam}`
            if (bet.status === 'won') {
              toast.success(`${label}: gewonnen · +${fmt(bet.payout)} cr`)
            } else if (bet.status === 'lost') {
              toast.error(`${label}: verloren · −${fmt(bet.stake)} cr`)
            }
          }
          return settled.length
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
          return 0
        }
      },

      // ================= Dev Toolbar =================
      async manualSettleLeg(betId, legId, status) {
        try {
          await apiManualSettleLeg(betId, legId, status)
          await Promise.all([get().refreshProfile(), get().refreshBets(), get().refreshLeaderboard()])
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async forceResult(betId, win) {
        try {
          await apiForceBet(betId, win)
          await Promise.all([get().refreshProfile(), get().refreshBets(), get().refreshLeaderboard()])
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async forceNewestOpen(win) {
        const open = get().bets.find((b) => b.status === 'open')
        if (!open) {
          toast.error('Geen open bets.')
          return
        }
        await get().forceResult(open.id, win)
        toast[win ? 'success' : 'info'](win ? 'Bet geforceerd gewonnen.' : 'Bet geforceerd verloren.')
      },

      async simulateNextResult() {
        const openBets = get().bets.filter((b) => b.status === 'open')
        if (openBets.length === 0) {
          toast.error('Geen open bets om te simuleren.')
          return
        }
        let chosen = null
        for (const bet of openBets) {
          for (const leg of bet.legs) {
            if (leg.status && leg.status !== 'pending') continue
            if (!chosen || new Date(leg.commenceTime) < new Date(chosen.commenceTime)) chosen = leg
          }
        }
        if (!chosen) {
          toast.error('Geen open legs om te simuleren.')
          return
        }

        const homeGoals = Math.floor(Math.random() * 4)
        const awayGoals = Math.floor(Math.random() * 4)
        const openIdsBefore = openBets.map((b) => b.id)

        try {
          // Afleidbare legs voor deze wedstrijd (over alle open bets).
          await settleOpenBets([{ event_id: chosen.eventId, home_goals: homeGoals, away_goals: awayGoals }])

          // Niet-afleidbare legs (spelersmarkten) voor dezelfde wedstrijd: muntworp.
          const manualTargets = []
          for (const bet of openBets) {
            for (const leg of bet.legs) {
              if (leg.eventId !== chosen.eventId) continue
              if (leg.derivable) continue
              if (leg.status && leg.status !== 'pending') continue
              manualTargets.push({ betId: bet.id, legId: leg.id })
            }
          }
          await Promise.all(
            manualTargets.map((t) =>
              apiManualSettleLeg(t.betId, t.legId, Math.random() < 0.5 ? 'won' : 'lost')
            )
          )

          await Promise.all([get().refreshProfile(), get().refreshBets(), get().refreshLeaderboard()])
          const bets = get().bets
          const count = openIdsBefore.filter((id) => bets.find((b) => b.id === id)?.status !== 'open').length
          toast.success(
            `${chosen.homeTeam} ${homeGoals}–${awayGoals} ${chosen.awayTeam} · ${count} bet(s) gesetteld.`
          )
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async reset() {
        try {
          await apiResetAccount()
          await Promise.all([get().refreshProfile(), get().refreshBets(), get().refreshLeaderboard()])
          set({ selections: {} })
          toast.info('Gereset naar 1000 credits.')
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      // ================= Leagues (server-RPC) =================
      async createLeague(name) {
        if (!name.trim()) return
        try {
          const league = await apiCreateLeague(name.trim())
          await get().refreshLeagues()
          toast.success(`League "${league.name}" aangemaakt.`)
          return league
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
        }
      },

      async joinLeague(code) {
        const clean = code.trim().toUpperCase()
        if (!/^[A-Z]{2}-\d{4}$/.test(clean)) {
          toast.error('Ongeldige code. Formaat: XX-0000.')
          return false
        }
        try {
          const league = await apiJoinLeague(clean)
          await get().refreshLeagues()
          toast.success(`Toegetreden tot "${league.name}".`)
          return true
        } catch (err) {
          toast.error(friendlyRpcError(err.message))
          return false
        }
      },
    }),
    {
      name: 'oddsclash:local',
      version: 2,
      // Alleen lokale, niet-gevoelige UI-state persisteren. Saldo/bets/
      // leagues komen bij elke load vers van Supabase (server = bron van waarheid).
      partialize: (s) => ({ selections: s.selections, demoManual: s.demoManual }),
    }
  )
)

// ---------------- Selectors / afgeleide data ----------------

/** Statistieken van de lokale speler uit de bets. */
export function selectStats(state) {
  const settled = state.bets.filter((b) => b.status === 'won' || b.status === 'lost')
  const wins = settled.filter((b) => b.status === 'won').length
  const losses = settled.filter((b) => b.status === 'lost').length
  const winRate = settled.length ? Math.round((wins / settled.length) * 100) : 0
  return { totalBets: state.bets.length, wins, losses, winRate, settled: settled.length }
}

/** Beste gewonnen bet (hoogste nettowinst) van de lokale speler. */
export function selectBestBet(state) {
  const won = state.bets.filter((b) => b.status === 'won')
  if (won.length === 0) return null
  return won.reduce((best, b) => {
    const net = b.payout - b.stake
    const bestNet = best ? best.payout - best.stake : -Infinity
    return net > bestNet ? b : best
  }, null)
}

/** Globale ranglijst (uit Supabase profile_stats). */
export function selectLeaderboard(state) {
  return state.leaderboard
}

/** Vind een speler op id. */
export function selectPlayer(state, id) {
  return state.leaderboard.find((p) => p.id === id) || null
}
