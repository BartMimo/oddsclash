import { useEffect } from 'react'
import { X, Trophy, LogOut } from 'lucide-react'
import TeamBadge from './TeamBadge'
import { fmt } from '../lib/format'
import { useStore, selectStats, selectBestBet, selectLeaderboard } from '../store'

function Stat({ label, value, color = 'text-slate-100' }) {
  return (
    <div className="bg-slate-900/60 rounded-xl px-3 py-2.5 text-center">
      <div className={`text-base nums ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function ProfileModal({ playerId, onClose }) {
  const board = useStore(selectLeaderboard)
  const player = board.find((p) => p.id === playerId) || null
  const bets = useStore((s) => s.bets)
  const stats = useStore(selectStats)
  const bestBet = useStore(selectBestBet)
  const signOutUser = useStore((s) => s.signOutUser)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!player) return null
  const isMe = player.isMe

  // Voor de lokale speler: echte stats; voor mock-spelers hun vaste waarden.
  const s = isMe
    ? stats
    : { totalBets: player.totalBets, wins: player.wins, losses: player.losses, winRate: player.totalBets ? Math.round((player.wins / (player.wins + player.losses || 1)) * 100) : 0 }

  const recent = isMe ? bets.slice(0, 3) : []

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-slate-900 border-t md:border border-slate-700/60 md:rounded-2xl rounded-t-2xl max-h-[88vh] overflow-y-auto animate-slide-up">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 z-10">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="p-5 flex items-center gap-4 border-b border-slate-700/50">
          <TeamBadge name={player.name} color={player.color} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{player.name}</h3>
              {isMe && <span className="text-[10px] bg-brand/15 text-brand rounded-full px-2 py-0.5">Jij</span>}
            </div>
            <div className="text-sm text-gold nums mt-0.5">{fmt(player.credits)} credits</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Bets" value={s.totalBets} />
            <Stat label="Winst" value={s.wins} color="text-brand" />
            <Stat label="Verlies" value={s.losses} color="text-loss" />
            <Stat label="Win-rate" value={`${s.winRate}%`} color="text-gold" />
          </div>

          {/* Best Bet Highlight */}
          {isMe && bestBet && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gold mb-2">
                <Trophy size={14} /> Best Bet
              </div>
              <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-400">
                    {bestBet.type === 'combi' ? `Combi (${bestBet.legs.length})` : 'Enkel'}
                  </span>
                  <span className="text-xs nums text-gold">Odds {fmt(bestBet.totalOdds)}</span>
                </div>
                <div className="space-y-0.5 mb-3">
                  {bestBet.legs.map((leg) => (
                    <div key={leg.id} className="text-sm font-medium truncate">
                      {leg.outcomeLabel}
                      <span className="text-slate-500 font-normal text-xs"> · {leg.homeTeam.split(' ')[0]}–{leg.awayTeam.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gold/20 pt-2.5">
                  <span className="text-slate-400 text-xs">Inzet {fmt(bestBet.stake)}</span>
                  <span className="nums text-brand">Nettowinst +{fmt(bestBet.payout - bestBet.stake)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Laatste 3 bets (alleen lokale speler) */}
          {isMe && recent.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">Laatste bets</div>
              <div className="space-y-1.5">
                {recent.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{bet.legs[0].outcomeLabel}{bet.legs.length > 1 ? ` +${bet.legs.length - 1}` : ''}</div>
                      <div className="text-[10px] text-slate-500">Inzet {fmt(bet.stake)} · Odds {fmt(bet.totalOdds)}</div>
                    </div>
                    <span className={`text-[11px] font-medium shrink-0 ${bet.status === 'won' ? 'text-brand' : bet.status === 'lost' ? 'text-loss' : 'text-gold'}`}>
                      {bet.status === 'won' ? 'Gewonnen' : bet.status === 'lost' ? 'Verloren' : 'Lopend'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isMe && (
            <p className="text-xs text-slate-500 text-center">Mede-speler in OddsClash.</p>
          )}

          {isMe && (
            <button
              onClick={() => { signOutUser(); onClose() }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-loss hover:text-white hover:bg-loss/20 border border-loss/30 rounded-xl py-2.5 transition"
            >
              <LogOut size={15} /> Uitloggen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
