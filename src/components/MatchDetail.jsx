import { ArrowLeft, RefreshCw, Info, Lock } from 'lucide-react'
import TeamBadge from './TeamBadge'
import MarketGroup from './MarketGroup'
import { formatKickoff, hasStarted, isLive, isFinished } from '../lib/format'
import { useStore } from '../store'

export default function MatchDetail({ event, onBack, onRefresh, refreshing, freshMins }) {
  const selection = useStore((s) => s.selections[event.id])
  const toggleSelection = useStore((s) => s.toggleSelection)
  const closed = hasStarted(event.commenceTime)
  const live = isLive(event.commenceTime)
  const finished = isFinished(event.commenceTime)

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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition"
        >
          <ArrowLeft size={18} /> Terug
        </button>
        <button
          onClick={() => onRefresh(event.sportKey)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-brand bg-slate-800 border border-slate-700/50 rounded-full px-3 py-1.5 transition disabled:opacity-50"
          title={freshMins > 0 ? `Odds nog ${freshMins} min vers (cache)` : 'Ververs odds'}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Ververs odds
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4 mb-3">
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <TeamBadge name={event.homeTeam} size="lg" />
            <span className="text-sm font-semibold text-center leading-tight">{event.homeTeam}</span>
          </div>
          <span className="text-slate-500 text-xs font-medium">VS</span>
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <TeamBadge name={event.awayTeam} size="lg" />
            <span className="text-sm font-semibold text-center leading-tight">{event.awayTeam}</span>
          </div>
        </div>
      </div>

      {/* Hint: max 1 weddenschap per wedstrijd */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 mb-4">
        <Info size={13} className="text-brand shrink-0" />
        Max. 1 weddenschap per wedstrijd — een nieuwe keuze verplaatst je selectie.
      </div>

      {closed && (
        <div className="flex items-center gap-2 text-xs text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2 mb-4">
          <Lock size={13} />
          {live
            ? 'Deze wedstrijd is live — wedden is gesloten.'
            : 'Deze wedstrijd is afgelopen — wedden is gesloten.'}
        </div>
      )}

      {/* Dynamische markten: exact wat de API teruggeeft */}
      {event.markets.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-10">
          Geen markten beschikbaar voor deze wedstrijd.
        </div>
      ) : (
        <div className="space-y-2.5">
          {event.markets.map((market, i) => (
            <MarketGroup
              key={market.key}
              market={market}
              defaultOpen={i < 3}
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
