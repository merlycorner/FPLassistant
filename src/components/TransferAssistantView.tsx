import React, { useState, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLFixture, FPLBootstrap, UserSquadState } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { calculateTransferRecommendations, getStrategyWeights } from '../lib/scoring';
import {
  TrendingUp,
  Search,
  CheckCircle,
  AlertTriangle,
  Info,
  Sliders,
  DollarSign,
} from 'lucide-react';

interface TransferAssistantViewProps {
  bootstrap: FPLBootstrap;
  fixtures: FPLFixture[];
  squadState: UserSquadState;
  lang: Language;
  initialPlayerToSell?: FPLElement | null;
  onSwapInSquad?: (playerOut: FPLElement, playerIn: FPLElement) => void;
}

export const TransferAssistantView: React.FC<TransferAssistantViewProps> = ({
  bootstrap,
  fixtures,
  squadState,
  lang,
  initialPlayerToSell = null,
  onSwapInSquad,
}) => {
  const t = translations[lang];

  const playersMap = useMemo(() => {
    const map = new Map<number, FPLElement>();
    bootstrap.elements.forEach((p) => map.set(p.id, p));
    return map;
  }, [bootstrap.elements]);

  const teamsMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    bootstrap.teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [bootstrap.teams]);

  // Squad players
  const squadElements: FPLElement[] = squadState.picks
    .map((p) => playersMap.get(p.elementId))
    .filter((p): p is FPLElement => Boolean(p));

  // State: selected player to sell
  const [playerToSell, setPlayerToSell] = useState<FPLElement | null>(
    initialPlayerToSell || squadElements[0] || null
  );

  // Search for player to sell if choosing from outside squad
  const [searchSell, setSearchSell] = useState('');
  const [extraBudgetM, setExtraBudgetM] = useState<number>(0.0);
  const [numTransfers, setNumTransfers] = useState<number>(1);
  const [strategy, setStrategy] = useState<'balanced' | 'form' | 'fixtures' | 'xg' | 'value'>('balanced');

  const candidatesToSell = useMemo(() => {
    if (!searchSell.trim()) return [];
    const q = searchSell.toLowerCase();
    return bootstrap.elements
      .filter((p) => `${p.first_name} ${p.second_name} ${p.web_name}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [bootstrap.elements, searchSell]);

  // Calculate maximum budget for replacement in tenths
  const maxBudgetTenths = useMemo(() => {
    if (!playerToSell) return 0;
    const extraTenths = Math.round(extraBudgetM * 10);
    return playerToSell.now_cost + extraTenths;
  }, [playerToSell, extraBudgetM]);

  // Current squad element IDs
  const currentSquadElementIds = useMemo(() => {
    return squadState.picks.map((p) => p.elementId);
  }, [squadState.picks]);

  // Calculate top 3 recommendations
  const recommendations = useMemo(() => {
    if (!playerToSell) return [];
    return calculateTransferRecommendations(
      playerToSell,
      bootstrap.elements,
      bootstrap.teams,
      fixtures,
      maxBudgetTenths,
      currentSquadElementIds,
      strategy,
      lang
    );
  }, [
    playerToSell,
    bootstrap.elements,
    bootstrap.teams,
    fixtures,
    maxBudgetTenths,
    currentSquadElementIds,
    strategy,
    lang,
  ]);

  const weights = getStrategyWeights(strategy);

  const getFdrColor = (diff: number) => {
    if (diff <= 2) return 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
    if (diff === 3) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (diff === 4) return 'bg-amber-950 text-amber-400 border-amber-800/60';
    return 'bg-rose-950 text-rose-400 border-rose-800/60';
  };

  const posName = playerToSell
    ? playerToSell.element_type === 1
      ? 'GKP'
      : playerToSell.element_type === 2
      ? 'DEF'
      : playerToSell.element_type === 3
      ? 'MID'
      : 'FWD'
    : '';

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.transfers.title}</h1>
        <p className="text-xs text-slate-400 mt-1">{t.transfers.subtitle}</p>
      </div>

      {/* Control Panel / Inputs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Player to Sell */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-rose-400 block">
              {t.transfers.sellPlayerLabel}
            </label>

            {/* Quick picker from user squad */}
            {squadElements.length > 0 && (
              <div>
                <select
                  value={playerToSell ? playerToSell.id : ''}
                  onChange={(e) => {
                    const found = playersMap.get(Number(e.target.value));
                    if (found) setPlayerToSell(found);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="" disabled>
                    {t.transfers.selectFromSquad}
                  </option>
                  {squadElements.map((p) => {
                    const c = teamsMap.get(p.team);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.web_name} ({c?.short_name}) - £{(p.now_cost / 10).toFixed(1)}m
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Search any player */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchSell}
                onChange={(e) => setSearchSell(e.target.value)}
                placeholder={t.transfers.selectAnyPlayer}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />

              {candidatesToSell.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-lg max-h-48 overflow-y-auto shadow-xl divide-y divide-slate-800/80">
                  {candidatesToSell.map((p) => {
                    const c = teamsMap.get(p.team);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPlayerToSell(p);
                          setSearchSell('');
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-900 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <span className="font-semibold text-slate-200">{p.web_name}</span>
                        <span className="text-slate-500">
                          {c?.short_name} · £{(p.now_cost / 10).toFixed(1)}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 2. Extra Budget (In The Bank) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {t.transfers.extraBudgetLabel}
              </label>
              <span className="font-mono text-xs font-bold text-emerald-400">
                £{extraBudgetM.toFixed(1)}m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5.0"
                step="0.1"
                value={extraBudgetM}
                onChange={(e) => setExtraBudgetM(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>£0.0m</span>
              <span>£2.5m</span>
              <span>£5.0m</span>
            </div>
          </div>

          {/* 3. Strategy Priority */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
              {t.transfers.strategyLabel}
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="balanced">{t.transfers.stratBalanced}</option>
              <option value="form">{t.transfers.stratForm}</option>
              <option value="fixtures">{t.transfers.stratFixtures}</option>
              <option value="xg">{t.transfers.stratXg}</option>
              <option value="value">{t.transfers.stratValue}</option>
            </select>
            <div className="text-[11px] text-slate-400">
              Form {(weights.formWeight * 100).toFixed(0)}% · Fixtures{' '}
              {(weights.fixtureWeight * 100).toFixed(0)}% · xGI{' '}
              {(weights.xgWeight * 100).toFixed(0)}% · Value{' '}
              {(weights.valueWeight * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Selected Player Summary Banner */}
        {playerToSell && (
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-rose-950 border border-rose-800/80 text-rose-400 font-bold flex items-center justify-center shrink-0">
                OUT
              </span>
              <div>
                <div className="font-bold text-white text-sm">
                  {playerToSell.first_name} {playerToSell.second_name} ({playerToSell.web_name})
                </div>
                <div className="text-slate-400">
                  {teamsMap.get(playerToSell.team)?.name} · {t.transfers.posLabel} {posName} · {t.transfers.priceLabel}{' '}
                  <span className="font-mono text-emerald-400 font-bold">
                    £{(playerToSell.now_cost / 10).toFixed(1)}m
                  </span>
                </div>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-slate-400 block text-[11px] uppercase">
                {t.transfers.maxBudgetLabel}
              </span>
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                £{(maxBudgetTenths / 10).toFixed(1)}m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">
            {t.transfers.recommendationsTitle}
          </h2>
          <p className="text-xs text-slate-400">{t.transfers.recommendationsSubtitle}</p>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-xs text-slate-300 font-semibold">{t.transfers.noValidOptions}</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              {t.transfers.noValidOptionsDetail}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {recommendations.map((rec, index) => {
              const p = rec.player;
              const price = (p.now_cost / 10).toFixed(1);
              const rankBadge = index === 0 ? t.transfers.rank1Badge : index === 1 ? t.transfers.rank2Badge : t.transfers.rank3Badge;

              return (
                <div
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5 hover:border-slate-700 transition-all shadow-lg"
                >
                  <div className="space-y-4">
                    {/* Top Rank & Score */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        {rankBadge}
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg">
                        <span className="text-[10px] text-slate-400 uppercase">{t.transfers.scorePrefix}</span>
                        <span className="text-sm font-extrabold font-mono text-emerald-400 tabular-nums">
                          {rec.score}/100
                        </span>
                      </div>
                    </div>

                    {/* Player Name & Cost */}
                    <div>
                      <div className="text-xs text-slate-400">
                        {rec.club.name} · {posName}
                      </div>
                      <h3 className="text-xl font-extrabold text-white tracking-tight">
                        {p.web_name}
                      </h3>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {p.first_name} {p.second_name}
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-slate-800/80">
                      <div className="p-2 bg-slate-950/60 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">{t.explorer.colPrice}</span>
                        <span className="text-xs font-bold font-mono text-emerald-400 tabular-nums">
                          £{price}m
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">{t.explorer.colPoints}</span>
                        <span className="text-xs font-bold font-mono text-white tabular-nums">
                          {p.total_points}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">{t.explorer.colForm}</span>
                        <span className="text-xs font-bold font-mono text-slate-300 tabular-nums">
                          {p.form}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">xGI</span>
                        <span className="text-xs font-bold font-mono text-cyan-400 tabular-nums">
                          {p.expected_goal_involvements || '0.0'}
                        </span>
                      </div>
                    </div>

                    {/* Upcoming Fixtures */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        {t.transfers.upcoming3}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {rec.upcomingFixtures.map((f, i) => (
                          <div
                            key={i}
                            className="p-1.5 bg-slate-950 border border-slate-800 rounded text-center text-[11px]"
                          >
                            <span className="font-semibold text-white block">
                              {f.opponent} ({f.isHome ? 'H' : 'A'})
                            </span>
                            <span
                              className={`text-[9px] font-bold font-mono px-1 py-0.2 rounded border inline-block mt-0.5 tabular-nums ${getFdrColor(
                                f.difficulty
                              )}`}
                            >
                              FDR {f.difficulty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Strengths (Pros) */}
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>{t.transfers.prosLabel}</span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {rec.pros.map((pro, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold">·</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Risks & Limitations */}
                    <div>
                      <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{t.transfers.risksLabel}</span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-400">
                        {rec.risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold">·</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Rationale */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs text-slate-300 leading-relaxed">
                      <span className="font-semibold text-slate-200 block mb-0.5">
                        {t.transfers.rationaleLabel}:
                      </span>
                      {rec.rationale}
                    </div>
                  </div>

                  {/* Swap Button if user has squad */}
                  {onSwapInSquad && playerToSell && squadElements.some((p) => p.id === playerToSell.id) && (
                    <button
                      onClick={() => onSwapInSquad(playerToSell, p)}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>{t.transfers.swapIntoSquad.replace('{name}', p.web_name)}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Calculation Transparency Notice */}
        <div className="mt-8 p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t.transfers.transparencyNote}</p>
        </div>
      </div>
    </div>
  );
};
