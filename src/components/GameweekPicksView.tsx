import React, { useState, useEffect, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLFixture, FPLBootstrap, FPLDreamTeam } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { fetchDreamTeam } from '../lib/fplApi';
import { getCaptainCandidates, getDifferentialPicks } from '../lib/scoring';
import { Award, Sparkles, Star, Zap, Info, Loader2 } from 'lucide-react';

interface GameweekPicksViewProps {
  bootstrap: FPLBootstrap;
  fixtures: FPLFixture[];
  lang: Language;
  onSelectPlayer: (player: FPLElement) => void;
}

export const GameweekPicksView: React.FC<GameweekPicksViewProps> = ({
  bootstrap,
  fixtures,
  lang,
  onSelectPlayer,
}) => {
  const t = translations[lang];

  // Current or previous completed event
  const finishedEvents = bootstrap.events.filter((e) => e.finished);
  const latestFinishedEvent = finishedEvents[finishedEvents.length - 1] || bootstrap.events[0];
  const nextEvent = bootstrap.events.find((e) => e.is_next) || bootstrap.events.find((e) => e.is_current);

  const [selectedGw, setSelectedGw] = useState<number>(latestFinishedEvent?.id || 1);
  const [dreamTeamData, setDreamTeamData] = useState<FPLDreamTeam | null>(null);
  const [loadingDreamTeam, setLoadingDreamTeam] = useState(false);
  const [dreamTeamError, setDreamTeamError] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'dreamTeam' | 'projections'>('dreamTeam');

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

  // Load Dream Team for selected GW
  useEffect(() => {
    let isCancelled = false;

    async function loadDt() {
      setLoadingDreamTeam(true);
      setDreamTeamError(null);
      try {
        const dt = await fetchDreamTeam(selectedGw);
        if (!isCancelled) {
          setDreamTeamData(dt);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error(`Failed to load dream team for GW${selectedGw}:`, err);
          setDreamTeamError(err.message || 'Dream team not available for this round.');
          setDreamTeamData(null);
        }
      } finally {
        if (!isCancelled) setLoadingDreamTeam(false);
      }
    }

    loadDt();

    return () => {
      isCancelled = true;
    };
  }, [selectedGw]);

  // Calculations for upcoming Gameweek projections
  const captainCandidates = useMemo(() => {
    return getCaptainCandidates(bootstrap.elements, bootstrap.teams, fixtures, lang);
  }, [bootstrap.elements, bootstrap.teams, fixtures, lang]);

  const differentialPicks = useMemo(() => {
    return getDifferentialPicks(bootstrap.elements, bootstrap.teams, fixtures, lang);
  }, [bootstrap.elements, bootstrap.teams, fixtures, lang]);

  // Top overall in-form premiums (price >= £8.0m, form >= 4.0)
  const premiumPicks = useMemo(() => {
    return bootstrap.elements
      .filter((p) => p.now_cost >= 80 && p.status === 'a' && parseFloat(p.form) >= 4.0)
      .sort((a, b) => (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0))
      .slice(0, 3);
  }, [bootstrap.elements]);

  const topPerformer = dreamTeamData?.top_player
    ? playersMap.get(dreamTeamData.top_player.id)
    : null;

  return (
    <div className="space-y-6 py-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.picks.title}</h1>
        <p className="text-xs text-slate-400 mt-1">{t.picks.subtitle}</p>
      </div>

      {/* Main Tabs: Actual Dream Team vs Upcoming Projections */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-lg">
        <button
          onClick={() => setActiveSubTab('dreamTeam')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'dreamTeam'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.picks.dreamTeamTab.replace('{gw}', selectedGw.toString())}
        </button>
        <button
          onClick={() => setActiveSubTab('projections')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'projections'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.picks.upcomingPicksTab.replace('{gw}', (nextEvent ? nextEvent.id : selectedGw + 1).toString())}
        </button>
      </div>

      {/* SUB-TAB 1: ACTUAL DREAM TEAM */}
      {activeSubTab === 'dreamTeam' && (
        <div className="space-y-6">
          {/* Gameweek Selector for Dream Team */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">{t.picks.selectGwLabel}</span>
            <select
              value={selectedGw}
              onChange={(e) => setSelectedGw(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {finishedEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{t.picks.dreamTeamNote}</span>
          </div>

          {loadingDreamTeam ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400">{t.picks.loadingDreamTeam}</p>
            </div>
          ) : dreamTeamError ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <p className="text-xs text-amber-400 font-semibold">{t.picks.dreamTeamNotReady}</p>
              <p className="text-[11px] text-slate-500">{dreamTeamError}</p>
            </div>
          ) : dreamTeamData && dreamTeamData.team ? (
            <div className="space-y-6">
              {/* Top Performer Card */}
              {topPerformer && (
                <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-800/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        {t.picks.topPlayer}
                      </span>
                      <h3 className="text-xl font-extrabold text-white">
                        {topPerformer.web_name}
                      </h3>
                      <div className="text-xs text-slate-400">
                        {teamsMap.get(topPerformer.team)?.name} · £{(topPerformer.now_cost / 10).toFixed(1)}m
                      </div>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                      {dreamTeamData.top_player?.points}
                    </span>
                    <span className="text-xs text-slate-400 block uppercase">
                      {t.picks.pointsGwLabel.replace('{gw}', selectedGw.toString())}
                    </span>
                  </div>
                </div>
              )}

              {/* Dream Team Lineup Grid */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-emerald-400" />
                  <span>{t.picks.dreamTeamXi} (GW{selectedGw})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {dreamTeamData.team.map((pick) => {
                    const player = playersMap.get(pick.element);
                    if (!player) return null;
                    const club = teamsMap.get(player.team);

                    return (
                      <div
                        key={pick.element}
                        onClick={() => onSelectPlayer(player)}
                        className="bg-slate-950 border border-slate-800 hover:border-emerald-600/60 rounded-lg p-3 cursor-pointer transition-colors group flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {player.web_name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {club?.short_name} · £{(player.now_cost / 10).toFixed(1)}m
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                            {pick.points}
                          </span>
                          <span className="text-[10px] text-slate-500 block">pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SUB-TAB 2: UPCOMING GAMEWEEK PROJECTIONS */}
      {activeSubTab === 'projections' && (
        <div className="space-y-6">
          {/* Captain Candidates */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {t.picks.captainsTitle}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.picks.captainsDesc}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {captainCandidates.map((c, i) => (
                <div
                  key={c.player.id}
                  onClick={() => onSelectPlayer(c.player)}
                  className="bg-slate-950 border border-slate-800 hover:border-amber-600/60 rounded-lg p-4 cursor-pointer transition-colors group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      {t.picks.rankCaptainBadge.replace('{rank}', (i + 1).toString())}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {t.picks.scorePrefix}: {c.score}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                      {c.player.web_name}
                    </h4>
                    <div className="text-xs text-slate-400">
                      {c.club.name} · £{(c.player.now_cost / 10).toFixed(1)}m
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800/80">
                    {c.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Premium Heavy-Hitters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {t.picks.premiumsTitle}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.picks.premiumsDesc}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {premiumPicks.map((p) => {
                const c = teamsMap.get(p.team);
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPlayer(p)}
                    className="bg-slate-950 border border-slate-800 hover:border-emerald-600/60 rounded-lg p-4 cursor-pointer transition-colors group space-y-2"
                  >
                    <div className="text-xs text-slate-400">{c?.name}</div>
                    <h4 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                      {p.web_name}
                    </h4>
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-300 pt-2 border-t border-slate-800/80">
                      <span>£{(p.now_cost / 10).toFixed(1)}m</span>
                      <span>Form: {p.form}</span>
                      <span className="text-emerald-400 font-bold">{p.total_points} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Differential Picks */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {t.picks.differentialsTitle}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.picks.differentialsDesc}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {differentialPicks.map((d) => (
                <div
                  key={d.player.id}
                  onClick={() => onSelectPlayer(d.player)}
                  className="bg-slate-950 border border-slate-800 hover:border-cyan-600/60 rounded-lg p-4 cursor-pointer transition-colors group space-y-2"
                >
                  <div className="text-xs text-slate-400">{d.club.name}</div>
                  <h4 className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                    {d.player.web_name}
                  </h4>
                  <div className="text-[11px] font-mono text-cyan-400">{d.reason}</div>
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-300 pt-2 border-t border-slate-800/80">
                    <span>£{(d.player.now_cost / 10).toFixed(1)}m</span>
                    <span>{d.player.total_points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projection Disclaimer */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t.picks.projectedDisclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
};
