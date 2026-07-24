import { CheckCircle2, XCircle, Info, Trophy } from 'lucide-react'
import { useToast } from '../lib/toast'

const STYLES = {
  success: { icon: CheckCircle2, ring: 'border-brand/40', text: 'text-brand' },
  error: { icon: XCircle, ring: 'border-loss/40', text: 'text-loss' },
  info: { icon: Info, ring: 'border-slate-600', text: 'text-slate-300' },
  gold: { icon: Trophy, ring: 'border-gold/40', text: 'text-gold' },
}

export default function Toaster() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[92%] max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const s = STYLES[t.type] || STYLES.info
        const Icon = s.icon
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`animate-toast pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-slate-800/95 backdrop-blur px-3.5 py-2.5 text-left text-sm text-slate-100 shadow-xl ${s.ring}`}
          >
            <Icon className={`w-4.5 h-4.5 shrink-0 ${s.text}`} size={18} />
            <span className="leading-snug">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
