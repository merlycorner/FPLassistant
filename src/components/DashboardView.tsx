import React, { useState, useEffect, useMemo } from 'react';
import { FPLBootstrap, FPLFixture } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { fetchLiveEvent } from '../lib/fplApi';
import {
  Clock,
  Users,
  Award,
  Calendar,
  ArrowRight,
  TrendingUp,
  Shield,
  Search,
  Sparkles,
  Activity,
  Flame,
  Crown,
  AlertTriangle,
} from 'lucide-react';

interface DashboardViewProps {
  bootstrap: FPLBootstrap;
  fixtures: FPLFixture[];
  lang: Language;
  onNavigate: (tab: string) => void;
  lastUpdated: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  bootstrap,
  fixtures,
  lang,
  onNavigate,
  lastUpdated,
}) => {
  const t = translations[lang];

  // Current active / live gameweek (GW 8)
  const currentLiveEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events[0];
  // Next upcoming gameweek (GW 9)
  const nextEvent = bootstrap.events.find((e) => e.is_next) || currentLiveEvent;

  // Live element scores for Gameweek
  const [livePointsMap, setLivePointsMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!currentLiveEvent) return;
    let isCancelled = false;

    async function loadLiveGw() {
      try {
        const liveData = await fetchLiveEvent(currentLiveEvent.id);
        if (!isCancelled && liveData?.elements) {
          const map = new Map<number, number>();
          liveData.elements.forEach((el) => {
            map.set(el.id, el.stats?.total_points || 0);
          });
          setLivePointsMap(map);
        }
      } catch (err) {
        console.error('Failed to load live event data:', err);
      }
    }

    loadLiveGw();
    return () => {
      isCancelled = true;
    };
  }, [currentLiveEvent]);

  // Countdown timer calculation for Next GW
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
  });

  useEffect(() => {
    if (!nextEvent?.deadline_time) return;

    function updateCountdown() {
      const target = new Date(nextEvent!.deadline_time).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);

      setTimeLeft({ days, hours, minutes });
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextEvent]);

  // Formatted deadline date
  const deadlineFormatted = nextEvent?.deadline_time
    ? new Date(nextEvent.deadline_time).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : t.explorer.naText;

  // Current Gameweek Fixtures (Live / Finished matches)
  const currentGwFixtures = useMemo(() => {
    if (!currentLiveEvent) return [];
    return fixtures.filter((f) => f.event === currentLiveEvent.id);
  }, [fixtures, currentLiveEvent]);

  // Next Gameweek Fixtures
  const nextGwFixtures = useMemo(() => {
    if (!nextEvent) return [];
    return fixtures.filter((f) => f.event === nextEvent.id);
  }, [fixtures, nextEvent]);

  const teamsMap = useMemo(() => {
    const map = new Map<number, any>();
    bootstrap.teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [bootstrap.teams]);

  const getTeam = (teamId: number) => teamsMap.get(teamId);

  const getFdrColor = (difficulty: number) => {
    if (difficulty <= 2) return 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
    if (difficulty === 3) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (difficulty === 4) return 'bg-amber-950 text-amber-400 border-amber-800/60';
    return 'bg-rose-950 text-rose-400 border-rose-800/60';
  };

  // Top performers in current Gameweek
  const topLivePerformers = useMemo(() => {
    if (livePointsMap.size === 0) return [];
    return [...bootstrap.elements]
      .map((p) => ({
        player: p,
        pts: livePointsMap.get(p.id) || 0,
      }))
      .filter((item) => item.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 5);
  }, [bootstrap.elements, livePointsMap]);

  return (
    <div className="space-y-8 py-6">
      {/* 1. Live Gameweek Banner & Active Status */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-800/50 rounded-xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-md uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span>{currentLiveEvent ? currentLiveEvent.name : 'Gameweek 8'} LIVE</span>
              </span>
              <span className="text-xs text-slate-400">
                {currentLiveEvent?.finished ? t.dashboard.gwFinishedBadge : t.dashboard.gwInProgressBadge}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gameweek {currentLiveEvent?.id || 8} Live
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{t.dashboard.nextGwDeadlinePrefix.replace('{gw}', nextEvent?.name || '')} </span>
                <span className="text-white font-medium">{deadlineFormatted}</span>
              </span>
            </div>
          </div>

          {/* Countdown card to NEXT deadline */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-4 sm:p-5 flex items-center gap-5 shrink-0">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Deadline GW {nextEvent?.id}</span>
              </div>
              <div className="text-[11px] text-slate-500">{t.dashboard.countdownSub}</div>
            </div>

            <div className="flex items-center gap-3 text-center">
              <div className="min-w-12">
                <span className="block text-2xl font-bold font-mono tabular-nums text-white">
                  {timeLeft.days}
                </span>
                <span className="text-[10px] text-slate-400 uppercase">{t.dashboard.days}</span>
              </div>
              <span className="text-slate-600 font-bold">:</span>
              <div className="min-w-12">
                <span className="block text-2xl font-bold font-mono tabular-nums text-white">
                  {timeLeft.hours}
                </span>
                <span className="text-[10px] text-slate-400 uppercase">{t.dashboard.hours}</span>
              </div>
              <span className="text-slate-600 font-bold">:</span>
              <div className="min-w-12">
                <span className="block text-2xl font-bold font-mono tabular-nums text-white">
                  {timeLeft.minutes}
                </span>
                <span className="text-[10px] text-slate-400 uppercase">{t.dashboard.minutes}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Notice */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <span>{t.dashboard.statusNotice}</span>
          <span className="tabular-nums">
            {t.app.lastUpdated}: {new Date(lastUpdated).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US')}
          </span>
        </div>
      </div>

      {/* 2. Key Numbers Grid (Clarified Total Managers vs Footballers + LIVE GW Scores) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Managers Worldwide */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.dashboard.totalManagers}</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-cyan-400">
            {bootstrap.total_players.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">{t.dashboard.totalManagersDesc}</div>
        </div>

        {/* Database Footballers */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.dashboard.totalFootballers}</span>
            <Shield className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-white">
            {bootstrap.elements.length.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">{t.dashboard.totalFootballersDesc}</div>
        </div>

        {/* Average Score in LIVE Gameweek */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>
              {t.dashboard.avgScoreLiveGw.replace('{gw}', (currentLiveEvent?.id || 8).toString())}
            </span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {currentLiveEvent?.average_entry_score
              ? `${currentLiveEvent.average_entry_score} pts`
              : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t.dashboard.avgScoreDesc.replace('{gw}', currentLiveEvent?.name || 'GW 8')}
          </div>
        </div>

        {/* Highest Score in LIVE Gameweek */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>
              {t.dashboard.highestScoreLiveGw.replace('{gw}', (currentLiveEvent?.id || 8).toString())}
            </span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-400">
            {currentLiveEvent?.highest_score ? `${currentLiveEvent.highest_score} pts` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-400">{t.dashboard.highestScoreDesc}</div>
        </div>
      </div>

      {/* 3. Live Gameweek Matches & Top Scorers Strip */}
      {currentGwFixtures.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white tracking-tight">
                  {t.dashboard.liveFixturesTitle.replace(
                    '{gw}',
                    (currentLiveEvent?.id || 8).toString()
                  )}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.dashboard.liveFixturesDesc}
              </p>
            </div>

            <div className="text-xs text-slate-400">
              {t.dashboard.matchesFinished
                .replace('{finished}', currentGwFixtures.filter((f) => f.finished).length.toString())
                .replace('{total}', currentGwFixtures.length.toString())}
            </div>
          </div>

          {/* Matches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentGwFixtures.map((fix) => {
              const homeTeam = getTeam(fix.team_h);
              const awayTeam = getTeam(fix.team_a);
              const isFinished = fix.finished;

              return (
                <div
                  key={fix.id}
                  className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-lg"
                >
                  {/* Home Team */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-semibold text-white">
                      {homeTeam?.name || `Team ${fix.team_h}`}
                    </span>
                  </div>

                  {/* Score or Kickoff */}
                  <div className="px-4 text-center shrink-0">
                    {isFinished || fix.team_h_score !== null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-extrabold text-white tabular-nums px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                          {fix.team_h_score ?? 0} - {fix.team_a_score ?? 0}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                          {isFinished ? t.dashboard.ftBadge : t.dashboard.liveBadge}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-slate-400">
                        {fix.kickoff_time
                          ? new Date(fix.kickoff_time).toLocaleTimeString(
                              lang === 'id' ? 'id-ID' : 'en-GB',
                              { weekday: 'short', hour: '2-digit', minute: '2-digit' }
                            )
                          : 'TBD'}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-end gap-2 flex-1 text-right">
                    <span className="text-sm font-semibold text-white">
                      {awayTeam?.name || `Team ${fix.team_a}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Live Scorers in Current Gameweek */}
          {topLivePerformers.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                {t.dashboard.topScorersTitle.replace('{gw}', (currentLiveEvent?.id || 8).toString())}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {topLivePerformers.map((item) => {
                  const club = teamsMap.get(item.player.team);
                  return (
                    <div
                      key={item.player.id}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[100px]">
                          {item.player.web_name}
                        </div>
                        <div className="text-[10px] text-slate-400">{club?.short_name}</div>
                      </div>
                      <span className="text-lg font-extrabold font-mono text-emerald-400 tabular-nums">
                        {item.pts}
                        <span className="text-[10px] text-slate-500 font-normal ml-0.5">pts</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Quick Navigation Cards */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">{t.dashboard.quickNav}</h2>
          <p className="text-xs text-slate-400">{t.dashboard.quickNavDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('squad')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <Shield className="w-5 h-5 text-indigo-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                {t.nav.squad}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardSquadDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-indigo-400 font-medium">
              {t.dashboard.cardSquadBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('transfers')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                {t.nav.transfers}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardTransfersDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-emerald-400 font-medium">
              {t.dashboard.cardTransfersBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('explorer')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <Search className="w-5 h-5 text-emerald-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                {t.nav.explorer}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardExplorerDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-emerald-400 font-medium">
              {t.dashboard.cardExplorerBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('compare')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <Users className="w-5 h-5 text-cyan-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-cyan-300 transition-colors">
                {t.nav.compare}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardCompareDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-cyan-400 font-medium">
              {t.dashboard.cardCompareBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('picks')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                {t.nav.picks}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardPicksDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-amber-400 font-medium">
              {t.dashboard.cardPicksBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('priceWatch')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <Award className="w-5 h-5 text-rose-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-rose-300 transition-colors">
                {t.nav.priceWatch}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardPriceDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-rose-400 font-medium">
              {t.dashboard.cardPriceBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('captains')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <Crown className="w-5 h-5 text-amber-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                {t.nav.captains}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardCaptainsDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-amber-400 font-medium">
              {t.dashboard.cardCaptainsBtn}
            </div>
          </button>

          <button
            onClick={() => onNavigate('injuries')}
            className="group text-left p-5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white group-hover:text-rose-300 transition-colors">
                {t.nav.injuries}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {t.dashboard.cardInjuriesDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-rose-400 font-medium">
              {t.dashboard.cardInjuriesBtn}
            </div>
          </button>
        </div>
      </div>

      {/* 5. Upcoming Gameweek Fixtures Preview */}
      {nextGwFixtures.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {t.dashboard.upcomingFixtures} ({nextEvent?.name})
              </h2>
              <p className="text-xs text-slate-400">{t.dashboard.difficultyLegend}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                <span>FDR 2</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-slate-600 inline-block"></span>
                <span>FDR 3</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block"></span>
                <span>FDR 4-5</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nextGwFixtures.map((fix) => {
              const homeTeam = getTeam(fix.team_h);
              const awayTeam = getTeam(fix.team_a);
              const kickOff = fix.kickoff_time
                ? new Date(fix.kickoff_time).toLocaleTimeString(
                    lang === 'id' ? 'id-ID' : 'en-GB',
                    { weekday: 'short', hour: '2-digit', minute: '2-digit' }
                  )
                : 'TBD';

              return (
                <div
                  key={fix.id}
                  className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg"
                >
                  {/* Home Team */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-semibold text-white">
                      {homeTeam?.name || `Team ${fix.team_h}`}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${getFdrColor(
                        fix.team_h_difficulty
                      )}`}
                    >
                      FDR {fix.team_h_difficulty}
                    </span>
                  </div>

                  {/* Kickoff */}
                  <div className="px-3 text-center shrink-0">
                    <span className="text-xs font-mono text-slate-400 block tabular-nums">
                      {kickOff}
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-end gap-2 flex-1 text-right">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${getFdrColor(
                        fix.team_a_difficulty
                      )}`}
                    >
                      FDR {fix.team_a_difficulty}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {awayTeam?.name || `Team ${fix.team_a}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
