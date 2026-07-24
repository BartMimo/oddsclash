import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// ------------------------------------------------------------------
// SportPills — filterbalk boven de wedstrijdenlijst:
// - "Vandaag" / "Morgen": alle wedstrijden over alle competities heen.
// - Competitie-dropdown: één competitie tegelijk, i.p.v. de lange
//   horizontaal scrollbare pillenrij van voorheen.
// ------------------------------------------------------------------
const QUICK_FILTERS = [
  { key: 'today', label: 'Vandaag' },
  { key: 'tomorrow', label: 'Morgen' },
]

export default function SportPills({ sports, activeSport, onSelect, dateFilter, onDateFilter }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const activeSportTitle = sports.find((s) => s.key === activeSport)?.title

  return (
    <div className="flex items-center gap-2 mb-3">
      {QUICK_FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onDateFilter(f.key)}
          className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 border transition ${
            dateFilter === f.key
              ? 'bg-brand/15 border-brand/50 text-brand'
              : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:border-slate-500'
          }`}
        >
          {f.label}
        </button>
      ))}

      <div className="relative flex-1 min-w-0" ref={wrapRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 text-xs font-medium rounded-full px-3 py-1.5 border transition ${
            !dateFilter
              ? 'bg-brand/15 border-brand/50 text-brand'
              : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:border-slate-500'
          }`}
        >
          <span className="truncate">{activeSportTitle || 'Kies competitie'}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-72 overflow-y-auto bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl py-1">
            {sports.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  onSelect(s.key)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-2 text-left text-xs px-3 py-2 transition ${
                  !dateFilter && activeSport === s.key
                    ? 'text-brand bg-brand/10'
                    : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                {s.title}
                {!dateFilter && activeSport === s.key && <Check size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
