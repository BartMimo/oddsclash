import { useState } from 'react'
import {
  Settings, X, Gauge, FlaskConical, Dice5, TrendingUp, TrendingDown,
  RotateCcw, Check, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react'
import { useStore } from '../store'
import { hasApiKey } from '../services/oddsApi'
import { fmt } from '../lib/format'

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  )
}

export default function DevToolbar() {
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const demoMode = useStore((s) => s.demoMode)
  const demoManual = useStore((s) => s.demoManual)
  const demoReason = useStore((s) => s.demoReason)
  const quotaRemaining = useStore((s) => s.quotaRemaining)
  const toggleDemoManual = useStore((s) => s.toggleDemoManual)
  const simulateNextResult = useStore((s) => s.simulateNextResult)
  const forceNewestOpen = useStore((s) => s.forceNewestOpen)
  const manualSettleLeg = useStore((s) => s.manualSettleLeg)
  const reset = useStore((s) => s.reset)
  const bets = useStore((s) => s.bets)

  // Open legs die niet automatisch afwikkelbaar zijn -> handmatige settlement.
  const manualLegs = []
  for (const bet of bets) {
    if (bet.status !== 'open') continue
    for (const leg of bet.legs) {
      if ((!leg.status || leg.status === 'pending') && !leg.derivable) {
        manualLegs.push({ betId: bet.id, leg })
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-20 left-4 md:bottom-6 md:left-6 w-11 h-11 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-300 hover:text-white shadow-lg transition"
        title="Dev Toolbar"
      >
        <Settings size={19} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="relative w-full md:max-w-md bg-slate-900 border-t md:border border-slate-700/60 md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <FlaskConical size={17} className="text-brand" />
                <span className="font-semibold text-sm">Dev Toolbar</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Quota + Demo Mode */}
              <Section title="API-status">
                <div className="flex items-center justify-between bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-slate-300">
                    <Gauge size={15} className="text-brand" /> Resterend quotum
                  </span>
                  <span className="text-sm nums">
                    {quotaRemaining != null ? quotaRemaining : hasApiKey() ? '—' : 'n.v.t.'}
                  </span>
                </div>

                <button
                  onClick={toggleDemoManual}
                  className="w-full flex items-center justify-between bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5 hover:border-slate-500 transition"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-300">
                    {demoMode ? <WifiOff size={15} className="text-gold" /> : <Wifi size={15} className="text-brand" />}
                    Demo Mode
                  </span>
                  <span className={`relative w-10 h-6 rounded-full transition ${demoManual ? 'bg-gold' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${demoManual ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                </button>
                {demoMode && (
                  <p className="text-[11px] text-gold/80 px-1">
                    Actief{demoReason ? ` — ${demoReason}` : demoManual ? ' — handmatig ingeschakeld' : !hasApiKey() ? ' — geen API-key' : ''}.
                  </p>
                )}
              </Section>

              {/* Simulatie */}
              <Section title="Simulatie">
                <button
                  onClick={simulateNextResult}
                  className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm hover:border-slate-500 transition"
                >
                  <Dice5 size={16} className="text-brand" /> Simuleer volgende uitslag
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => forceNewestOpen(true)}
                    className="flex items-center justify-center gap-1.5 bg-brand/10 border border-brand/30 text-brand rounded-xl px-3 py-2.5 text-sm hover:bg-brand/20 transition"
                  >
                    <TrendingUp size={15} /> Forceer winst
                  </button>
                  <button
                    onClick={() => forceNewestOpen(false)}
                    className="flex items-center justify-center gap-1.5 bg-loss/10 border border-loss/30 text-loss rounded-xl px-3 py-2.5 text-sm hover:bg-loss/20 transition"
                  >
                    <TrendingDown size={15} /> Forceer verlies
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 px-1">
                  Forceer werkt op de nieuwste open bet.
                </p>
              </Section>

              {/* Handmatige settlement */}
              <Section title="Handmatige settlement (niet-afleidbare legs)">
                {manualLegs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 px-1">Geen open legs die handmatige settlement nodig hebben.</p>
                ) : (
                  <div className="space-y-2">
                    {manualLegs.map(({ betId, leg }) => (
                      <div key={betId + leg.id} className="bg-slate-800 border border-slate-700/50 rounded-xl p-3">
                        <div className="text-xs font-medium truncate">{leg.outcomeLabel}</div>
                        <div className="text-[11px] text-slate-500 truncate mb-2">
                          {leg.homeTeam} — {leg.awayTeam} · {leg.marketLabel}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => manualSettleLeg(betId, leg.id, 'won')}
                            className="flex items-center justify-center gap-1 bg-brand/10 border border-brand/30 text-brand rounded-lg py-1.5 text-xs hover:bg-brand/20 transition"
                          >
                            <Check size={13} /> Gewonnen
                          </button>
                          <button
                            onClick={() => manualSettleLeg(betId, leg.id, 'lost')}
                            className="flex items-center justify-center gap-1 bg-loss/10 border border-loss/30 text-loss rounded-lg py-1.5 text-xs hover:bg-loss/20 transition"
                          >
                            <X size={13} /> Verloren
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Reset */}
              <Section title="Reset">
                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm hover:border-loss/50 transition"
                  >
                    <RotateCcw size={16} className="text-loss" /> Reset naar 1000 credits
                  </button>
                ) : (
                  <div className="bg-loss/10 border border-loss/30 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-start gap-2 text-xs text-slate-200">
                      <AlertTriangle size={15} className="text-loss shrink-0 mt-0.5" />
                      Dit wist al je bets en zet je saldo terug op 1000. Leagues blijven behouden.
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { reset(); setConfirmReset(false) }}
                        className="bg-loss text-white rounded-lg py-1.5 text-xs font-medium hover:bg-loss/90 transition"
                      >
                        Ja, reset
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="bg-slate-700 text-white rounded-lg py-1.5 text-xs hover:bg-slate-600 transition"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
