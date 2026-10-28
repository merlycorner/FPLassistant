import React, { useState, useMemo } from 'react';
import { FPLElement, FPLTeam, FPLFixture, FPLBootstrap, UserSquadState } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { getUpcomingFixturesForTeam } from '../lib/scoring';
import { ClubJersey } from './ClubJersey';
import { Crown, Sparkles, Star, Zap, Info, ShieldCheck, Check } from 'lucide-react';

interface CaptainRecommenderViewProps {
  bootstrap: FPLBootstrap;
  fixtures: FPLFixture[];
  squadState: UserSquadState;
  lang: Language;
  onSelectPlayer: (player: FPLElement) => void;
  onSetCaptainInSquad?: (elementId: number) => void;
}

interface ScoredCaptain {
  player: FPLElement;
  club: FPLTeam;
  score: number;
  formScore: number;
  fixtureScore: number;
  threatScore: number;
  minsScore: number;
  nextMatch: {
    opponent: string;
    isHome: boolean;
    difficulty: number;
  } | null;
  reason: string;
}

export const CaptainRecommenderView: React.FC<CaptainRecommenderViewProps> = ({
  bootstrap,
  fixtures,
  squadState,
  lang,
  onSelectPlayer,
  onSetCaptainInSquad,
}) => {
  const t = translations[lang];

  // Active / next event
  const nextEvent = bootstrap.events.find((e) => e.is_next) || bootstrap.events[0];
  const [targetGw, setTargetGw] = useState<number>(nextEvent?.id || 9);

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

  // Scoring engine for captains for the target Gameweek
  function scoreCaptainCandidate(player: FPLElement, gw: number): ScoredCaptain {
    const club = teamsMap.get(player.team) || {
      id: player.team,
      name: '',
      short_name: 'UNK',
      code: 0,
      strength: 3,
      strength_overall_home: 1000,
      strength_overall_away: 1000,
      strength_attack_home: 1000,
      strength_attack_away: 1000,
      strength_defence_home: 1000,
      strength_defence_away: 1000,
    };

    // Find fixture(s) for this player's team in the target Gameweek (gw)
    const gwFixtures = fixtures.filter(
      (f) => f.event === gw && (f.team_h === player.team || f.team_a === player.team)
    );

    let nextMatch: { opponent: string; isHome: boolean; difficulty: number } | null = null;
    let diff = 3;
    let isHome = false;
    let fixtureScore = 50;

    if (gwFixtures.length > 0) {
      const primaryFixture = gwFixtures[0];
      isHome = primaryFixture.team_h === player.team;
      const oppId = isHome ? primaryFixture.team_a : primaryFixture.team_h;
      const oppTeam = teamsMap.get(oppId);
      diff = isHome ? (primaryFixture.team_h_difficulty || 3) : (primaryFixture.team_a_difficulty || 3);

      if (gwFixtures.length > 1) {
        // Double Gameweek
        const opps = gwFixtures
          .map((fx) => {
            const h = fx.team_h === player.team;
            const oId = h ? fx.team_a : fx.team_h;
            return `${teamsMap.get(oId)?.short_name || 'UNK'} (${h ? 'H' : 'A'})`;
          })
          .join(' & ');

        nextMatch = {
          opponent: opps,
          isHome,
          difficulty: diff,
        };
      } else {
        nextMatch = {
          opponent: oppTeam?.short_name || `Club ${oppId}`,
          isHome,
          difficulty: diff,
        };
      }

      // Fixture ease: FDR 2 = 100, FDR 3 = 65, FDR 4 = 35, FDR 5 = 15
      const rawEase = diff <= 2 ? 100 : diff === 3 ? 65 : diff === 4 ? 35 : 15;
      const baseFixtureScore = Math.min(100, Math.round(rawEase * (isHome ? 1.15 : 0.9)));
      // DGW bonus if team plays 2 matches in this Gameweek
      fixtureScore = gwFixtures.length > 1 ? Math.min(100, Math.round(baseFixtureScore * 1.35)) : baseFixtureScore;
    } else {
      // Blank Gameweek (no match scheduled in targetGw)
      nextMatch = null;
      fixtureScore = 0;
    }

    const rawForm = parseFloat(player.form) || 0;
    const rawXgi = parseFloat(player.expected_goal_involvements) || 0;

    // Component 1: Form (35%)
    const formScore = Math.min(100, Math.round(rawForm * 11));

    // Component 3: xGI Threat (25%)
    const threatScore = Math.min(100, Math.round(rawXgi * 16));

    // Component 4: Minutes reliability (10%)
    const minsScore = player.minutes >= 500 ? 100 : Math.round((player.minutes / 500) * 100);

    const isAvailable = player.status === 'a' ? 1.0 : (player.chance_of_playing_next_round ?? 50) / 100;

    const totalScore = Math.round(
      (formScore * 0.35 + fixtureScore * 0.30 + threatScore * 0.25 + minsScore * 0.10) * isAvailable
    );

    const reason = nextMatch
      ? `GW${gw}: vs ${nextMatch.opponent} (${isHome ? 'H' : 'A'}) · FDR ${diff} · Form ${player.form}`
      : `${t.captains.blankFixture} GW${gw}`;

    return {
      player,
      club,
      score: totalScore,
      formScore,
      fixtureScore,
      threatScore,
      minsScore,
      nextMatch,
      reason,
    };
  }

  // Best captain from user's squad for targetGw
  const squadCaptainPicks = useMemo(() => {
    if (squadElements.length === 0) return [];
    // Only outfielders (MID & FWD) and high-scoring DEF
    return squadElements
      .filter((p) => p.element_type >= 2 && p.status === 'a')
      .map((p) => scoreCaptainCandidate(p, targetGw))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [squadElements, targetGw, fixtures, teamsMap]);

  // Top league-wide primary candidates (Heavy Hitters) for targetGw
  const primaryLeagueCaptains = useMemo(() => {
    return bootstrap.elements
      .filter(
        (p) =>
          (p.element_type === 3 || p.element_type === 4) &&
          p.status === 'a' &&
          p.now_cost >= 75 &&
          parseFloat(p.form) >= 3.0
      )
      .map((p) => scoreCaptainCandidate(p, targetGw))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [bootstrap.elements, targetGw, fixtures, teamsMap]);

  // Differential Captains (Ownership < 15%) for targetGw
  const differentialCaptains = useMemo(() => {
    return bootstrap.elements
      .filter((p) => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        const form = parseFloat(p.form) || 0;
        return (
          (p.element_type === 3 || p.element_type === 4) &&
          ownership < 15.0 &&
          form >= 3.5 &&
          p.status === 'a' &&
          p.minutes >= 300
        );
      })
      .map((p) => scoreCaptainCandidate(p, targetGw))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [bootstrap.elements, targetGw, fixtures, teamsMap]);

  const currentSquadCaptainId = squadState.picks.find((p) => p.isCaptain)?.elementId;

  const getFdrColor = (diff: number) => {
    if (diff <= 2) return 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
    if (diff === 3) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (diff === 4) return 'bg-amber-950 text-amber-400 border-amber-800/60';
    return 'bg-rose-950 text-rose-400 border-rose-800/60';
  };

  return (
    <div className="space-y-6 py-6">
      {/* Title & Gameweek Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {t.captains.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{t.captains.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-300">{t.captains.selectGw}</span>
          <select
            value={targetGw}
            onChange={(e) => setTargetGw(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 font-bold"
          >
            {bootstrap.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} {ev.is_next ? `(${t.captains.nextBadge})` : ev.is_current ? `(${t.captains.liveBadge})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SECTION 1: MY SQUAD CAPTAIN RECOMMENDATION */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-800/50 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            {t.captains.mySquadArmband}
          </h2>
        </div>
        <p className="text-xs text-slate-400">{t.captains.mySquadArmbandDesc}</p>

        {squadCaptainPicks.length === 0 ? (
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400">
            {t.captains.noCaptainInSquad}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadCaptainPicks.map((c, idx) => {
              const isCurrentCaptain = currentSquadCaptainId === c.player.id;
              const rankLabel =
                idx === 0
                  ? t.captains.topPickRank
                  : t.captains.altRank.replace('{num}', (idx + 1).toString());

              return (
                <div
                  key={c.player.id}
                  className={`bg-slate-950 border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                    idx === 0
                      ? 'border-amber-500/80 ring-1 ring-amber-500/30'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        {rankLabel}
                      </span>
                      <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 font-mono font-bold text-xs">
                        Score: {c.score}/100
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <ClubJersey
                        club={c.club}
                        isGoalkeeper={c.player.element_type === 1}
                        size="md"
                      />
                      <div>
                        <h3 className="font-extrabold text-white text-base">
                          {c.player.web_name}
                        </h3>
                        <div className="text-xs text-slate-400">
                          {c.club.name} · £{(c.player.now_cost / 10).toFixed(1)}m
                        </div>
                      </div>
                    </div>

                    {c.nextMatch ? (
                      <div className="flex items-center justify-between p-2 bg-slate-900/80 rounded border border-slate-800 text-xs">
                        <span className="text-slate-300">
                          vs {c.nextMatch.opponent}{' '}
                          <span className="text-slate-500">({c.nextMatch.isHome ? 'H' : 'A'})</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono ${getFdrColor(
                            c.nextMatch.difficulty
                          )}`}
                        >
                          FDR {c.nextMatch.difficulty}
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-xs text-slate-500 italic">
                        {t.captains.blankFixture} (GW{targetGw})
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 font-mono">
                      Form: <strong className="text-emerald-400">{c.player.form}</strong> · Total Pts:{' '}
                      <strong className="text-white">{c.player.total_points}</strong>
                    </div>
                  </div>

                  {onSetCaptainInSquad && (
                    <button
                      onClick={() => onSetCaptainInSquad(c.player.id)}
                      disabled={isCurrentCaptain}
                      className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        isCurrentCaptain
                          ? 'bg-amber-400 text-black font-bold cursor-default'
                          : 'bg-slate-900 hover:bg-amber-950/60 text-amber-400 border border-amber-800/60'
                      }`}
                    >
                      {isCurrentCaptain ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.captains.activeCaptainInSquad}</span>
                        </>
                      ) : (
                        <>
                          <Crown className="w-3.5 h-3.5" />
                          <span>{t.captains.setAsCaptainBtn}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: LEAGUE-WIDE PRIMARY CAPTAINS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              {t.captains.allPicksTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t.captains.allPicksDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {primaryLeagueCaptains.map((c, idx) => (
            <div
              key={c.player.id}
              onClick={() => onSelectPlayer(c.player)}
              className="bg-slate-950 border border-slate-800 hover:border-emerald-600/60 rounded-xl p-4 cursor-pointer transition-all group flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Rank #{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono font-bold text-xs">
                    Score: {c.score}/100
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <ClubJersey
                    club={c.club}
                    isGoalkeeper={c.player.element_type === 1}
                    size="md"
                  />
                  <div>
                    <h3 className="font-extrabold text-white text-base group-hover:text-emerald-300 transition-colors">
                      {c.player.web_name}
                    </h3>
                    <div className="text-xs text-slate-400">
                      {c.club.name} · £{(c.player.now_cost / 10).toFixed(1)}m
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-slate-900 rounded border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-300">
                    {t.captains.opponentLabel}:{' '}
                    <strong>
                      {c.nextMatch
                        ? `${c.nextMatch.opponent} (${c.nextMatch.isHome ? 'H' : 'A'})`
                        : `${t.captains.blankFixture} (GW${targetGw})`}
                    </strong>
                  </span>
                  {c.nextMatch && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono ${getFdrColor(
                        c.nextMatch.difficulty
                      )}`}
                    >
                      FDR {c.nextMatch.difficulty}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono pt-2 border-t border-slate-800/80 text-slate-400">
                <div className="p-1 bg-slate-900/60 rounded">{t.captains.formLabel}: {c.player.form}</div>
                <div className="p-1 bg-slate-900/60 rounded">xGI: {c.player.expected_goal_involvements || '0.0'}</div>
                <div className="p-1 bg-slate-900/60 rounded">{t.captains.selectedByLabel}: {c.player.selected_by_percent}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: DIFFERENTIAL CAPTAINS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              {t.captains.differentialCaptains}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t.captains.differentialCaptainsDesc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {differentialCaptains.map((c) => (
            <div
              key={c.player.id}
              onClick={() => onSelectPlayer(c.player)}
              className="bg-slate-950 border border-slate-800 hover:border-cyan-600/60 rounded-xl p-4 cursor-pointer transition-all group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-400 font-bold">
                  {t.captains.ownedLabel}: {c.player.selected_by_percent}%
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {c.score} pts
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <ClubJersey
                  club={c.club}
                  isGoalkeeper={c.player.element_type === 1}
                  size="sm"
                />
                <div>
                  <h4 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors truncate">
                    {c.player.web_name}
                  </h4>
                  <div className="text-[11px] text-slate-400">
                    {c.club.short_name} · £{(c.player.now_cost / 10).toFixed(1)}m
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                {c.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calculation Transparency Notice */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-300">{t.captains.calcBreakdown}:</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400 text-[11px]">
            <span>{t.captains.formFactor}</span>
            <span>·</span>
            <span>{t.captains.fixtureFactor}</span>
            <span>·</span>
            <span>{t.captains.threatFactor}</span>
            <span>·</span>
            <span>{t.captains.minsFactor}</span>
          </div>
          <p className="leading-relaxed pt-1">{t.captains.transparencyNote}</p>
        </div>
      </div>
    </div>
  );
};
