import { useState, useEffect } from 'react'
import { Receipt, X, Trash2, Plus } from 'lucide-react'
import { useStore } from '../store'
import { fmt, hasStarted } from '../lib/format'

export default function BetSlip() {
  const selections = useStore((s) => s.selections)
  const balance = useStore((s) => s.balance)
  const removeSelection = useStore((s) => s.removeSelection)
  const clearSelections = useStore((s) => s.clearSelections)
  const placeBet = useStore((s) => s.placeBet)

  const legs = Object.values(selections)
  const [open, setOpen] = useState(false)
  const [stake, setStake] = useState('10')

  // Sluit de drawer automatisch als er geen selecties meer zijn.
  useEffect(() => {
    if (legs.length === 0) setOpen(false)
  }, [legs.length])

  const isCombi = legs.length > 1
  const totalOdds = legs.reduce((acc, l) => acc * Number(l.price), 1)
  const amount = Number(stake)
  const validAmount = Number.isFinite(amount) && amount >= 1 && amount <= balance
  const anyClosed = legs.some((l) => hasStarted(l.commenceTime))
  const potentialPayout = validAmount ? amount * totalOdds : 0
  const netProfit = potentialPayout - (validAmount ? amount : 0)

  function addStake(n) {
    const next = Math.min(balance, (Number(stake) || 0) + n)
    setStake(String(Math.round(next * 100) / 100))
  }
  function setMax() {
    setStake(String(Math.floor(balance)))
  }

  function handlePlace() {
    if (placeBet(amount)) {
      setStake('10')
      setOpen(false)
    }
  }

  if (legs.length === 0) return null

  return (
    <>
      {/* Floating trigger met selectie-badge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 flex items-center gap-2 bg-brand hover:bg-brand-dark text-slate-950 font-semibold rounded-full pl-4 pr-3 py-3 shadow-xl shadow-brand/20 transition animate-scale-in"
        >
          <Receipt size={18} />
          <span className="text-sm">Bet slip</span>
          <span className="bg-slate-950 text-brand text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {legs.length}
          </span>
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="relative w-full md:max-w-md bg-slate-900 border-t md:border border-slate-700/60 md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-brand" />
                <span className="font-semibold text-sm">Bet slip</span>
                <span className="text-xs text-slate-400">
                  {isCombi ? `Combi (${legs.length})` : 'Enkelvoudig'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearSelections}
                  className="text-[11px] text-slate-400 hover:text-loss px-2 py-1 transition"
                >
                  Wis alles
                </button>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Legs */}
            <div className="overflow-y-auto px-4 py-3 space-y-2 flex-1">
              {legs.map((leg) => {
                const closed = hasStarted(leg.commenceTime)
                return (
                  <div
                    key={leg.eventId}
                    className="bg-slate-800 border border-slate-700/50 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 truncate">
                          {leg.homeTeam} — {leg.awayTeam}
                        </div>
                        <div className="text-sm font-medium truncate">{leg.outcomeLabel}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{leg.marketLabel}</div>
                        {closed && <div className="text-[11px] text-loss mt-0.5">Gesloten</div>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm nums text-brand">{fmt(leg.price)}</span>
                        <button
                          onClick={() => removeSelection(leg.eventId)}
                          className="text-slate-500 hover:text-loss transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {isCombi && (
                <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2.5 mt-1">
                  <span className="text-xs text-slate-400">Totale odds (combi)</span>
                  <span className="text-base nums text-brand">{fmt(totalOdds)}</span>
                </div>
              )}
            </div>

            {/* Inzet + uitbetaling */}
            <div className="border-t border-slate-700/50 px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-14 py-2.5 text-sm nums outline-none focus:border-brand transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    credits
                  </span>
                </div>
                <button onClick={() => addStake(10)} className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 hover:border-slate-500 transition">
                  +10
                </button>
                <button onClick={() => addStake(25)} className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 hover:border-slate-500 transition">
                  +25
                </button>
                <button onClick={setMax} className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 hover:border-slate-500 transition font-semibold">
                  MAX
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Potentiële uitbetaling</span>
                <span className="nums text-slate-100">{fmt(potentialPayout)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Nettowinst</span>
                <span className="nums text-brand">+{fmt(netProfit)}</span>
              </div>

              <button
                onClick={handlePlace}
                disabled={!validAmount || anyClosed}
                className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl py-3 text-sm transition flex items-center justify-center gap-1.5"
              >
                <Plus size={16} />
                {anyClosed
                  ? 'Selectie gesloten'
                  : !validAmount
                  ? amount > balance
                    ? 'Inzet > saldo'
                    : 'Voer inzet in (min. 1)'
                  : `Plaats ${isCombi ? 'combi' : 'weddenschap'} · ${fmt(amount)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
