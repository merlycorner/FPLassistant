import React, { useState, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLFixture } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { Search, Plus, Check, ArrowRightLeft, Eye } from 'lucide-react';
import { PlayerModal } from './PlayerModal';

interface PlayerExplorerViewProps {
  players: FPLElement[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  lang: Language;
  squadPlayerIds: number[];
  onAddToSquad: (player: FPLElement) => void;
  onSelectForCompare: (player: FPLElement) => void;
}

export const PlayerExplorerView: React.FC<PlayerExplorerViewProps> = ({
  players,
  teams,
  fixtures,
  lang,
  squadPlayerIds,
  onAddToSquad,
  onSelectForCompare,
}) => {
  const t = translations[lang];

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<number | 'all'>('all');
  const [selectedTeam, setSelectedTeam] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<string>('total_points');
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<FPLElement | null>(null);

  // Position names
  const positionMap: Record<number, string> = {
    1: 'GKP',
    2: 'DEF',
    3: 'MID',
    4: 'FWD',
  };

  const teamsMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [teams]);

  // Filtering & Sorting
  const filteredPlayers = useMemo(() => {
    return players
      .filter((p) => {
        // Position filter
        if (selectedPosition !== 'all' && p.element_type !== selectedPosition) {
          return false;
        }
        // Team filter
        if (selectedTeam !== 'all' && p.team !== selectedTeam) {
          return false;
        }
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const fullName = `${p.first_name} ${p.second_name} ${p.web_name}`.toLowerCase();
          if (!fullName.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price_desc':
            return b.now_cost - a.now_cost;
          case 'price_asc':
            return a.now_cost - b.now_cost;
          case 'form_desc':
            return (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0);
          case 'xg_desc':
            return (parseFloat(b.expected_goals) || 0) - (parseFloat(a.expected_goals) || 0);
          case 'xgi_desc':
            return (
              (parseFloat(b.expected_goal_involvements) || 0) -
              (parseFloat(a.expected_goal_involvements) || 0)
            );
          case 'selected_desc':
            return (
              (parseFloat(b.selected_by_percent) || 0) - (parseFloat(a.selected_by_percent) || 0)
            );
          case 'transfers_in_desc':
            return b.transfers_in_event - a.transfers_in_event;
          case 'total_points':
          default:
            return b.total_points - a.total_points;
        }
      });
  }, [players, searchQuery, selectedPosition, selectedTeam, sortBy]);

