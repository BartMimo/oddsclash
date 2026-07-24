import { useState } from 'react'
import { ChevronDown, Check, X, Clock, Info, Layers, CircleDot } from 'lucide-react'
import { useStore } from '../store'
import { fmt } from '../lib/format'

const STATUS = {
  open: { label: 'Lopend', cls: 'text-gold bg-gold/10 border-gold/30' },
  won: { label: 'Gewonnen', cls: 'text-brand bg-brand/10 border-brand/30' },
  lost: { label: 'Verloren', cls: 'text-loss bg-loss/10 border-loss/30' },
}

function LegRow({ leg }) {
  const st = leg.status === 'won' ? 'won' : leg.status === 'lost' ? 'lost' : leg.status === 'void' ? 'void' : 'open'
  const Icon = st === 'won' ? Check : st === 'lost' ? X : st === 'void' ? Info : Clock
  const color = st === 'won' ? 'text-brand' : st === 'lost' ? 'text-loss' : st === 'void' ? 'text-slate-400' : 'text-gold'
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-t border-slate-700/40 first:border-t-0">
      <div className="flex items-start gap-2 min-w-0">
        <Icon size={14} className={`${color} mt-0.5 shrink-0`} />
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{leg.outcomeLabel}</div>
          <div className="text-[11px] text-slate-500 truncate">
            {leg.homeTeam} — {leg.awayTeam}
            {!leg.derivable && leg.status === 'pending' && (
              <span className="text-gold"> · handmatige settlement</span>
            )}
          </div>
        </div>
      </div>
      <span className="text-xs nums text-slate-300 shrink-0">{fmt(leg.price)}</span>
    </div>
  )
}

function BetCard({ bet }) {
  const [open, setOpen] = useState(false)
  const st = STATUS[bet.status] || STATUS.open
  const isCombi = bet.type === 'combi'
  const potential = Math.round(bet.stake * bet.totalOdds * 100) / 100

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 hover:bg-slate-700/20 transition"
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 bg-slate-900/60 rounded-full px-2 py-0.5">
            {isCombi ? <Layers size={11} /> : <CircleDot size={11} />}
            {isCombi ? `Combi (${bet.legs.length})` : 'Enkel'}
          </span>
          <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${st.cls}`}>
            {st.label}
          </span>
        </div>

        {/* Samenvatting van de leg(s) */}
        <div className="space-y-0.5 mb-3">
          {bet.legs.slice(0, open ? 0 : 2).map((leg) => (
            <div key={leg.id} className="text-sm font-medium truncate">
              {leg.outcomeLabel}
              <span className="text-slate-500 font-normal text-xs"> · {leg.homeTeam.split(' ')[0]}–{leg.awayTeam.split(' ')[0]}</span>
            </div>
          ))}
          {!open && bet.legs.length > 2 && (
            <div className="text-xs text-slate-500">+{bet.legs.length - 2} meer…</div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-[10px] text-slate-500">Inzet</div>
            <div className="text-xs nums">{fmt(bet.stake)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">{isCombi ? 'Tot. odds' : 'Odds'}</div>
            <div className="text-xs nums">{fmt(bet.totalOdds)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">
              {bet.status === 'won' ? 'Uitbetaald' : bet.status === 'lost' ? 'Verlies' : 'Mogelijk'}
            </div>
            <div className={`text-xs nums ${bet.status === 'won' ? 'text-brand' : bet.status === 'lost' ? 'text-loss' : 'text-slate-200'}`}>
              {bet.status === 'won' ? fmt(bet.payout) : bet.status === 'lost' ? `−${fmt(bet.stake)}` : fmt(potential)}
            </div>
          </div>
          <div className="flex items-end justify-center">
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 -mt-1">
          <div className="bg-slate-900/50 rounded-xl px-3 py-1">
            {bet.legs.map((leg) => (
              <LegRow key={leg.id} leg={leg} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyBets() {
  const bets = useStore((s) => s.bets)
  const [tab, setTab] = useState('open')

  const open = bets.filter((b) => b.status === 'open')
  const history = bets.filter((b) => b.status !== 'open')
  const list = tab === 'open' ? open : history

  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-bold mb-3">Mijn bets</h2>

      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 mb-4">
        {[
          { id: 'open', label: `Open (${open.length})` },
          { id: 'history', label: `Geschiedenis (${history.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-sm font-medium rounded-lg py-2 transition ${
              tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-16">
          {tab === 'open' ? 'Nog geen open weddenschappen.' : 'Nog geen afgewikkelde bets.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      )}
    </div>
  )
}
