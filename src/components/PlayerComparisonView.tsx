import React, { useState, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLFixture } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { Search, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { getUpcomingFixturesForTeam } from '../lib/scoring';

interface PlayerComparisonViewProps {
  players: FPLElement[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  lang: Language;
  initialPlayer1?: FPLElement | null;
  initialPlayer2?: FPLElement | null;
}

export const PlayerComparisonView: React.FC<PlayerComparisonViewProps> = ({
  players,
  teams,
  fixtures,
  lang,
  initialPlayer1 = null,
  initialPlayer2 = null,
}) => {
  const t = translations[lang];

  const [player1, setPlayer1] = useState<FPLElement | null>(initialPlayer1);
  const [player2, setPlayer2] = useState<FPLElement | null>(initialPlayer2);

  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');

  const teamsMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [teams]);

  const p1Club = player1 ? teamsMap.get(player1.team) : null;
  const p2Club = player2 ? teamsMap.get(player2.team) : null;

  // Search filtered candidates for player 1
  const candidates1 = useMemo(() => {
    if (!search1.trim()) return [];
    const q = search1.toLowerCase();
    return players
      .filter((p) => `${p.first_name} ${p.second_name} ${p.web_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [players, search1]);

  // Search filtered candidates for player 2
  const candidates2 = useMemo(() => {
    if (!search2.trim()) return [];
    const q = search2.toLowerCase();
    return players
      .filter((p) => `${p.first_name} ${p.second_name} ${p.web_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [players, search2]);

  const p1Fixtures = player1 ? getUpcomingFixturesForTeam(player1.team, fixtures, teams, 3) : [];
  const p2Fixtures = player2 ? getUpcomingFixturesForTeam(player2.team, fixtures, teams, 3) : [];

  const getFdrColor = (diff: number) => {
    if (diff <= 2) return 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
    if (diff === 3) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (diff === 4) return 'bg-amber-950 text-amber-400 border-amber-800/60';
    return 'bg-rose-950 text-rose-400 border-rose-800/60';
  };

  interface MetricItem {
    label: string;
    v1: number | string;
    v2: number | string;
    num1: number;
    num2: number;
    lowerIsBetter?: boolean;
    format?: (val: number | string) => string;
  }

  const metrics: MetricItem[] = useMemo(() => {
    if (!player1 || !player2) return [];

    const p1Cost = player1.now_cost / 10;
    const p2Cost = player2.now_cost / 10;

    return [
      {
        label: t.explorer.colPrice,
        v1: p1Cost,
        v2: p2Cost,
        num1: p1Cost,
        num2: p2Cost,
        lowerIsBetter: true, // Lower price is cheaper
        format: (v) => `£${Number(v).toFixed(1)}m`,
      },
      {
        label: t.explorer.colPoints,
        v1: player1.total_points,
        v2: player2.total_points,
        num1: player1.total_points,
        num2: player2.total_points,
      },
      {
        label: t.explorer.colForm,
        v1: player1.form,
        v2: player2.form,
        num1: parseFloat(player1.form) || 0,
        num2: parseFloat(player2.form) || 0,
      },
      {
        label: t.explorer.colPpg,
        v1: player1.points_per_game,
        v2: player2.points_per_game,
        num1: parseFloat(player1.points_per_game) || 0,
        num2: parseFloat(player2.points_per_game) || 0,
      },
      {
        label: t.explorer.colMins,
        v1: player1.minutes,
        v2: player2.minutes,
        num1: player1.minutes,
        num2: player2.minutes,
      },
      {
        label: t.compare.goalsLabel,
        v1: player1.goals_scored,
        v2: player2.goals_scored,
        num1: player1.goals_scored,
        num2: player2.goals_scored,
      },
      {
        label: t.compare.assistsLabel,
        v1: player1.assists,
        v2: player2.assists,
        num1: player1.assists,
        num2: player2.assists,
      },
      {
        label: t.compare.cleanSheetsLabel,
        v1: player1.clean_sheets,
        v2: player2.clean_sheets,
        num1: player1.clean_sheets,
        num2: player2.clean_sheets,
      },
      {
        label: t.compare.xgLabel,
        v1: player1.expected_goals || t.explorer.naText,
        v2: player2.expected_goals || t.explorer.naText,
        num1: parseFloat(player1.expected_goals) || 0,
        num2: parseFloat(player2.expected_goals) || 0,
      },
      {
        label: t.compare.xaLabel,
        v1: player1.expected_assists || t.explorer.naText,
        v2: player2.expected_assists || t.explorer.naText,
        num1: parseFloat(player1.expected_assists) || 0,
        num2: parseFloat(player2.expected_assists) || 0,
      },
      {
        label: t.compare.xgiLabel,
        v1: player1.expected_goal_involvements || t.explorer.naText,
        v2: player2.expected_goal_involvements || t.explorer.naText,
        num1: parseFloat(player1.expected_goal_involvements) || 0,
        num2: parseFloat(player2.expected_goal_involvements) || 0,
      },
      {
        label: t.compare.xgcLabel,
        v1: player1.expected_goals_conceded || t.explorer.naText,
        v2: player2.expected_goals_conceded || t.explorer.naText,
        num1: parseFloat(player1.expected_goals_conceded) || 0,
        num2: parseFloat(player2.expected_goals_conceded) || 0,
        lowerIsBetter: true,
      },
      {
        label: t.compare.ictLabel,
        v1: player1.ict_index,
        v2: player2.ict_index,
        num1: parseFloat(player1.ict_index) || 0,
        num2: parseFloat(player2.ict_index) || 0,
      },
      {
        label: t.explorer.colSelected,
        v1: `${player1.selected_by_percent}%`,
        v2: `${player2.selected_by_percent}%`,
        num1: parseFloat(player1.selected_by_percent) || 0,
        num2: parseFloat(player2.selected_by_percent) || 0,
      },
    ];
  }, [player1, player2, t]);

  const p1Wins = metrics.filter((m) =>
    m.lowerIsBetter ? m.num1 < m.num2 : m.num1 > m.num2
  ).length;
  const p2Wins = metrics.filter((m) =>
    m.lowerIsBetter ? m.num2 < m.num1 : m.num2 > m.num1
  ).length;

  return (
    <div className="space-y-6 py-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.compare.title}</h1>
          <p className="text-xs text-slate-400 mt-1">{t.compare.subtitle}</p>
        </div>
        {(player1 || player2) && (
          <button
            onClick={() => {
              setPlayer1(null);
              setPlayer2(null);
              setSearch1('');
              setSearch2('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer w-fit"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.compare.clear}</span>
          </button>
        )}
      </div>

      {/* Selectors Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slot 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {t.compare.selectPlayer1}
            </span>
            {player1 && (
              <button
                onClick={() => setPlayer1(null)}
                className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer"
              >
                {t.compare.changePlayer}
              </button>
            )}
          </div>

          {!player1 ? (
            <div className="space-y-2 relative">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search1}
                  onChange={(e) => setSearch1(e.target.value)}
                  placeholder={t.compare.searchPrompt}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {candidates1.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-lg max-h-56 overflow-y-auto shadow-xl divide-y divide-slate-800/80">
                  {candidates1.map((p) => {
                    const c = teamsMap.get(p.team);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPlayer1(p);
                          setSearch1('');
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-900 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-semibold text-slate-200 text-xs">{p.web_name}</span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            {c?.short_name} · £{(p.now_cost / 10).toFixed(1)}m
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                          {p.total_points} pts
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">
                  {p1Club?.name} · £{(player1.now_cost / 10).toFixed(1)}m
                </div>
                <div className="text-xl font-bold text-white tracking-tight">{player1.web_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {player1.first_name} {player1.second_name}
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums block">
                  {player1.total_points}
                </span>
                <span className="text-[11px] text-slate-400 uppercase">{t.compare.totalPointsLabel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Slot 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              {t.compare.selectPlayer2}
            </span>
            {player2 && (
              <button
                onClick={() => setPlayer2(null)}
                className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer"
              >
                {t.compare.changePlayer}
              </button>
            )}
          </div>

          {!player2 ? (
            <div className="space-y-2 relative">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
                  placeholder={t.compare.searchPrompt}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {candidates2.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-lg max-h-56 overflow-y-auto shadow-xl divide-y divide-slate-800/80">
                  {candidates2.map((p) => {
                    const c = teamsMap.get(p.team);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPlayer2(p);
                          setSearch2('');
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-900 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-semibold text-slate-200 text-xs">{p.web_name}</span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            {c?.short_name} · £{(p.now_cost / 10).toFixed(1)}m
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-cyan-400 tabular-nums">
                          {p.total_points} pts
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">
                  {p2Club?.name} · £{(player2.now_cost / 10).toFixed(1)}m
                </div>
                <div className="text-xl font-bold text-white tracking-tight">{player2.web_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {player2.first_name} {player2.second_name}
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold font-mono text-cyan-400 tabular-nums block">
                  {player2.total_points}
                </span>
                <span className="text-[11px] text-slate-400 uppercase">{t.compare.totalPointsLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Grid */}
      {player1 && player2 ? (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">{t.compare.summaryTitle}</h3>
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <div>
                <span className="font-bold text-emerald-400">
                  {t.compare.leadsIn.replace('{name}', player1.web_name).replace('{count}', p1Wins.toString())}
                </span>
              </div>
              <div>
                <span className="font-bold text-cyan-400">
                  {t.compare.leadsIn.replace('{name}', player2.web_name).replace('{count}', p2Wins.toString())}
                </span>
              </div>
              <div className="text-slate-500">
                {player1.element_type === player2.element_type
                  ? t.compare.positionMatchSame
                  : t.compare.positionMatchDiff}
              </div>
            </div>
          </div>

          {/* Metrics Comparison Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="w-1/3 text-emerald-400 font-bold">{player1.web_name}</span>
              <span className="w-1/3 text-center uppercase tracking-wider">{t.compare.metricCol}</span>
              <span className="w-1/3 text-right text-cyan-400 font-bold">{player2.web_name}</span>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs">
              {metrics.map((m, idx) => {
                const isP1Better = m.lowerIsBetter ? m.num1 < m.num2 : m.num1 > m.num2;
                const isP2Better = m.lowerIsBetter ? m.num2 < m.num1 : m.num2 > m.num1;
                const display1 = m.format ? m.format(m.v1) : m.v1;
                const display2 = m.format ? m.format(m.v2) : m.v2;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Player 1 value */}
                    <div className="w-1/3 flex items-center gap-2">
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          isP1Better ? 'text-emerald-400 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {display1}
                      </span>
                      {isP1Better && (
                        <span className="text-[10px] text-emerald-500 font-bold hidden sm:inline">
                          ★
                        </span>
                      )}
                    </div>

                    {/* Metric Label */}
                    <div className="w-1/3 text-center text-slate-400 font-medium">{m.label}</div>

                    {/* Player 2 value */}
                    <div className="w-1/3 flex items-center justify-end gap-2 text-right">
                      {isP2Better && (
                        <span className="text-[10px] text-cyan-500 font-bold hidden sm:inline">
                          ★
                        </span>
                      )}
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          isP2Better ? 'text-cyan-400 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {display2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Fixtures Comparison */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">{t.compare.fixtureMetrics}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Player 1 Fixtures */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-emerald-400">{player1.web_name}</span>
                <div className="grid grid-cols-3 gap-2">
                  {p1Fixtures.map((f, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-950 border border-slate-800 rounded text-center text-xs"
                    >
                      <div className="font-semibold text-white">
                        {f.opponent} ({f.isHome ? 'H' : 'A'})
                      </div>
                      <div
                        className={`mt-1 text-[10px] font-bold font-mono px-1 py-0.5 rounded border inline-block tabular-nums ${getFdrColor(
                          f.difficulty
                        )}`}
                      >
                        FDR {f.difficulty}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Player 2 Fixtures */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-cyan-400">{player2.web_name}</span>
                <div className="grid grid-cols-3 gap-2">
                  {p2Fixtures.map((f, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-950 border border-slate-800 rounded text-center text-xs"
                    >
                      <div className="font-semibold text-white">
                        {f.opponent} ({f.isHome ? 'H' : 'A'})
                      </div>
                      <div
                        className={`mt-1 text-[10px] font-bold font-mono px-1 py-0.5 rounded border inline-block tabular-nums ${getFdrColor(
                          f.difficulty
                        )}`}
                      >
                        FDR {f.difficulty}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-xl">
          <ArrowRightLeft className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-xs text-slate-400 max-w-sm mx-auto">{t.compare.emptyStatePrompt}</p>
        </div>
      )}
    </div>
  );
};
