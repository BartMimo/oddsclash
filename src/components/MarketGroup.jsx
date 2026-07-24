import { useState } from 'react'
import { ChevronDown, Info, ArrowUp, ArrowDown } from 'lucide-react'
import { fmt } from '../lib/format'

// Klein pijltje als de odds sinds de vorige fetch gestegen/gedaald zijn.
function MoveIndicator({ move }) {
  if (!move) return null
  const Icon = move === 'up' ? ArrowUp : ArrowDown
  return <Icon size={9} className={move === 'up' ? 'text-brand' : 'text-loss'} />
}

// ------------------------------------------------------------------
// MarketGroup — ÉÉN generiek component dat elke marktstructuur aankan:
// 2-weg, 3-weg, over/under-lijnen (point), spelersmarkten (description).
// De markt komt 1-op-1 uit de API-response; niets is hier hardcoded.
// ------------------------------------------------------------------

// Kies een grid-kolomaantal dat past bij het aantal uitkomsten.
function colsFor(n) {
  if (n === 2) return 'grid-cols-2'
  if (n % 3 === 0) return 'grid-cols-3'
  if (n % 2 === 0) return 'grid-cols-2'
  return 'grid-cols-2 sm:grid-cols-3'
}

function OddsButton({ outcome, active, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'bg-brand/15 border-brand text-brand shadow-[0_0_0_1px_rgba(16,185,129,0.4)]'
          : 'bg-slate-900/70 border-slate-700/50 hover:border-slate-500 text-slate-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate">{outcome.label}</span>
        <span className={`text-sm nums shrink-0 flex items-center gap-0.5 ${active ? 'text-brand' : 'text-slate-100'}`}>
          {fmt(outcome.price)}
          <MoveIndicator move={outcome.move} />
        </span>
      </div>
      {outcome.bookmaker && (
        <div className="text-[10px] text-slate-500 mt-0.5 truncate">{outcome.bookmaker}</div>
      )}
    </button>
  )
}

export default function MarketGroup({ market, defaultOpen, selection, disabled, onSelect }) {
  const [open, setOpen] = useState(!!defaultOpen)

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{market.label}</span>
          {!market.derivable && (
            <span
              title="Niet automatisch af te wikkelen uit de eindstand — handmatige settlement via Dev Toolbar."
              className="text-gold"
            >
              <Info size={13} />
            </span>
          )}
          <span className="text-[11px] text-slate-500">{market.outcomes.length}</span>
        </div>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className={`grid gap-2 ${colsFor(market.outcomes.length)}`}>
            {market.outcomes.map((oc) => (
              <OddsButton
                key={oc.id}
                outcome={oc}
                active={selection?.outcomeId === oc.id}
                disabled={disabled}
                onClick={() => onSelect(market, oc)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
