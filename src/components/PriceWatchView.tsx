import React, { useState, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLBootstrap } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { TrendingUp, TrendingDown, DollarSign, Info } from 'lucide-react';

interface PriceWatchViewProps {
  bootstrap: FPLBootstrap;
  lang: Language;
  onSelectPlayer: (player: FPLElement) => void;
}

export const PriceWatchView: React.FC<PriceWatchViewProps> = ({
  bootstrap,
  lang,
  onSelectPlayer,
}) => {
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'risers' | 'fallers' | 'costChange'>('risers');

  const teamsMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    bootstrap.teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [bootstrap.teams]);

  // Calculate net transfers for each player: transfers_in_event - transfers_out_event
  const playersWithNet = useMemo(() => {
    return bootstrap.elements.map((p) => {
      const net = p.transfers_in_event - p.transfers_out_event;
      return {
        ...p,
        netTransfers: net,
      };
    });
  }, [bootstrap.elements]);

  // Risers: Top positive net transfers
  const topRisers = useMemo(() => {
    return [...playersWithNet]
      .sort((a, b) => b.netTransfers - a.netTransfers)
      .slice(0, 15);
  }, [playersWithNet]);

  // Fallers: Top negative net transfers
  const topFallers = useMemo(() => {
    return [...playersWithNet]
      .sort((a, b) => a.netTransfers - b.netTransfers)
      .slice(0, 15);
  }, [playersWithNet]);

  // Season price movers (highest absolute cost_change_start)
  const seasonMovers = useMemo(() => {
    return [...playersWithNet]
      .sort((a, b) => Math.abs(b.cost_change_start) - Math.abs(a.cost_change_start))
      .slice(0, 15);
  }, [playersWithNet]);

  const activeList =
    activeTab === 'risers' ? topRisers : activeTab === 'fallers' ? topFallers : seasonMovers;

  return (
    <div className="space-y-6 py-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.priceWatch.title}</h1>
        <p className="text-xs text-slate-400 mt-1">{t.priceWatch.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-lg">
        <button
          onClick={() => setActiveTab('risers')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'risers'
              ? 'bg-slate-800 text-emerald-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{t.priceWatch.risersTab}</span>
        </button>
        <button
          onClick={() => setActiveTab('fallers')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'fallers'
              ? 'bg-slate-800 text-rose-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{t.priceWatch.fallersTab}</span>
        </button>
        <button
          onClick={() => setActiveTab('costChange')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'costChange'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>{t.priceWatch.costChangeTab}</span>
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">{t.explorer.colPlayer}</th>
                <th className="py-3 px-3">{t.explorer.colClub}</th>
                <th className="py-3 px-3 text-right">{t.priceWatch.currentPrice}</th>
                <th className="py-3 px-3 text-right">{t.priceWatch.priceChangeGameweek}</th>
                <th className="py-3 px-3 text-right">{t.priceWatch.priceChangeSeason}</th>
                <th className="py-3 px-4 text-right">{t.priceWatch.netTransfers}</th>
                <th className="py-3 px-4 text-right">{t.priceWatch.tableTrendHeader}</th>
                <th className="py-3 px-4 text-right">{t.priceWatch.ownership}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {activeList.map((player) => {
                const club = teamsMap.get(player.team);
                const currentPriceM = (player.now_cost / 10).toFixed(1);
                const gwChangeM = (player.cost_change_event / 10).toFixed(1);
                const startChangeM = (player.cost_change_start / 10).toFixed(1);

                const isPositiveTrend = player.netTransfers > 0;
                const isNegativeTrend = player.netTransfers < 0;

                return (
                  <tr
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Player Name */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {player.web_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {player.first_name} {player.second_name}
                      </div>
                    </td>

                    {/* Club */}
                    <td className="py-3 px-3 text-slate-300 font-medium">
                      {club?.short_name || 'UNK'}
                    </td>

                    {/* Current Price */}
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-white font-bold">
                      £{currentPriceM}m
                    </td>

                    {/* GW Change */}
                    <td
                      className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                        player.cost_change_event > 0
                          ? 'text-emerald-400'
                          : player.cost_change_event < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {player.cost_change_event > 0 ? `+£${gwChangeM}m` : player.cost_change_event < 0 ? `-£${Math.abs(Number(gwChangeM)).toFixed(1)}m` : '£0.0m'}
                    </td>

                    {/* Season Change */}
                    <td
                      className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                        player.cost_change_start > 0
                          ? 'text-emerald-400'
                          : player.cost_change_start < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {player.cost_change_start > 0 ? `+£${startChangeM}m` : player.cost_change_start < 0 ? `-£${Math.abs(Number(startChangeM)).toFixed(1)}m` : '£0.0m'}
                    </td>

                    {/* Net Transfers */}
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                        isPositiveTrend
                          ? 'text-emerald-400'
                          : isNegativeTrend
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {isPositiveTrend ? '+' : ''}
                      {player.netTransfers.toLocaleString()}
                    </td>

                    {/* Transfer Trend Label */}
                    <td className="py-3 px-4 text-right">
                      {isPositiveTrend ? (
                        <span className="text-emerald-400 text-xs font-medium">
                          {t.priceWatch.positiveTrend}
                        </span>
                      ) : isNegativeTrend ? (
                        <span className="text-rose-400 text-xs font-medium">
                          {t.priceWatch.negativeTrend}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">{t.priceWatch.stableTrend}</span>
                      )}
                    </td>

                    {/* Ownership */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      {player.selected_by_percent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{t.priceWatch.disclaimer}</p>
      </div>
    </div>
  );
};
