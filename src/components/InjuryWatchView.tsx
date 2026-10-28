import React, { useState, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLBootstrap, UserSquadState } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { ClubJersey } from './ClubJersey';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Search,
  TrendingUp,
  Activity,
  Info,
  ArrowRight,
} from 'lucide-react';

interface InjuryWatchViewProps {
  bootstrap: FPLBootstrap;
  squadState: UserSquadState;
  lang: Language;
  onSelectPlayer: (player: FPLElement) => void;
  onNavigateToTransfersWithPlayer: (player: FPLElement) => void;
}

export const InjuryWatchView: React.FC<InjuryWatchViewProps> = ({
  bootstrap,
  squadState,
  lang,
  onSelectPlayer,
  onNavigateToTransfersWithPlayer,
}) => {
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'all' | 'mostOwned' | 'doubtful' | 'ruledOut' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const teamsMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    bootstrap.teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [bootstrap.teams]);

  const playersMap = useMemo(() => {
    const map = new Map<number, FPLElement>();
    bootstrap.elements.forEach((el) => map.set(el.id, el));
    return map;
  }, [bootstrap.elements]);

  // Squad elements
  const squadElements: FPLElement[] = useMemo(() => {
    return squadState.picks
      .map((p) => playersMap.get(p.elementId))
      .filter((p): p is FPLElement => Boolean(p));
  }, [squadState.picks, playersMap]);

  // Squad flagged players (injury or ban)
  const squadFlaggedPlayers = useMemo(() => {
    return squadElements.filter(
      (p) =>
        p.status !== 'a' ||
        (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100) ||
        (p.news && p.news.trim().length > 0)
    );
  }, [squadElements]);

  // All flagged players in Premier League
  const allFlaggedPlayers = useMemo(() => {
    return bootstrap.elements.filter(
      (p) =>
        p.status !== 'a' ||
        (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100) ||
        (p.news && p.news.trim().length > 0)
    );
  }, [bootstrap.elements]);

  // Filtered flagged players
  const filteredPlayers = useMemo(() => {
    return allFlaggedPlayers
      .filter((p) => {
        // Tab category
        if (activeTab === 'doubtful') {
          return (
            p.chance_of_playing_next_round !== null &&
            p.chance_of_playing_next_round >= 25 &&
            p.chance_of_playing_next_round <= 75
          );
        }
        if (activeTab === 'ruledOut') {
          return (
            p.status === 'i' ||
            p.chance_of_playing_next_round === 0 ||
            p.status === 'u'
          );
        }
        if (activeTab === 'suspended') {
          return p.status === 's';
        }
        return true;
      })
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return `${p.first_name} ${p.second_name} ${p.web_name}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (activeTab === 'mostOwned') {
          return (parseFloat(b.selected_by_percent) || 0) - (parseFloat(a.selected_by_percent) || 0);
        }
        // Default sort by ownership desc to show highest-impact players first
        return (parseFloat(b.selected_by_percent) || 0) - (parseFloat(a.selected_by_percent) || 0);
      });
  }, [allFlaggedPlayers, activeTab, searchQuery]);

  // Status badge styling helper
  function getStatusBadge(player: FPLElement) {
    if (player.status === 's') {
      return {
        label: lang === 'id' ? 'Skorsing' : 'Suspended',
        bg: 'bg-rose-950/80 text-rose-400 border-rose-800/80',
      };
    }
    if (player.chance_of_playing_next_round === 0 || player.status === 'i' || player.status === 'u') {
      return {
        label: lang === 'id' ? 'Dipastikan Absen' : 'Ruled Out',
        bg: 'bg-rose-950/80 text-rose-400 border-rose-800/80',
      };
    }
    if (player.chance_of_playing_next_round === 25) {
      return {
        label: lang === 'id' ? 'Sangat Diragukan (25%)' : 'Major Doubt (25%)',
        bg: 'bg-amber-950/80 text-amber-400 border-amber-800/80',
      };
    }
    if (player.chance_of_playing_next_round === 50) {
      return {
        label: lang === 'id' ? 'Peluang 50%' : '50% Chance',
        bg: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
      };
    }
    return {
      label: lang === 'id' ? 'Diragukan (75%)' : 'Minor Knock (75%)',
      bg: 'bg-yellow-950/80 text-yellow-300 border-yellow-800/80',
    };
  }

  return (
    <div className="space-y-6 py-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {t.injuries.title}
        </h1>
        <p className="text-xs text-slate-400 mt-1">{t.injuries.subtitle}</p>
      </div>

      {/* SECTION 1: SQUAD HEALTH SCANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            {t.injuries.squadHealthTitle}
          </h2>
        </div>

        {squadElements.length === 0 ? (
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400">
            {t.injuries.noSquadToCheck}
          </div>
        ) : squadFlaggedPlayers.length === 0 ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{t.injuries.squadHealthSafe}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {t.injuries.squadHealthDanger.replace(
                  '{count}',
                  squadFlaggedPlayers.length.toString()
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {squadFlaggedPlayers.map((p) => {
                const club = teamsMap.get(p.team);
                const badge = getStatusBadge(p);

                return (
                  <div
                    key={p.id}
                    className="p-4 bg-slate-950 border border-rose-900/60 rounded-xl flex flex-col justify-between space-y-3 shadow"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          £{(p.now_cost / 10).toFixed(1)}m
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <ClubJersey
                          club={club}
                          isGoalkeeper={p.element_type === 1}
                          size="sm"
                        />
                        <div>
                          <h4 className="font-extrabold text-white text-sm">{p.web_name}</h4>
                          <div className="text-[11px] text-slate-400">
                            {club?.name} · {t.injuries.ownedCount.replace('{count}', p.selected_by_percent)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 p-2.5 bg-slate-900/80 rounded border border-slate-800/80 text-xs text-rose-300/90 leading-relaxed">
                        <strong className="text-slate-300 block mb-0.5 text-[10px] uppercase">
                          {t.injuries.fplMedicalReport}
                        </strong>
                        {p.news || t.injuries.medicalMonitored}
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateToTransfersWithPlayer(p)}
                      className="w-full py-2 px-3 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{t.injuries.actionFindReplacement}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: LEAGUE-WIDE FLAGGED PLAYERS TRACKER */}
      <div className="space-y-4">
        {/* Search & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.injuries.tabAll.replace('{count}', allFlaggedPlayers.length.toString())}
            </button>
            <button
              onClick={() => setActiveTab('mostOwned')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'mostOwned'
                  ? 'bg-slate-800 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.injuries.tabMostOwned}
            </button>
            <button
              onClick={() => setActiveTab('doubtful')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'doubtful'
                  ? 'bg-slate-800 text-yellow-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.injuries.tabDoubtful}
            </button>
            <button
              onClick={() => setActiveTab('ruledOut')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'ruledOut'
                  ? 'bg-slate-800 text-rose-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.injuries.tabRuledOut}
            </button>
            <button
              onClick={() => setActiveTab('suspended')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'suspended'
                  ? 'bg-slate-800 text-rose-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.injuries.tabSuspended}
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.injuries.searchPlaceholder}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Flagged Players Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">{t.injuries.colPlayer}</th>
                  <th className="py-3 px-3">{t.injuries.colClub}</th>
                  <th className="py-3 px-3">{t.injuries.colStatus}</th>
                  <th className="py-3 px-3 text-center">{t.injuries.colChance}</th>
                  <th className="py-3 px-4">{t.injuries.colNews}</th>
                  <th className="py-3 px-3 text-right">{t.injuries.colCost}</th>
                  <th className="py-3 px-3 text-right">{t.injuries.colSelected}</th>
                  <th className="py-3 px-4 text-center">{t.injuries.tableActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {t.injuries.emptyNone}
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => {
                    const club = teamsMap.get(player.team);
                    const badge = getStatusBadge(player);
                    const chance =
                      player.chance_of_playing_next_round !== null
                        ? `${player.chance_of_playing_next_round}%`
                        : player.status === 's'
                        ? '0%'
                        : t.injuries.statusDoubtful;

                    return (
                      <tr
                        key={player.id}
                        className="hover:bg-slate-800/50 transition-colors group"
                      >
                        {/* Player */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onSelectPlayer(player)}
                            className="text-left flex items-center gap-2.5 cursor-pointer"
                          >
                            <ClubJersey
                              club={club}
                              isGoalkeeper={player.element_type === 1}
                              size="sm"
                            />
                            <div>
                              <div className="font-semibold text-slate-100 group-hover:text-rose-400 transition-colors">
                                {player.web_name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {player.first_name} {player.second_name}
                              </div>
                            </div>
                          </button>
                        </td>

                        {/* Club */}
                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {club?.short_name || 'UNK'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase whitespace-nowrap ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Playing Chance */}
                        <td className="py-3 px-3 text-center font-mono font-bold tabular-nums">
                          <span
                            className={
                              player.chance_of_playing_next_round === 0 || player.status === 's'
                                ? 'text-rose-400'
                                : player.chance_of_playing_next_round && player.chance_of_playing_next_round <= 50
                                ? 'text-amber-400'
                                : 'text-yellow-300'
                            }
                          >
                            {chance}
                          </span>
                        </td>

                        {/* News */}
                        <td className="py-3 px-4 text-xs text-rose-300/90 max-w-xs truncate">
                          {player.news || t.injuries.medicalPending}
                        </td>

                        {/* Cost */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 font-bold whitespace-nowrap">
                          £{(player.now_cost / 10).toFixed(1)}m
                        </td>

                        {/* Ownership */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {player.selected_by_percent}%
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => onNavigateToTransfersWithPlayer(player)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 rounded transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>{t.injuries.replaceAction}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Source Note */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t.injuries.medicalNote}</p>
        </div>
      </div>
    </div>
  );
};