  return (
    <div className="space-y-6 py-6">
      {/* Title & Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.explorer.title}</h1>
          <p className="text-xs text-slate-400 mt-1">{t.explorer.subtitle}</p>
        </div>
        <div className="text-xs text-slate-400 tabular-nums">
          {t.explorer.showingCount
            .replace('{count}', filteredPlayers.length.toString())
            .replace('{total}', players.length.toString())}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.explorer.searchPlaceholder}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Position Selector */}
          <div>
            <select
              value={selectedPosition}
              onChange={(e) =>
                setSelectedPosition(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">{t.explorer.allPositions}</option>
              <option value="1">{t.explorer.posGkpPlural}</option>
              <option value="2">{t.explorer.posDefPlural}</option>
              <option value="3">{t.explorer.posMidPlural}</option>
              <option value="4">{t.explorer.posFwdPlural}</option>
            </select>
          </div>

          {/* Club Selector */}
          <div>
            <select
              value={selectedTeam}
              onChange={(e) =>
                setSelectedTeam(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">{t.explorer.allClubs}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="total_points">{t.explorer.sortPointsDesc}</option>
              <option value="price_desc">{t.explorer.sortPriceDesc}</option>
              <option value="price_asc">{t.explorer.sortPriceAsc}</option>
              <option value="form_desc">{t.explorer.sortFormDesc}</option>
              <option value="xg_desc">{t.explorer.sortXgDesc}</option>
              <option value="xgi_desc">{t.explorer.sortXgiDesc}</option>
              <option value="selected_desc">{t.explorer.sortSelectedDesc}</option>
              <option value="transfers_in_desc">{t.explorer.sortTransfersInDesc}</option>
            </select>
          </div>
        </div>

        {/* Informational Disclaimer on xG */}
        <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
          {t.explorer.xgDisclaimer}
        </div>
      </div>

      {/* Players Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">{t.explorer.colPlayer}</th>
                <th className="py-3 px-3">{t.explorer.colClub}</th>
                <th className="py-3 px-2 text-center">{t.explorer.colPos}</th>
                <th className="py-3 px-3 text-right">{t.explorer.colPrice}</th>
                <th className="py-3 px-3 text-right">{t.explorer.colPoints}</th>
                <th className="py-3 px-3 text-right">{t.explorer.colForm}</th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">{t.explorer.colMins}</th>
                <th className="py-3 px-3 text-right hidden md:table-cell">{t.explorer.colPpg}</th>
                <th className="py-3 px-3 text-right hidden lg:table-cell">{t.explorer.colXg}</th>
                <th className="py-3 px-3 text-right hidden lg:table-cell">{t.explorer.colXgi}</th>
                <th className="py-3 px-3 text-right hidden md:table-cell">{t.explorer.colSelected}</th>
                <th className="py-3 px-4 text-center">{t.explorer.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    {t.explorer.noPlayersFound}
                  </td>
                </tr>
              ) : (
                filteredPlayers.slice(0, 100).map((player) => {
                  const club = teamsMap.get(player.team);
                  const isInSquad = squadPlayerIds.includes(player.id);
                  const price = (player.now_cost / 10).toFixed(1);

                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedPlayerForModal(player)}
                          className="text-left font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{player.web_name}</span>
                          {player.status !== 'a' && (
                            <span
                              title={player.news || 'Flagged'}
                              className="text-[10px] text-amber-400 font-bold px-1 rounded bg-amber-950/60 border border-amber-800/40"
                            >
                              !
                            </span>
                          )}
                        </button>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                          {player.first_name} {player.second_name}
                        </span>
                      </td>

                      {/* Club */}
                      <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">
                        {club?.short_name || 'UNK'}
                      </td>

                      {/* Position */}
                      <td className="py-3 px-2 text-center">
                        <span className="text-[11px] font-mono text-slate-400">
                          {positionMap[player.element_type]}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 font-bold whitespace-nowrap">
                        £{price}m
                      </td>

                      {/* Points */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-white font-bold whitespace-nowrap">
                        {player.total_points}
                      </td>

                      {/* Form */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        {player.form || t.explorer.naText}
                      </td>

                      {/* Minutes */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400 hidden sm:table-cell whitespace-nowrap">
                        {player.minutes}
                      </td>

                      {/* PPG */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300 hidden md:table-cell whitespace-nowrap">
                        {player.points_per_game || t.explorer.naText}
                      </td>

                      {/* xG */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-cyan-400 hidden lg:table-cell whitespace-nowrap">
                        {player.expected_goals || t.explorer.naText}
                      </td>

                      {/* xGI */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-300 hidden lg:table-cell whitespace-nowrap">
                        {player.expected_goal_involvements || t.explorer.naText}
                      </td>

                      {/* Selected % */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400 hidden md:table-cell whitespace-nowrap">
                        {player.selected_by_percent}%
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View details */}
                          <button
                            onClick={() => setSelectedPlayerForModal(player)}
                            title={t.explorer.detailsBtn}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Compare */}
                          <button
                            onClick={() => onSelectForCompare(player)}
                            title={t.explorer.compareBtn}
                            className="p-1.5 text-cyan-400 hover:text-cyan-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Add to squad */}
                          <button
                            onClick={() => onAddToSquad(player)}
                            disabled={isInSquad}
                            title={isInSquad ? t.explorer.inSquadBtn : t.explorer.addSquadBtn}
                            className={`p-1.5 rounded transition-colors cursor-pointer border ${
                              isInSquad
                                ? 'bg-slate-800/80 text-emerald-400 border-slate-700 cursor-default'
                                : 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border-emerald-800/60'
                            }`}
                          >
                            {isInSquad ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedPlayerForModal && (
        <PlayerModal
          player={selectedPlayerForModal}
          club={teamsMap.get(selectedPlayerForModal.team)}
          fixtures={fixtures}
          allTeams={teams}
          lang={lang}
          onClose={() => setSelectedPlayerForModal(null)}
          onAddToSquad={onAddToSquad}
          isInSquad={squadPlayerIds.includes(selectedPlayerForModal.id)}
          onCompareWith={onSelectForCompare}
        />
      )}
    </div>
  );
};
