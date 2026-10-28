import { FPLElement, FPLTeam, FPLFixture, TransferAlternative } from '../types/fpl';
import { Language } from './i18n';

export interface StrategyWeights {
  formWeight: number;
  fixtureWeight: number;
  xgWeight: number;
  valueWeight: number;
}

export function getStrategyWeights(strategy: 'balanced' | 'form' | 'fixtures' | 'xg' | 'value'): StrategyWeights {
  switch (strategy) {
    case 'form':
      return { formWeight: 0.50, fixtureWeight: 0.20, xgWeight: 0.15, valueWeight: 0.15 };
    case 'fixtures':
      return { formWeight: 0.20, fixtureWeight: 0.50, xgWeight: 0.15, valueWeight: 0.15 };
    case 'xg':
      return { formWeight: 0.20, fixtureWeight: 0.15, xgWeight: 0.50, valueWeight: 0.15 };
    case 'value':
      return { formWeight: 0.20, fixtureWeight: 0.15, xgWeight: 0.15, valueWeight: 0.50 };
    case 'balanced':
    default:
      return { formWeight: 0.35, fixtureWeight: 0.30, xgWeight: 0.20, valueWeight: 0.15 };
  }
}

/**
 * Returns the next N fixtures for a given team
 */
export function getUpcomingFixturesForTeam(
  teamId: number,
  fixtures: FPLFixture[],
  teams: FPLTeam[],
  count: number = 3
): { opponent: string; isHome: boolean; difficulty: number }[] {
  const upcoming = fixtures
    .filter((f) => !f.finished && (f.team_h === teamId || f.team_a === teamId))
    .slice(0, count);

  return upcoming.map((f) => {
    const isHome = f.team_h === teamId;
    const opponentId = isHome ? f.team_a : f.team_h;
    const opponentTeam = teams.find((t) => t.id === opponentId);
    const opponent = opponentTeam ? opponentTeam.short_name : `Team ${opponentId}`;
    const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;

    return {
      opponent,
      isHome,
      difficulty: difficulty || 3,
    };
  });
}

/**
 * Calculate average difficulty score (converted to ease, where 5 is hardest and 1 is easiest)
 */
function getFixtureEaseScore(upcoming: { difficulty: number; isHome: boolean }[]): number {
  if (upcoming.length === 0) return 50;
  const avgDiff = upcoming.reduce((acc, f) => acc + f.difficulty, 0) / upcoming.length;
  // FDR scale is 2 to 5. 2 is easiest (score 100), 5 is hardest (score 10).
  const ease = Math.max(0, Math.min(100, Math.round((5.5 - avgDiff) * 28)));
  return ease;
}

