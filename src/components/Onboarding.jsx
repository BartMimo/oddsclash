import { useState } from 'react'
import { Zap, Loader2, AlertCircle } from 'lucide-react'
import { initials } from '../lib/format'
import { signIn, signUp } from '../services/supabase'

const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899', '#22c55e']

// Nederlandse foutmeldingen voor de meest voorkomende Supabase auth-errors.
function friendlyError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mailadres of wachtwoord is onjuist.'
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'Er bestaat al een account met dit e-mailadres.'
  if (m.includes('password') && m.includes('at least')) return 'Wachtwoord moet minimaal 6 tekens zijn.'
  if (m.includes('username')) return 'Deze gebruikersnaam is al bezet.'
  if (m.includes('email') && m.includes('invalid')) return 'Vul een geldig e-mailadres in.'
  return message || 'Er ging iets mis. Probeer het opnieuw.'
}

export default function Onboarding() {
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isSignup = mode === 'signup'

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) return
    if (isSignup && (!name.trim() || !agreed)) return

    setLoading(true)
    try {
      if (isSignup) {
        await signUp({ email: email.trim(), password, username: name.trim(), avatarColor: color })
      } else {
        await signIn({ email: email.trim(), password })
      }
      // App.jsx luistert naar onAuthChange en pakt de sessie vanzelf op.
    } catch (err) {
      setError(friendlyError(err.message))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-5 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand/15 border border-brand/30 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Odds<span className="text-brand">Clash</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Social betting met virtuele credits. Echte odds, geen echt geld.
          </p>
        </div>

        {/* Login / Registreren toggle */}
        <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null) }}
            className={`flex-1 text-sm font-medium rounded-lg py-2 transition ${
              isSignup ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Registreren
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex-1 text-sm font-medium rounded-lg py-2 transition ${
              !isSignup ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inloggen
          </button>
        </div>

        <form onSubmit={submit} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          {isSignup && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Gebruikersnaam</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="bv. Bart"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mailadres</label>
            <input
              type="email"
              autoFocus={!isSignup}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              autoComplete="email"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimaal 6 tekens"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand transition"
            />
          </div>

          {isSignup && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Avatar-kleur</label>
              <div className="flex items-center gap-4">
                <span
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials(name || 'Jij')}
                </span>
                <div className="grid grid-cols-4 gap-2 flex-1">
                  {COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-8 rounded-lg transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Kleur ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {isSignup && (
            <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-600 bg-slate-900 text-brand focus:ring-brand focus:ring-offset-0 accent-emerald-500"
              />
              <span>
                Ik ben <b className="text-slate-300">18 jaar of ouder</b> en begrijp dat OddsClash
                uitsluitend <b className="text-slate-300">virtuele credits zonder geldwaarde</b> gebruikt —
                er wordt niet met echt geld gespeeld en credits zijn niet inwisselbaar voor geld of prijzen.
              </span>
            </label>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password || (isSignup && (!name.trim() || !agreed))}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {isSignup ? 'Start met 1000 credits' : 'Inloggen'}
          </button>
        </form>

        <p className="text-[11px] text-slate-600 text-center mt-4 px-4">
          OddsClash is een sociaal spel met virtuele credits — geen kansspel om geld. 18+.
        </p>
      </div>
    </div>
  )
}
