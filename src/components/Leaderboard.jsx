import { useEffect, useState } from 'react'
import { Trophy, Globe, Users, CalendarDays } from 'lucide-react'
import { useStore, selectLeaderboard } from '../store'
import { fmt } from '../lib/format'
import TeamBadge from './TeamBadge'
import LeagueManager from './LeagueManager'

const MEDALS = ['🥇', '🥈', '🥉']

function Row({ player, rank, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-700/40 border ${
        player.isMe ? 'bg-brand/10 border-brand/30' : 'bg-slate-800 border-slate-700/50'
      }`}
    >
      <span className="w-6 text-center text-sm">
        {rank < 3 ? MEDALS[rank] : <span className="text-slate-500">{rank + 1}</span>}
      </span>
      <TeamBadge name={player.name} color={player.color} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {player.name}
          {player.isMe && <span className="text-brand text-xs"> · jij</span>}
        </div>
        <div className="text-[11px] text-slate-500">
          {player.wins}W · {player.losses}V
        </div>
      </div>
      <span className="text-sm nums text-gold">{fmt(player.credits)}</span>
    </button>
  )
}

// Rij voor "Deze week": netto winst/verlies i.p.v. totaalsaldo, zodat
// nieuwe spelers een ranglijst hebben die niet overschaduwd wordt door
// wie het langst meespeelt.
function WeekRow({ player, rank, onClick }) {
  const positive = player.net > 0
  const negative = player.net < 0
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-700/40 border ${
        player.isMe ? 'bg-brand/10 border-brand/30' : 'bg-slate-800 border-slate-700/50'
      }`}
    >
      <span className="w-6 text-center text-sm">
        {rank < 3 ? MEDALS[rank] : <span className="text-slate-500">{rank + 1}</span>}
      </span>
      <TeamBadge name={player.name} color={player.color} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {player.name}
          {player.isMe && <span className="text-brand text-xs"> · jij</span>}
        </div>
        <div className="text-[11px] text-slate-500">
          {player.betsSettled} {player.betsSettled === 1 ? 'bet' : 'bets'} afgewikkeld
        </div>
      </div>
      <span className={`text-sm nums ${positive ? 'text-brand' : negative ? 'text-loss' : 'text-slate-400'}`}>
        {positive ? '+' : ''}
        {fmt(player.net)}
      </span>
    </button>
  )
}

export default function Leaderboard({ onPlayer }) {
  const board = useStore(selectLeaderboard)
  const weeklyBoard = useStore((s) => s.weeklyLeaderboard)
  const weeklyLoading = useStore((s) => s.weeklyLeaderboardLoading)
  const refreshWeeklyLeaderboard = useStore((s) => s.refreshWeeklyLeaderboard)
  const [tab, setTab] = useState('global')

  useEffect(() => {
    if (tab === 'week') refreshWeeklyLeaderboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Trophy size={18} className="text-gold" /> Ranglijst
      </h2>

      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('global')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 transition ${
            tab === 'global' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe size={15} /> <span className="hidden sm:inline">Globaal</span>
        </button>
        <button
          onClick={() => setTab('week')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 transition ${
            tab === 'week' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarDays size={15} /> <span className="hidden sm:inline">Deze week</span>
        </button>
        <button
          onClick={() => setTab('leagues')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 transition ${
            tab === 'leagues' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={15} /> <span className="hidden sm:inline">Leagues</span>
        </button>
      </div>

      {tab === 'global' && (
        <div className="space-y-1.5">
          {board.map((p, i) => (
            <Row key={p.id} player={p} rank={i} onClick={() => onPlayer(p.id)} />
          ))}
        </div>
      )}

      {tab === 'week' &&
        (weeklyLoading && weeklyBoard.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-16">Laden…</div>
        ) : weeklyBoard.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-16">Nog geen activiteit deze week.</div>
        ) : (
          <div className="space-y-1.5">
            {weeklyBoard.map((p, i) => (
              <WeekRow key={p.id} player={p} rank={i} onClick={() => onPlayer(p.id)} />
            ))}
          </div>
        ))}

      {tab === 'leagues' && <LeagueManager onPlayer={onPlayer} />}
    </div>
  )
}
