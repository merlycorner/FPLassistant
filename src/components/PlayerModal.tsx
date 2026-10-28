import React from 'react';
import { FPLElement, FPLTeam, FPLFixture } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { X, Plus, Check, ArrowRightLeft } from 'lucide-react';
import { getUpcomingFixturesForTeam } from '../lib/scoring';

interface PlayerModalProps {
  player: FPLElement;
  club?: FPLTeam;
  fixtures: FPLFixture[];
  allTeams: FPLTeam[];
  lang: Language;
  onClose: () => void;
  onAddToSquad: (player: FPLElement) => void;
  isInSquad: boolean;
  onCompareWith: (player: FPLElement) => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  player,
  club,
  fixtures,
  allTeams,
  lang,
  onClose,
  onAddToSquad,
  isInSquad,
  onCompareWith,
}) => {
  const t = translations[lang];
  const upcoming = getUpcomingFixturesForTeam(player.team, fixtures, allTeams, 4);

  const getPosName = (typeId: number) => {
    switch (typeId) {
      case 1:
        return t.explorer.posGkp;
      case 2:
        return t.explorer.posDef;
      case 3:
        return t.explorer.posMid;
      case 4:
        return t.explorer.posFwd;
      default:
        return t.explorer.naText;
    }
  };

  const getFdrBg = (diff: number) => {
    if (diff <= 2) return 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
    if (diff === 3) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (diff === 4) return 'bg-amber-950 text-amber-400 border-amber-800/60';
    return 'bg-rose-950 text-rose-400 border-rose-800/60';
  };

  const costFormatted = (player.now_cost / 10).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{club?.name || 'Club'}</span>
              <span>·</span>
              <span>{getPosName(player.element_type)}</span>
              <span>·</span>
              <span className="font-mono tabular-nums text-emerald-400 font-bold">£{costFormatted}m</span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-white tracking-tight">
              {player.first_name} {player.second_name}
            </h2>
            <div className="text-xs text-slate-500 font-mono">
              FPL ID: {player.id} · {t.playerModal.knownAs} {player.web_name}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Availability Status Banner if not 100% fit */}
          {player.status !== 'a' && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-lg text-xs text-amber-300">
              <span className="font-semibold">Status: </span>
              {player.news || t.playerModal.flaggedAvailability}
              {player.chance_of_playing_next_round !== null && (
                <span className="block mt-0.5 text-amber-400 font-mono">
                  {t.playerModal.chanceNextRound} {player.chance_of_playing_next_round}%
                </span>
              )}
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              {t.compare.statMetrics}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">{t.explorer.colPoints}</span>
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {player.total_points}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">{t.explorer.colForm}</span>
                <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  {player.form}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">{t.explorer.colPpg}</span>
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {player.points_per_game}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">{t.explorer.colMins}</span>
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {player.minutes}
                </span>
              </div>
            </div>
          </div>

          {/* Underlying Expected Metrics (xG, xA, xGI, xGC) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t.compare.expectedMetrics}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Official Opta Data</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">xG (Expected Goals)</span>
                <span className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                  {player.expected_goals || t.explorer.naText}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">xA (Expected Assists)</span>
                <span className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                  {player.expected_assists || t.explorer.naText}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">xGI (Involvements)</span>
                <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                  {player.expected_goal_involvements || t.explorer.naText}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] text-slate-400 block">xGC (Goals Conceded)</span>
                <span className="text-lg font-bold font-mono text-slate-300 tabular-nums">
                  {player.expected_goals_conceded || t.explorer.naText}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
              {t.explorer.xgDisclaimer}
            </p>
          </div>

          {/* In-game Contribution Stats (Goals, Assists, Clean Sheets, Bonus) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.goalsScored}</span>
              <span className="font-mono font-bold text-white tabular-nums">{player.goals_scored}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.assists}</span>
              <span className="font-mono font-bold text-white tabular-nums">{player.assists}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.cleanSheets}</span>
              <span className="font-mono font-bold text-white tabular-nums">{player.clean_sheets}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.bonusPoints}</span>
              <span className="font-mono font-bold text-amber-400 tabular-nums">{player.bonus}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.compare.ictLabel}</span>
              <span className="font-mono font-bold text-white tabular-nums">{player.ict_index}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.ownershipLabel}</span>
              <span className="font-mono font-bold text-white tabular-nums">{player.selected_by_percent}%</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.gwTransfersIn}</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">+{player.transfers_in_event.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-950/40 rounded border border-slate-800/60">
              <span className="text-slate-400">{t.playerModal.gwTransfersOut}</span>
              <span className="font-mono font-bold text-rose-400 tabular-nums">-{player.transfers_out_event.toLocaleString()}</span>
            </div>
          </div>

          {/* Upcoming Fixtures */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              {t.compare.fixtureMetrics}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {upcoming.map((fix, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs"
                >
                  <span className="font-semibold text-white">
                    {fix.opponent} <span className="text-slate-400 font-normal">({fix.isHome ? 'H' : 'A'})</span>
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded border text-[10px] tabular-nums ${getFdrBg(
                      fix.difficulty
                    )}`}
                  >
                    FDR {fix.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => {
              onCompareWith(player);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{t.explorer.compareBtn}</span>
          </button>

          <button
            onClick={() => onAddToSquad(player)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              isInSquad
                ? 'bg-slate-800 text-slate-300 border border-slate-700 cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isInSquad ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.explorer.inSquadBtn}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{t.explorer.addSquadBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