export function calculateTransferRecommendations(
  playerToSell: FPLElement,
  allPlayers: FPLElement[],
  allTeams: FPLTeam[],
  fixtures: FPLFixture[],
  maxBudgetTenths: number,
  currentSquadElementIds: number[],
  strategy: 'balanced' | 'form' | 'fixtures' | 'xg' | 'value',
  lang: Language
): TransferAlternative[] {
  const isId = lang === 'id';
  const weights = getStrategyWeights(strategy);

  // Count current players by team in squad (excluding the sold player)
  const squadTeamCounts: Record<number, number> = {};
  currentSquadElementIds.forEach((id) => {
    if (id !== playerToSell.id) {
      const p = allPlayers.find((el) => el.id === id);
      if (p) {
        squadTeamCounts[p.team] = (squadTeamCounts[p.team] || 0) + 1;
      }
    }
  });

  // Filter candidates:
  // 1. Same position
  // 2. Not the sold player
  // 3. Not already in squad
  // 4. Within budget
  // 5. Team count < 3
  // 6. Not flagged as injured (chance_of_playing_next_round === 0 or status === 'i')
  const candidates = allPlayers.filter((p) => {
    if (p.id === playerToSell.id) return false;
    if (p.element_type !== playerToSell.element_type) return false;
    if (currentSquadElementIds.includes(p.id)) return false;
    if (p.now_cost > maxBudgetTenths) return false;
    if ((squadTeamCounts[p.team] || 0) >= 3) return false;
    if (p.status === 'i' || p.chance_of_playing_next_round === 0) return false;
    return true;
  });

  const scoredCandidates: TransferAlternative[] = candidates.map((player) => {
    const club = allTeams.find((t) => t.id === player.team) || {
      id: player.team,
      name: 'Unknown',
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

    const upcomingFixtures = getUpcomingFixturesForTeam(player.team, fixtures, allTeams, 3);

    // Component 1: Form score (0 - 100)
    // Form usually ranges 0.0 - 9.0 in FPL
    const rawForm = parseFloat(player.form) || 0;
    const formScore = Math.min(100, Math.max(0, Math.round(rawForm * 11)));

    // Component 2: Fixture ease score (0 - 100)
    const fixtureScore = getFixtureEaseScore(upcomingFixtures);

    // Component 3: xG & xGI score (0 - 100)
    const rawXgi = parseFloat(player.expected_goal_involvements) || 0;
    const xgScore = Math.min(100, Math.max(0, Math.round(rawXgi * 16)));

    // Component 4: Value score (Points per cost)
    const costInM = player.now_cost / 10;
    const pointsPerCost = costInM > 0 ? player.total_points / costInM : 0;
    const valueScore = Math.min(100, Math.max(0, Math.round(pointsPerCost * 9)));

    // Weighted composite score
    const totalScore = Math.round(
      formScore * weights.formWeight +
      fixtureScore * weights.fixtureWeight +
      xgScore * weights.xgWeight +
      valueScore * weights.valueWeight
    );

    // Generate Pros
    const pros: string[] = [];
    if (rawForm >= 5.0) {
      pros.push(isId ? `Form impresif (${rawForm}) dalam beberapa laga terakhir` : `Strong form (${rawForm}) in recent matches`);
    } else if (rawForm >= 3.5) {
      pros.push(isId ? `Performa stabil konsisten (${rawForm})` : `Steady performance form (${rawForm})`);
    }

    if (fixtureScore >= 65) {
      const easyOpponents = upcomingFixtures
        .filter((f) => f.difficulty <= 2)
        .map((f) => `${f.opponent} (${f.isHome ? 'H' : 'A'})`)
        .join(', ');
      pros.push(
        isId
          ? `Jadwal ramah FDR rendah: ${easyOpponents || '3 laga menguntungkan'}`
          : `Favorable FDR fixtures: ${easyOpponents || '3 winnable matchups'}`
      );
    }

    if (rawXgi >= 3.0) {
      pros.push(
        isId
          ? `Keterlibatan peluang tinggi (xGI ${rawXgi})`
          : `High threat creation (xGI ${rawXgi})`
      );
    }

    if (costInM < playerToSell.now_cost / 10) {
      const savings = ((playerToSell.now_cost - player.now_cost) / 10).toFixed(1);
      pros.push(
        isId
          ? `Menghemat £${savings}m dana di bank`
          : `Saves £${savings}m to reinvest in bank`
      );
    }

    if (pros.length === 0) {
      pros.push(
        isId
          ? `Pilihan posisi seimbang dengan starter reguler`
          : `Balanced pick with regular starting role`
      );
    }

    // Generate Risks / Data limitations
    const risks: string[] = [];
    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round < 100) {
      risks.push(
        isId
          ? `Status kebugaran dipantau (${player.chance_of_playing_next_round}% peluang main)`
          : `Fitness concern (${player.chance_of_playing_next_round}% chance of playing)`
      );
    }

    const hardFixtures = upcomingFixtures.filter((f) => f.difficulty >= 4);
    if (hardFixtures.length > 0) {
      const hardOpponents = hardFixtures.map((f) => `${f.opponent} (${f.isHome ? 'H' : 'A'})`).join(', ');
      risks.push(
        isId
          ? `Menghadapi lawan berat: ${hardOpponents}`
          : `Tough matchup ahead: ${hardOpponents}`
      );
    }

    if (player.minutes < 300) {
      risks.push(
        isId
          ? `Menit bermain terbatas (${player.minutes} menit musim ini)`
          : `Limited pitch minutes (${player.minutes} mins this season)`
      );
    }

    if (risks.length === 0) {
      risks.push(
        isId
          ? `Rotasi taktik dapat mempengaruhi menit bermain`
          : `Tactical rotations may influence gametime`
      );
    }

    // Rationale
    let rationale = '';
    if (strategy === 'form') {
      rationale = isId
        ? `Direkomendasikan karena momentum form (${rawForm}) berada di kuartil atas posisi ${player.element_type === 1 ? 'Kiper' : player.element_type === 2 ? 'Bek' : player.element_type === 3 ? 'Gelandang' : 'Penyerang'}.`
        : `Recommended due to peak form momentum (${rawForm}) ranking among the top tier for this position.`;
    } else if (strategy === 'fixtures') {
      rationale = isId
        ? `Memanfaatkan jadwal liga 3 pekan ke depan yang relatif mudah untuk mendulang poin maksimal.`
        : `Capitalizes on a friendly 3-match fixture run with low average difficulty.`;
    } else if (strategy === 'xg') {
      rationale = isId
        ? `Didukung kualitas peluang terukur (xGI ${rawXgi}) yang menandakan peluang gol/assist konsisten.`
        : `Backed by solid underlying metrics (xGI ${rawXgi}), indicating consistent chance involvement.`;
    } else if (strategy === 'value') {
      rationale = isId
        ? `Pilihan hemat anggaran yang efisien untuk membebaskan modal bagi pemain bintang lainnya.`
        : `Cost-effective budget enabler allowing extra cash to upgrade other squad positions.`;
    } else {
      rationale = isId
        ? `Kombinasi harmonis antara form stabil (${rawForm}), jadwal memadai, dan harga terjangkau (£${costInM}m).`
        : `Balanced blend of steady form (${rawForm}), playable fixtures, and affordable price (£${costInM}m).`;
    }

    return {
      player,
      club,
      score: totalScore,
      scoreBreakdown: {
        formScore,
        fixtureScore,
        xgScore,
        valueScore,
      },
      upcomingFixtures,
      pros,
      risks,
      rationale,
    };
  });

  // Sort candidates by totalScore desc
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Return top 3 alternatives
  return scoredCandidates.slice(0, 3);
}

