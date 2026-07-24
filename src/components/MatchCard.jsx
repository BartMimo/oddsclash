import { useState } from 'react'
import { ChevronRight, ChevronDown, Lock, ArrowUp, ArrowDown } from 'lucide-react'
import TeamBadge from './TeamBadge'
import MarketGroup from './MarketGroup'
import { fmt, formatKickoff, hasStarted, isLive, isFinished } from '../lib/format'
import { h2hQuickOdds, marketCount, marketLabel } from '../lib/markets'
import { useStore } from '../store'

// Klein pijltje als de odds sinds de vorige fetch gestegen/gedaald zijn.
function MoveIndicator({ move }) {
  if (!move) return null
  const Icon = move === 'up' ? ArrowUp : ArrowDown
  return <Icon size={9} className={move === 'up' ? 'text-brand' : 'text-loss'} />
}

// Compacte odds-chip voor de 1X2 quick-odds op de kaart.
// Direct klikbaar: voegt de selectie toe aan de bet slip (zonder naar
// de detailpagina te navigeren).
function QuickOdds({ label, outcome, active, closed, onSelect }) {
  if (!outcome) {
    return (
      <div className="flex-1 rounded-lg bg-slate-900/60 border border-slate-700/40 py-1.5 text-center">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-xs text-slate-600 nums">–</div>
      </div>
    )
  }
  return (
    <button
      type="button"
      disabled={closed}
      onClick={(e) => {
        e.stopPropagation() // niet de detailpagina openen
        onSelect(outcome)
      }}
      className={`flex-1 rounded-lg border py-1.5 text-center transition ${
        active
          ? 'bg-brand/15 border-brand text-brand'
          : 'bg-slate-900/60 border-slate-700/40 hover:border-slate-500'
      } ${closed ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-xs nums flex items-center justify-center gap-0.5 ${active ? 'text-brand' : 'text-slate-200'}`}>
        {fmt(outcome.price)}
        <MoveIndicator move={outcome.move} />
      </div>
    </button>
  )
}

export default function MatchCard({ event, onOpen }) {
  const selection = useStore((s) => s.selections[event.id])
  const toggleSelection = useStore((s) => s.toggleSelection)
  const [expanded, setExpanded] = useState(false)
  const quick = h2hQuickOdds(event)
  const count = marketCount(event)
  const extra = Math.max(0, count - 1) // markten naast 1X2
  const closed = hasStarted(event.commenceTime)
  const live = isLive(event.commenceTime)
  const finished = isFinished(event.commenceTime)
  const otherMarkets = event.markets.filter((m) => m.key !== 'h2h' && m.key !== 'h2h_3_way')

  function handleSelect(market, outcome) {
    toggleSelection({
      eventId: event.id,
      sportKey: event.sportKey,
      sportTitle: event.sportTitle,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      commenceTime: event.commenceTime,
      marketKey: market.key,
      marketLabel: market.label,
      derivable: market.derivable,
      outcomeId: outcome.id,
      outcomeName: outcome.name,
      outcomeLabel: outcome.label,
      point: outcome.point,
      description: outcome.description,
      price: outcome.price,
      bookmaker: outcome.bookmaker,
    })
  }

  function selectQuick(outcome) {
    // 1X2 is altijd afleidbaar uit de eindstand.
    handleSelect({ key: quick.marketKey, label: marketLabel(quick.marketKey), derivable: true }, outcome)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(event)
        }
      }}
      className="w-full text-left bg-slate-800 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 transition group cursor-pointer outline-none focus-visible:border-brand/60"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-slate-400 bg-slate-900/60 rounded-full px-2 py-0.5">
          {event.sportTitle}
        </span>
        <span className={`text-[11px] flex items-center gap-1 ${live ? 'text-loss' : finished ? 'text-slate-500' : 'text-slate-400'}`}>
          {live && (
            <span className="relative flex h-1.5 w-1.5 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-loss opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-loss" />
            </span>
          )}
          {!live && closed && <Lock size={11} />}
          {live ? 'Live' : finished ? 'Afgelopen' : formatKickoff(event.commenceTime)}
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2.5">
          <TeamBadge name={event.homeTeam} size="sm" />
          <span className="text-sm font-medium truncate">{event.homeTeam}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <TeamBadge name={event.awayTeam} size="sm" />
          <span className="text-sm font-medium truncate">{event.awayTeam}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <QuickOdds
          label="1"
          outcome={quick?.home}
          active={selection?.marketKey === quick?.marketKey && selection?.outcomeName === event.homeTeam}
          closed={closed}
          onSelect={selectQuick}
        />
        <QuickOdds
          label="X"
          outcome={quick?.draw}
          active={selection?.marketKey === quick?.marketKey && selection?.outcomeName === 'Draw'}
          closed={closed}
          onSelect={selectQuick}
        />
        <QuickOdds
          label="2"
          outcome={quick?.away}
          active={selection?.marketKey === quick?.marketKey && selection?.outcomeName === event.awayTeam}
          closed={closed}
          onSelect={selectQuick}
        />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/40">
        <button
          type="button"
          disabled={otherMarkets.length === 0}
          onClick={(e) => {
            e.stopPropagation() // niet de detailpagina openen
            setExpanded((v) => !v)
          }}
          className="text-[11px] text-slate-400 hover:text-slate-200 transition disabled:opacity-50 disabled:cursor-default flex items-center gap-1"
        >
          {extra > 0 ? `+${extra} ${extra === 1 ? 'markt' : 'markten'}` : `${count} ${count === 1 ? 'markt' : 'markten'}`}
          {otherMarkets.length > 0 && (
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          )}
        </button>
        <span className="text-xs text-brand flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
          Bekijk <ChevronRight size={14} />
        </span>
      </div>

      {expanded && otherMarkets.length > 0 && (
        <div className="mt-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
          {otherMarkets.map((market) => (
            <MarketGroup
              key={market.key}
              market={market}
              defaultOpen={false}
              selection={selection}
              disabled={closed}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
