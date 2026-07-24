import { useState } from 'react'
import { Plus, Users, Copy, Check, LogIn, Activity, ChevronDown, Clock, X } from 'lucide-react'
import { useStore, selectLeaderboard } from '../store'
import { fmt } from '../lib/format'
import TeamBadge from './TeamBadge'

const ACTIVITY_STATUS = {
  open: { label: 'Lopend', Icon: Clock, cls: 'text-gold' },
  won: { label: 'Gewonnen', Icon: Check, cls: 'text-brand' },
  lost: { label: 'Verloren', Icon: X, cls: 'text-loss' },
}

function ActivityRow({ item }) {
  const st = ACTIVITY_STATUS[item.status] || ACTIVITY_STATUS.open
  const Icon = st.Icon
  const isCombi = item.type === 'combi' || item.legs.length > 1
  const first = item.legs[0]

  return (
    <div className="flex items-start gap-2.5 py-2 border-t border-slate-700/40 first:border-t-0">
      <TeamBadge name={item.username} color={item.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-xs truncate">
          <span className="font-medium">{item.username}</span>{' '}
          <span className="text-slate-400">
            zette in op {isCombi ? `Combi (${item.legs.length} legs)` : first?.outcome_label}
          </span>
        </div>
        {!isCombi && first && (
          <div className="text-[11px] text-slate-500 truncate">
            {first.home_team} — {first.away_team}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs nums">{fmt(item.stake)} cr</div>
        <div className={`text-[10px] flex items-center gap-0.5 justify-end ${st.cls}`}>
          <Icon size={10} /> {st.label}
        </div>
      </div>
    </div>
  )
}

function LeagueActivity({ leagueId }) {
  const activity = useStore((s) => s.leagueActivity[leagueId])
  const loading = useStore((s) => s.leagueActivityLoading[leagueId])

  if (loading && !activity) {
    return <div className="text-xs text-slate-500 text-center py-3">Laden…</div>
  }
  if (!activity || activity.length === 0) {
    return <div className="text-xs text-slate-500 text-center py-3">Nog geen activiteit in deze league.</div>
  }
  return (
    <div className="px-1">
      {activity.map((item) => (
        <ActivityRow key={item.betId} item={item} />
      ))}
    </div>
  )
}

// Mini-ranglijst van alleen de leden van een league.
function LeagueBoard({ league, onPlayer }) {
  const everyone = useStore(selectLeaderboard)
  const members = league.memberIds
    .map((id) => everyone.find((p) => p.id === id))
    .filter(Boolean)
    .sort((a, b) => b.credits - a.credits)

  return (
    <div className="mt-2 space-y-1">
      {members.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onPlayer(p.id)}
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-700/40 ${
            p.isMe ? 'bg-brand/10' : ''
          }`}
        >
          <span className="text-xs text-slate-500 w-4 text-center">{i + 1}</span>
          <TeamBadge name={p.name} color={p.color} size="sm" />
          <span className="text-sm flex-1 truncate">{p.name}{p.isMe && ' (jij)'}</span>
          <span className="text-xs nums text-gold">{fmt(p.credits)}</span>
        </button>
      ))}
    </div>
  )
}

function LeagueCard({ league, onPlayer }) {
  const [copied, setCopied] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const loadLeagueActivity = useStore((s) => s.loadLeagueActivity)

  function copy() {
    navigator.clipboard?.writeText(league.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function toggleActivity() {
    setShowActivity((v) => {
      if (!v) loadLeagueActivity(league.id)
      return !v
    })
  }

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{league.name}</span>
            {league.isOwner && <span className="text-[10px] bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">Eigenaar</span>}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <Users size={11} /> {league.memberIds.length} leden
          </div>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs bg-slate-900/70 border border-slate-700 rounded-lg px-2.5 py-1.5 hover:border-slate-500 transition"
        >
          {copied ? <Check size={13} className="text-brand" /> : <Copy size={13} />}
          <span className="nums">{league.code}</span>
        </button>
      </div>
      <LeagueBoard league={league} onPlayer={onPlayer} />

      <button
        onClick={toggleActivity}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 mt-2 pt-2 border-t border-slate-700/40 transition"
      >
        <Activity size={12} /> Activiteit
        <ChevronDown size={12} className={`transition-transform ${showActivity ? 'rotate-180' : ''}`} />
      </button>
      {showActivity && <LeagueActivity leagueId={league.id} />}
    </div>
  )
}

export default function LeagueManager({ onPlayer }) {
  const myLeagues = useStore((s) => s.myLeagues)
  const createLeague = useStore((s) => s.createLeague)
  const joinLeague = useStore((s) => s.joinLeague)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    createLeague(name)
    setName('')
  }
  function handleJoin(e) {
    e.preventDefault()
    if (joinLeague(code)) setCode('')
  }

  return (
    <div className="space-y-3">
      {/* Aanmaken + joinen */}
      <div className="grid sm:grid-cols-2 gap-2.5">
        <form onSubmit={handleCreate} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-3">
          <div className="text-xs font-medium text-slate-400 mb-2">Nieuwe league</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Naam"
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-brand transition"
            />
            <button className="bg-brand hover:bg-brand-dark text-slate-950 font-medium rounded-lg px-3 text-sm flex items-center gap-1 transition">
              <Plus size={15} />
            </button>
          </div>
        </form>

        <form onSubmit={handleJoin} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-3">
          <div className="text-xs font-medium text-slate-400 mb-2">Join met code</div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={7}
              placeholder="XX-0000"
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm nums outline-none focus:border-brand transition"
            />
            <button className="bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg px-3 text-sm flex items-center gap-1 transition">
              <LogIn size={15} />
            </button>
          </div>
        </form>
      </div>

      <p className="text-[11px] text-slate-500 px-1">
        Tip: deel je league-code met vrienden zodat zij kunnen joinen.
      </p>

      {myLeagues.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">Nog geen private leagues.</div>
      ) : (
        <div className="space-y-2.5">
          {myLeagues.map((lg) => (
            <LeagueCard key={lg.id} league={lg} onPlayer={onPlayer} />
          ))}
        </div>
      )}
    </div>
  )
}