export function getCaptainCandidates(
  allPlayers: FPLElement[],
  allTeams: FPLTeam[],
  fixtures: FPLFixture[],
  lang: Language = 'id'
): { player: FPLElement; club: FPLTeam; score: number; reason: string }[] {
  const isId = lang === 'id';
  // Candidate pool: MID and FWD with high form and high ownership/points
  const pool = allPlayers.filter(
    (p) =>
      (p.element_type === 3 || p.element_type === 4) &&
      p.status === 'a' &&
      p.total_points >= 25 &&
      parseFloat(p.form) >= 3.0
  );

  const scored = pool.map((player) => {
    const club = allTeams.find((t) => t.id === player.team) || { id: player.team, name: '', short_name: '', code: 0, strength: 3, strength_overall_home: 1000, strength_overall_away: 1000, strength_attack_home: 1000, strength_attack_away: 1000, strength_defence_home: 1000, strength_defence_away: 1000 };
    const upcoming = getUpcomingFixturesForTeam(player.team, fixtures, allTeams, 1);
    const nextMatch = upcoming[0];
    const form = parseFloat(player.form) || 0;
    const xgi = parseFloat(player.expected_goal_involvements) || 0;
    const diff = nextMatch ? nextMatch.difficulty : 3;
    const homeBonus = nextMatch?.isHome ? 15 : 0;

    // Captain score
    const score = Math.round(form * 10 + xgi * 8 + (5 - diff) * 12 + homeBonus);
    const opp = nextMatch ? `${nextMatch.opponent} (${nextMatch.isHome ? 'H' : 'A'})` : (isId ? 'Laga Berikutnya' : 'Next Match');

    return {
      player,
      club,
      score,
      reason: `Form ${form} · xGI ${xgi} · vs ${opp}`,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

export function getDifferentialPicks(
  allPlayers: FPLElement[],
  allTeams: FPLTeam[],
  fixtures: FPLFixture[],
  lang: Language = 'id'
): { player: FPLElement; club: FPLTeam; score: number; reason: string }[] {
  const isId = lang === 'id';
  // Differentials: ownership < 10%, minutes >= 300, form >= 3.0
  const pool = allPlayers.filter((p) => {
    const ownership = parseFloat(p.selected_by_percent) || 0;
    const form = parseFloat(p.form) || 0;
    return ownership < 10.0 && p.minutes >= 300 && form >= 3.0 && p.status === 'a';
  });

  const scored = pool.map((player) => {
    const club = allTeams.find((t) => t.id === player.team) || { id: player.team, name: '', short_name: '', code: 0, strength: 3, strength_overall_home: 1000, strength_overall_away: 1000, strength_attack_home: 1000, strength_attack_away: 1000, strength_defence_home: 1000, strength_defence_away: 1000 };
    const upcoming = getUpcomingFixturesForTeam(player.team, fixtures, allTeams, 2);
    const ease = getFixtureEaseScore(upcoming);
    const form = parseFloat(player.form) || 0;
    const score = Math.round(form * 12 + ease * 0.4);

    return {
      player,
      club,
      score,
      reason: isId
        ? `Kepemilikan: ${player.selected_by_percent}% · Form: ${player.form} · Kemudahan: ${ease}%`
        : `Owned: ${player.selected_by_percent}% · Form: ${player.form} · Ease: ${ease}%`,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4);
}

export interface LineupOptimizationResult {
  startingElementIds: number[];
  benchElementIds: number[];
  captainId: number;
  viceCaptainId: number;
  formation: string;
  defCount: number;
  midCount: number;
  fwdCount: number;
}

/**
 * Optimizes the best Starting XI from user's current 15 squad players
 */
export function optimizeBestStartingXi(
  squadPlayers: FPLElement[],
  fixtures: FPLFixture[],
  allTeams: FPLTeam[]
): LineupOptimizationResult | null {
  const gkps = squadPlayers.filter((p) => p.element_type === 1);
  const defs = squadPlayers.filter((p) => p.element_type === 2);
  const mids = squadPlayers.filter((p) => p.element_type === 3);
  const fwds = squadPlayers.filter((p) => p.element_type === 4);

  if (gkps.length < 1 || defs.length < 3 || mids.length < 2 || fwds.length < 1) {
    return null; // Not enough players to form a valid XI
  }

  // Player scoring function
  function scorePlayer(p: FPLElement): number {
    const rawForm = parseFloat(p.form) || 0;
    const xgi = parseFloat(p.expected_goal_involvements) || 0;
    const upcoming = getUpcomingFixturesForTeam(p.team, fixtures, allTeams, 1);
    const ease = getFixtureEaseScore(upcoming);
    const rawPpg = parseFloat(p.points_per_game) || 0;
    const isAvail = p.status === 'a' ? 1.0 : (p.chance_of_playing_next_round ?? 50) / 100;
    return (rawForm * 10 + xgi * 8 + rawPpg * 4 + ease * 0.3) * isAvail;
  }

  // Sort players by score
  const sortedGkp = [...gkps].sort((a, b) => scorePlayer(b) - scorePlayer(a));
  const sortedDef = [...defs].sort((a, b) => scorePlayer(b) - scorePlayer(a));
  const sortedMid = [...mids].sort((a, b) => scorePlayer(b) - scorePlayer(a));
  const sortedFwd = [...fwds].sort((a, b) => scorePlayer(b) - scorePlayer(a));

  const validFormations = [
    [3, 5, 2],
    [3, 4, 3],
    [4, 4, 2],
    [4, 3, 3],
    [4, 5, 1],
    [5, 3, 2],
    [5, 4, 1],
    [5, 2, 3],
  ];

  let bestScore = -1;
  let bestFormation = [4, 4, 2];
  let bestStarters: FPLElement[] = [];
  let bestBench: FPLElement[] = [];

  const starterGkp = sortedGkp[0];
  const benchGkp = sortedGkp.slice(1);

  for (const [nD, nM, nF] of validFormations) {
    if (defs.length >= nD && mids.length >= nM && fwds.length >= nF) {
      const chosenDefs = sortedDef.slice(0, nD);
      const chosenMids = sortedMid.slice(0, nM);
      const chosenFwds = sortedFwd.slice(0, nF);

      const starters = [starterGkp, ...chosenDefs, ...chosenMids, ...chosenFwds];
      const outfieldStarters = [...chosenDefs, ...chosenMids, ...chosenFwds];

      const totalScore = starters.reduce((acc, p) => acc + scorePlayer(p), 0);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestFormation = [nD, nM, nF];
        bestStarters = starters;

        // Remaining outfielders go to bench
        const remDefs = sortedDef.slice(nD);
        const remMids = sortedMid.slice(nM);
        const remFwds = sortedFwd.slice(nF);
        const remOutfield = [...remDefs, ...remMids, ...remFwds].sort(
          (a, b) => scorePlayer(b) - scorePlayer(a)
        );

        bestBench = [...benchGkp, ...remOutfield];
      }
    }
  }

  if (bestStarters.length === 0) return null;

  // Captain is the highest scorer among starters, VC is second highest
  const sortedStartersByScore = [...bestStarters].sort(
    (a, b) => scorePlayer(b) - scorePlayer(a)
  );

  const captain = sortedStartersByScore[0];
  const viceCaptain = sortedStartersByScore[1] || sortedStartersByScore[0];

  return {
    startingElementIds: bestStarters.map((p) => p.id),
    benchElementIds: bestBench.map((p) => p.id),
    captainId: captain.id,
    viceCaptainId: viceCaptain.id,
    formation: `${bestFormation[0]}-${bestFormation[1]}-${bestFormation[2]}`,
    defCount: bestFormation[0],
    midCount: bestFormation[1],
    fwdCount: bestFormation[2],
  };
}

/**
 * Ensures that on the bench (positions > 11), any Goalkeeper (element_type === 1)
 * is ALWAYS locked in the first bench position (position 12, Sub Kiper / Sub GKP),
 * and outfield bench players follow in slots 2, 3, 4 (positions 13, 14, 15).
 */
export function enforceBenchGkpFirst<T extends { elementId: number; position: number }>(
  picks: T[],
  playersMap: Map<number, FPLElement>
): T[] {
  const starters = picks.filter((p) => p.position <= 11).sort((a, b) => a.position - b.position);
  const bench = picks.filter((p) => p.position > 11).sort((a, b) => a.position - b.position);

  const benchGkps = bench.filter((p) => playersMap.get(p.elementId)?.element_type === 1);
  const benchOutfielders = bench.filter((p) => playersMap.get(p.elementId)?.element_type !== 1);

  const orderedBench = [...benchGkps, ...benchOutfielders].map((pick, idx) => ({
    ...pick,
    position: 12 + idx,
  }));

  return [...starters, ...orderedBench];
}

/**
 * Generates an optimal 15-player squad within a specified budget
 */
export function generateOptimalBudgetSquad(
  allPlayers: FPLElement[],
  allTeams: FPLTeam[],
  fixtures: FPLFixture[],
  maxBudgetM: number = 100.0
): FPLElement[] {
  const maxBudgetTenths = Math.round(maxBudgetM * 10);

  // Available players only
  const pool = allPlayers.filter(
    (p) => p.status === 'a' && (p.chance_of_playing_next_round ?? 100) >= 75
  );

  function evalPlayer(p: FPLElement) {
    const rawForm = parseFloat(p.form) || 0;
    const xgi = parseFloat(p.expected_goal_involvements) || 0;
    const points = p.total_points || 0;
    const upcoming = getUpcomingFixturesForTeam(p.team, fixtures, allTeams, 2);
    const ease = getFixtureEaseScore(upcoming);
    // Value ratio
    const value = (p.total_points / (p.now_cost / 10)) || 0;
    return rawForm * 12 + points * 0.4 + xgi * 8 + ease * 0.2 + value * 2;
  }

  const gkps = pool.filter((p) => p.element_type === 1).sort((a, b) => evalPlayer(b) - evalPlayer(a));
  const defs = pool.filter((p) => p.element_type === 2).sort((a, b) => evalPlayer(b) - evalPlayer(a));
  const mids = pool.filter((p) => p.element_type === 3).sort((a, b) => evalPlayer(b) - evalPlayer(a));
  const fwds = pool.filter((p) => p.element_type === 4).sort((a, b) => evalPlayer(b) - evalPlayer(a));

  const clubCounts: Record<number, number> = {};
  const selected: FPLElement[] = [];

  function canAdd(p: FPLElement, currentCost: number, neededPlayers: number) {
    if ((clubCounts[p.team] || 0) >= 3) return false;
    const remainingBudget = maxBudgetTenths - (currentCost + p.now_cost);
    const minNeededCost = (neededPlayers - 1) * 40; // £4.0m minimum per remaining player
    return remainingBudget >= minNeededCost;
  }

  function pickPosition(
    candidates: FPLElement[],
    count: number,
    totalRemainingAfterPos: number
  ) {
    let picked = 0;
    for (const c of candidates) {
      if (picked >= count) break;
      const currentCost = selected.reduce((acc, p) => acc + p.now_cost, 0);
      const remainingNeeded = count - picked + totalRemainingAfterPos;
      if (canAdd(c, currentCost, remainingNeeded)) {
        selected.push(c);
        clubCounts[c.team] = (clubCounts[c.team] || 0) + 1;
        picked++;
      }
    }
  }

  // Pick 2 GKP (needs 13 players after)
  pickPosition(gkps, 2, 13);
  // Pick 5 DEF (needs 8 players after)
  pickPosition(defs, 5, 8);
  // Pick 5 MID (needs 3 players after)
  pickPosition(mids, 5, 3);
  // Pick 3 FWD (needs 0 players after)
  pickPosition(fwds, 3, 0);

  return selected;
}

