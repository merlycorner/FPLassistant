import React, { useState, useMemo, useEffect } from 'react';
import { FPLElement, FPLTeam, FPLBootstrap, UserSquadState } from '../types/fpl';
import { Language, translations } from '../lib/i18n';
import { fetchEntryProfile, fetchEntryPicks } from '../lib/fplApi';
import {
  optimizeBestStartingXi,
  generateOptimalBudgetSquad,
  enforceBenchGkpFirst,
} from '../lib/scoring';
import { ClubJersey } from './ClubJersey';
import {
  Shield,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Search,
  Plus,
  Sparkles,
  ArrowRightLeft,
  LayoutGrid,
  List,
  Sliders,
  X,
  Trophy,
  Award,
  AlertTriangle,
} from 'lucide-react';

export function getPlayerHealthStatus(player: FPLElement) {
  const isSuspended = player.status === 's';
  const isRuledOut = player.status === 'i' || player.chance_of_playing_next_round === 0;
  const isDoubtful =
    player.status === 'd' ||
    (player.chance_of_playing_next_round !== null &&
      player.chance_of_playing_next_round > 0 &&
      player.chance_of_playing_next_round < 100);
  const isUnavailable = player.status === 'u' || player.status === 'n';

  const hasHealthIssue =
    isSuspended ||
    isRuledOut ||
    isDoubtful ||
    isUnavailable ||
    (player.status !== 'a' && player.status !== '');

  let badgeColor = 'bg-rose-600 text-white border-rose-400';
  let badgeLabel = '0%';
  let ringColor = 'ring-2 ring-rose-500/80';
  let textClass = 'text-rose-400';

  if (isSuspended) {
    badgeColor = 'bg-rose-700 text-white border-rose-500';
    badgeLabel = 'SUSP';
    ringColor = 'ring-2 ring-rose-600/80';
    textClass = 'text-rose-400';
  } else if (isRuledOut) {
    badgeColor = 'bg-rose-600 text-white border-rose-400';
    badgeLabel =
      player.chance_of_playing_next_round !== null
        ? `${player.chance_of_playing_next_round}%`
        : '0%';
    ringColor = 'ring-2 ring-rose-500/80';
    textClass = 'text-rose-400';
  } else if (isDoubtful) {
    badgeColor = 'bg-amber-500 text-black border-amber-300 font-extrabold';
    badgeLabel =
      player.chance_of_playing_next_round !== null
        ? `${player.chance_of_playing_next_round}%`
        : '75%';
    ringColor = 'ring-2 ring-amber-500/80';
    textClass = 'text-amber-400';
  } else if (isUnavailable) {
    badgeColor = 'bg-orange-600 text-white border-orange-400';
    badgeLabel = 'UNAV';
    ringColor = 'ring-2 ring-orange-500/80';
    textClass = 'text-orange-400';
  }

  return {
    hasHealthIssue,
    isSuspended,
    isRuledOut,
    isDoubtful,
    badgeColor,
    badgeLabel,
    ringColor,
    textClass,
    news: player.news || '',
  };
}

interface MySquadViewProps {
  bootstrap: FPLBootstrap;
  squadState: UserSquadState;
  onUpdateSquad: (newState: UserSquadState) => void;
  lang: Language;
  onNavigateToTransfersWithPlayer?: (player: FPLElement) => void;
}

export const MySquadView: React.FC<MySquadViewProps> = ({
  bootstrap,
  squadState,
  onUpdateSquad,
  lang,
  onNavigateToTransfersWithPlayer,
}) => {
  const t = translations[lang];

  // Active top tab: 'manual' or 'teamId'
  const [activeTab, setActiveTab] = useState<'manual' | 'teamId'>('manual');
  // View mode: 'pitch' or 'list'
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');

  // Team ID states
  const [teamIdInput, setTeamIdInput] = useState('');
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Manual player search within squad page
  const [manualSearch, setManualSearch] = useState('');
  const [manualPosFilter, setManualPosFilter] = useState<number>(1);

  // Swap player state for interactive formation simulation
  const [swapSourceId, setSwapSourceId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Budget Generator Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetSlider, setBudgetSlider] = useState<number>(100.0);

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

  // Current squad players
  const squadElements: FPLElement[] = useMemo(() => {
    return squadState.picks
      .map((p) => playersMap.get(p.elementId))
      .filter((p): p is FPLElement => Boolean(p));
  }, [squadState.picks, playersMap]);

  // Injured or doubtful players in squad
  const injuredSquadPlayers = useMemo(() => {
    return squadElements.filter((p) => {
      const health = getPlayerHealthStatus(p);
      return health.hasHealthIssue;
    });
  }, [squadElements]);

  // Total squad cost
  const totalCostTenths = squadElements.reduce((acc, p) => acc + p.now_cost, 0);
  const totalCostM = (totalCostTenths / 10).toFixed(1);
  const remainingBudgetM = (100.0 - totalCostTenths / 10).toFixed(1);

  // Starting XI vs Bench
  // Positions 1-11 are Starters; positions 12-15 are Bench
  // The substitute goalkeeper (element_type === 1) is ALWAYS locked in the first bench position (slot 1)
  const starterPicks = useMemo(() => {
    return squadState.picks
      .filter((p) => p.position <= 11)
      .sort((a, b) => a.position - b.position);
  }, [squadState.picks]);

  const benchPicks = useMemo(() => {
    const rawBench = squadState.picks.filter((p) => p.position > 11);
    return [...rawBench].sort((a, b) => {
      const pA = playersMap.get(a.elementId);
      const pB = playersMap.get(b.elementId);
      const isGkpA = pA?.element_type === 1;
      const isGkpB = pB?.element_type === 1;
      if (isGkpA && !isGkpB) return -1;
      if (!isGkpA && isGkpB) return 1;
      return a.position - b.position;
    });
  }, [squadState.picks, playersMap]);

  const starterElements = useMemo(() => {
    return starterPicks
      .map((p) => playersMap.get(p.elementId))
      .filter((p): p is FPLElement => Boolean(p));
  }, [starterPicks, playersMap]);

  const benchElements = useMemo(() => {
    return benchPicks
      .map((p) => playersMap.get(p.elementId))
      .filter((p): p is FPLElement => Boolean(p));
  }, [benchPicks, playersMap]);

  // Ensure any existing loaded squad maintains bench goalkeeper in the first position
  useEffect(() => {
    if (squadState.picks.length === 0 || playersMap.size === 0) return;
    const normalized = enforceBenchGkpFirst(squadState.picks, playersMap);
    const hasPositionMismatch = normalized.some(
      (p, i) =>
        p.elementId !== squadState.picks[i]?.elementId ||
        p.position !== squadState.picks[i]?.position
    );
    if (hasPositionMismatch) {
      onUpdateSquad({
        ...squadState,
        picks: normalized,
      });
    }
  }, [squadState.picks, playersMap]);

  // Determine current active formation from starters
  const starterGkps = starterElements.filter((p) => p.element_type === 1);
  const starterDefs = starterElements.filter((p) => p.element_type === 2);
  const starterMids = starterElements.filter((p) => p.element_type === 3);
  const starterFwds = starterElements.filter((p) => p.element_type === 4);

  const currentFormation = `${starterDefs.length}-${starterMids.length}-${starterFwds.length}`;

  // Squad composition lists
  const gkpList = squadElements.filter((p) => p.element_type === 1);
  const defList = squadElements.filter((p) => p.element_type === 2);
  const midList = squadElements.filter((p) => p.element_type === 3);
  const fwdList = squadElements.filter((p) => p.element_type === 4);

  // Club limits
  const clubCounts: Record<number, number> = {};
  squadElements.forEach((p) => {
    clubCounts[p.team] = (clubCounts[p.team] || 0) + 1;
  });
  const exceededClubs = Object.entries(clubCounts)
    .filter(([_, count]) => count > 3)
    .map(([teamId]) => teamsMap.get(Number(teamId))?.name || `Club ${teamId}`);

  // Handle Team ID submission
  async function handleLoadTeamId(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(teamIdInput.trim(), 10);
    if (isNaN(id) || id <= 0) {
      setTeamError(
        lang === 'id' ? 'ID Tim harus berupa angka positif.' : 'Team ID must be a positive number.'
      );
      return;
    }

    setIsLoadingTeam(true);
    setTeamError(null);

    try {
      const entry = await fetchEntryProfile(id);
      const currentOrPrevEvent =
        bootstrap.events.find((ev) => ev.is_current)?.id ||
        bootstrap.events.find((ev) => ev.is_previous)?.id ||
        entry.current_event ||
        1;

      const picksData = await fetchEntryPicks(id, currentOrPrevEvent);

      if (!picksData.picks || picksData.picks.length === 0) {
        throw new Error(
          lang === 'id'
            ? 'Pilihan pemain untuk Gameweek ini belum dirilis atau tidak dapat diakses.'
            : 'Picks for this Gameweek are not yet available or are locked.'
        );
      }

      const rawPicks = picksData.picks.map((pick) => ({
        elementId: pick.element,
        position: pick.position,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
      }));

      const newPicks = enforceBenchGkpFirst(rawPicks, playersMap);

      onUpdateSquad({
        teamId: entry.id,
        teamName: entry.name,
        managerName: `${entry.player_first_name} ${entry.player_last_name}`,
        overallPoints: entry.summary_overall_points,
        overallRank: entry.summary_overall_rank,
        picks: newPicks,
        bank: (picksData.entry_history?.bank || 0) / 10,
        source: 'fpl_id',
        lastUpdated: new Date().toISOString(),
      });

      setActiveTab('manual');
      setFeedbackMessage(
        lang === 'id'
          ? `Sukses memuat tim "${entry.name}" (${entry.player_first_name} ${entry.player_last_name})!`
          : `Successfully loaded team "${entry.name}"!`
      );
    } catch (err: any) {
      console.error('Failed to load team by ID:', err);
      setTeamError(err.message || t.squad.teamIdNotFound);
    } finally {
      setIsLoadingTeam(false);
    }
  }

  // Interactive Swap Handler (with auto formation recalculation)
  function handleInitiateOrExecuteSwap(targetPlayerId: number) {
    if (swapSourceId === null) {
      // First click: select as swap source
      setSwapSourceId(targetPlayerId);
      setFeedbackMessage(t.squad.swapMode);
      return;
    }

    if (swapSourceId === targetPlayerId) {
      // Clicked same player: cancel
      setSwapSourceId(null);
      setFeedbackMessage(null);
      return;
    }

    // Execute swap between swapSourceId and targetPlayerId
    const sourcePick = squadState.picks.find((p) => p.elementId === swapSourceId);
    const targetPick = squadState.picks.find((p) => p.elementId === targetPlayerId);

    if (!sourcePick || !targetPick) {
      setSwapSourceId(null);
      return;
    }

    const sourcePlayer = playersMap.get(sourcePick.elementId);
    const targetPlayer = playersMap.get(targetPick.elementId);

    if (!sourcePlayer || !targetPlayer) {
      setSwapSourceId(null);
      return;
    }

    // Test new lineup validity if one is starter and one is bench
    const isSourceStarter = sourcePick.position <= 11;
    const isTargetStarter = targetPick.position <= 11;

    // RULE 1: If both are on the bench, substitute goalkeeper cannot be swapped with outfield bench
    // (the substitute goalkeeper must always remain in the first bench position, Sub Kiper)
    if (!isSourceStarter && !isTargetStarter) {
      if (sourcePlayer.element_type === 1 || targetPlayer.element_type === 1) {
        setFeedbackMessage(t.squad.gkMustStayFirst);
        setSwapSourceId(null);
        return;
      }
    }

    // RULE 2: If both are starters, prevent swapping starting GKP with an outfield starter
    if (isSourceStarter && isTargetStarter) {
      if (
        (sourcePlayer.element_type === 1 && targetPlayer.element_type !== 1) ||
        (sourcePlayer.element_type !== 1 && targetPlayer.element_type === 1)
      ) {
        setFeedbackMessage(t.squad.invalidFormationMsg);
        setSwapSourceId(null);
        return;
      }
    }

    if (isSourceStarter !== isTargetStarter) {
      // Swapping across the starting line / bench threshold!
      // Check if resulting formation remains legal (min 3 DEF, min 2 MID, min 1 FWD, exactly 1 GKP)
      const simulatedStarters = starterElements.map((p) =>
        p.id === sourcePick.elementId
          ? targetPlayer
          : p.id === targetPick.elementId
          ? sourcePlayer
          : p
      );

      const simGkps = simulatedStarters.filter((p) => p.element_type === 1).length;
      const simDefs = simulatedStarters.filter((p) => p.element_type === 2).length;
      const simMids = simulatedStarters.filter((p) => p.element_type === 3).length;
      const simFwds = simulatedStarters.filter((p) => p.element_type === 4).length;

      if (simGkps !== 1 || simDefs < 3 || simMids < 2 || simFwds < 1) {
        setFeedbackMessage(t.squad.invalidFormationMsg);
        setSwapSourceId(null);
        return;
      }

      // Legal! Formations shifts automatically
      const newFormasi = `${simDefs}-${simMids}-${simFwds}`;
      setFeedbackMessage(t.squad.formationShifted.replace('{formasi}', newFormasi));
    } else {
      setFeedbackMessage(null);
    }

    // Perform swap by swapping positions in the picks array
    let updatedPicks = squadState.picks.map((pick) => {
      if (pick.elementId === sourcePick.elementId) {
        return { ...pick, position: targetPick.position };
      }
      if (pick.elementId === targetPick.elementId) {
        return { ...pick, position: sourcePick.position };
      }
      return pick;
    });

    // Enforce that the bench goalkeeper ALWAYS remains at position 12 (first position on the bench)
    updatedPicks = enforceBenchGkpFirst(updatedPicks, playersMap);

    onUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });

    setSwapSourceId(null);
  }

  // Set Captain
  function handleSetCaptain(elementId: number) {
    const updatedPicks = squadState.picks.map((p) => ({
      ...p,
      isCaptain: p.elementId === elementId,
      isViceCaptain: p.isCaptain && p.elementId !== elementId ? true : p.isViceCaptain,
    }));
    onUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Set Vice Captain
  function handleSetViceCaptain(elementId: number) {
    const updatedPicks = squadState.picks.map((p) => ({
      ...p,
      isViceCaptain: p.elementId === elementId,
    }));
    onUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Auto Best Starting XI calculation
  function handleAutoBestXi() {
    if (squadElements.length < 11) {
      setFeedbackMessage(
        lang === 'id'
          ? 'Tambahkan minimal 11 pemain terlebih dahulu untuk menyusun Best XI.'
          : 'Please add at least 11 players before optimizing Best XI.'
      );
      return;
    }

    const optimization = optimizeBestStartingXi(squadElements, bootstrap.events as any, bootstrap.teams);
    if (!optimization) {
      setFeedbackMessage(t.squad.invalidFormationMsg);
      return;
    }

    // Re-index picks: starters get positions 1..11, bench gets 12..15
    const newPicks: any[] = [];
    optimization.startingElementIds.forEach((id, idx) => {
      newPicks.push({
        elementId: id,
        position: idx + 1,
        isCaptain: id === optimization.captainId,
        isViceCaptain: id === optimization.viceCaptainId,
      });
    });

    optimization.benchElementIds.forEach((id, idx) => {
      newPicks.push({
        elementId: id,
        position: 12 + idx,
        isCaptain: false,
        isViceCaptain: false,
      });
    });

    const normalizedPicks = enforceBenchGkpFirst(newPicks, playersMap);

    onUpdateSquad({
      ...squadState,
      picks: normalizedPicks,
      lastUpdated: new Date().toISOString(),
    });

    setFeedbackMessage(
      lang === 'id'
        ? `Best Starting XI berhasil disusun dengan formasi ${optimization.formation}!`
        : `Best Starting XI optimized with ${optimization.formation} formation!`
    );
  }

  // Generate Best Budget Squad handler
  function handleApplyBudgetSquad() {
    const optimalPlayers = generateOptimalBudgetSquad(
      bootstrap.elements,
      bootstrap.teams,
      bootstrap.events as any,
      budgetSlider
    );

    if (optimalPlayers.length !== 15) {
      setFeedbackMessage(
        lang === 'id'
          ? 'Gagal menyusun skuad 15 pemain lengkap dalam budget.'
          : 'Failed to assemble complete 15-player squad within budget.'
      );
      return;
    }

    // Run best starting XI on these 15 players
    const optimization = optimizeBestStartingXi(optimalPlayers, bootstrap.events as any, bootstrap.teams);

    const newPicks: any[] = [];
    if (optimization) {
      optimization.startingElementIds.forEach((id, idx) => {
        newPicks.push({
          elementId: id,
          position: idx + 1,
          isCaptain: id === optimization.captainId,
          isViceCaptain: id === optimization.viceCaptainId,
        });
      });
      optimization.benchElementIds.forEach((id, idx) => {
        newPicks.push({
          elementId: id,
          position: 12 + idx,
          isCaptain: false,
          isViceCaptain: false,
        });
      });
    } else {
      optimalPlayers.forEach((p, idx) => {
        newPicks.push({
          elementId: p.id,
          position: idx + 1,
          isCaptain: idx === 0,
          isViceCaptain: idx === 1,
        });
      });
    }

    const totalCostTenthsNew = optimalPlayers.reduce((acc, p) => acc + p.now_cost, 0);
    const normalizedBudgetPicks = enforceBenchGkpFirst(newPicks, playersMap);

    onUpdateSquad({
      picks: normalizedBudgetPicks,
      bank: Math.max(0, budgetSlider - totalCostTenthsNew / 10),
      source: 'manual',
      teamName: `Optimal £${budgetSlider.toFixed(1)}m Squad`,
      lastUpdated: new Date().toISOString(),
    });

    setShowBudgetModal(false);
    setFeedbackMessage(
      lang === 'id'
        ? `Skuad optimal 15 pemain dengan budget £${budgetSlider.toFixed(1)}m berhasil diterapkan!`
        : `Optimal 15-player squad within £${budgetSlider.toFixed(1)}m applied!`
    );
  }

  // Remove player from squad
  function handleRemovePlayer(elementId: number) {
    const remainingPicks = squadState.picks.filter((p) => p.elementId !== elementId);
    const normalizedRemaining = enforceBenchGkpFirst(remainingPicks, playersMap);
    onUpdateSquad({
      ...squadState,
      picks: normalizedRemaining,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Add player to squad
  function handleAddPlayer(player: FPLElement) {
    if (squadState.picks.some((p) => p.elementId === player.id)) return;
    if (squadState.picks.length >= 15) return;

    const newPick = {
      elementId: player.id,
      position: squadState.picks.length + 1,
    };

    const rawPicks = [...squadState.picks, newPick];
    const updatedPicks = enforceBenchGkpFirst(rawPicks, playersMap);

    onUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Clear squad
  function handleClearSquad() {
    onUpdateSquad({
      picks: [],
      bank: 0,
      source: 'manual',
      lastUpdated: new Date().toISOString(),
    });
    setSwapSourceId(null);
    setFeedbackMessage(null);
  }

  // Candidates for manual addition
  const manualCandidates = manualSearch.trim()
    ? bootstrap.elements
        .filter(
          (p) =>
            p.element_type === manualPosFilter &&
            !squadState.picks.some((pick) => pick.elementId === p.id) &&
            `${p.first_name} ${p.second_name} ${p.web_name}`
              .toLowerCase()
              .includes(manualSearch.toLowerCase())
        )
        .slice(0, 6)
    : [];

  return (
    <div className="space-y-6 py-6">
      {/* Title & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.squad.title}</h1>
          <p className="text-xs text-slate-400 mt-1">{t.squad.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto Best XI Button */}
          <button
            onClick={handleAutoBestXi}
            disabled={squadElements.length < 11}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.squad.autoBestXi}</span>
          </button>

          {/* Generate Best Budget Squad Button */}
          <button
            onClick={() => setShowBudgetModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 rounded-lg transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.squad.generateBudgetSquad}</span>
          </button>

          {/* View Mode Toggle: Pitch vs List */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setViewMode('pitch')}
              title={t.squad.pitchView}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'pitch'
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title={t.squad.listView}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {squadElements.length > 0 && (
            <button
              onClick={handleClearSquad}
              className="p-2 text-rose-400 hover:text-rose-300 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              title={t.squad.clearSquad}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Manual vs Team ID */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.squad.tabManual}
        </button>
        <button
          onClick={() => setActiveTab('teamId')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'teamId'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.squad.tabTeamId}
        </button>
      </div>

      {/* Feedback & Swap Notification Banner */}
      {feedbackMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          {swapSourceId !== null && (
            <button
              onClick={() => {
                setSwapSourceId(null);
                setFeedbackMessage(null);
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              {t.squad.cancelSwap}
            </button>
          )}
        </div>
      )}

      {/* Tab: FPL Team ID Import */}
      {activeTab === 'teamId' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl space-y-4 shadow-lg">
          <div>
            <h3 className="text-sm font-bold text-white">{t.squad.teamIdLabel}</h3>
            <p className="text-xs text-slate-400 mt-1">{t.squad.teamIdHelper}</p>
          </div>

          <form onSubmit={handleLoadTeamId} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={teamIdInput}
              onChange={(e) => setTeamIdInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t.squad.teamIdPlaceholder}
              disabled={isLoadingTeam}
              className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={isLoadingTeam || !teamIdInput.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isLoadingTeam ? t.squad.fetchingTeam : t.squad.loadTeamBtn}</span>
            </button>
          </form>

          {teamError && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <div>{teamError}</div>
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className="text-emerald-400 hover:underline cursor-pointer block font-semibold"
                >
                  {t.squad.switchToManualPrompt}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Squad Summary Cards with Overall Rank & Overall Points */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Active Formation */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
            {t.squad.formation}
          </span>
          <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {starterElements.length === 11 ? currentFormation : '—'}
          </span>
          <span className="text-[10px] text-slate-500 block">
            {starterDefs.length} DEF · {starterMids.length} MID · {starterFwds.length} FWD
          </span>
        </div>

        {/* Card 2: Manager Overall Points */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              {squadState.overallPoints !== undefined
                ? t.squad.managerOverallPoints
                : t.squad.squadAccumulatedPoints}
            </span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
            {squadState.overallPoints !== undefined
              ? `${squadState.overallPoints} pts`
              : `${squadElements.reduce((acc, p) => acc + p.total_points, 0)} pts`}
          </span>
          <span className="text-[10px] text-slate-500 block truncate">
            {squadState.overallPoints !== undefined
              ? t.squad.managerOverallPointsDesc
              : t.squad.squadAccumulatedPointsDesc}
          </span>
        </div>

        {/* Card 3: Overall Rank of the Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              {t.squad.overallRankTitle}
            </span>
            <Trophy className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
            {squadState.overallRank
              ? `#${squadState.overallRank.toLocaleString()}`
              : '—'}
          </span>
          <span className="text-[10px] text-slate-500 block truncate">
            {squadState.overallRank
              ? t.squad.overallRankDesc
              : lang === 'id'
              ? 'Tarik Team ID untuk rank'
              : 'Import Team ID for rank'}
          </span>
        </div>

        {/* Card 4: Squad Value & Bank */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
            {t.squad.squadBudget}
          </span>
          <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            £{totalCostM}m
          </span>
          <span className="text-[10px] text-slate-500 block">
            {t.squad.budgetRem}: £{remainingBudgetM}m
          </span>
        </div>
      </div>

      {/* Interactive Tip Banner (Fully localized) */}
      {squadElements.length > 0 && (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="leading-relaxed">{t.squad.interactiveTip}</span>
          </div>
          {starterElements.length === 11 && (
            <span className="font-mono text-emerald-400 font-bold whitespace-nowrap ml-3 hidden sm:inline">
              {t.squad.formation}: {currentFormation}
            </span>
          )}
        </div>
      )}

      {/* SQUAD INJURY & AVAILABILITY ALERT BANNER */}
      {injuredSquadPlayers.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-900/60 border border-rose-700/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{t.squad.injuryAlertTitle}</span>
                  <span className="px-1.5 py-0.2 rounded bg-rose-600/90 text-white font-mono text-[10px] font-bold">
                    {injuredSquadPlayers.length}
                  </span>
                </h3>
                <p className="text-xs text-rose-300/90 mt-0.5">
                  {t.squad.injuryAlertDesc.replace('{count}', injuredSquadPlayers.length.toString())}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {injuredSquadPlayers.map((p) => {
              const club = teamsMap.get(p.team);
              const health = getPlayerHealthStatus(p);
              const isStarter = starterPicks.some((pick) => pick.elementId === p.id);

              return (
                <div
                  key={p.id}
                  className="bg-slate-950/80 border border-rose-900/60 hover:border-rose-700/80 rounded-lg p-2.5 flex items-center justify-between gap-2.5 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ClubJersey club={club} isGoalkeeper={p.element_type === 1} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white truncate">{p.web_name}</span>
                        <span className={`px-1 py-0.2 rounded text-[9px] font-extrabold border ${health.badgeColor}`}>
                          {health.badgeLabel}
                        </span>
                        {isStarter && (
                          <span className="px-1 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[9px] font-bold">
                            XI
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {club?.short_name} · £{(p.now_cost / 10).toFixed(1)}m
                      </div>
                      {p.news && (
                        <div className="text-[10px] text-rose-300/80 truncate mt-0.5 font-medium" title={p.news}>
                          {p.news}
                        </div>
                      )}
                    </div>
                  </div>

                  {onNavigateToTransfersWithPlayer && (
                    <button
                      onClick={() => onNavigateToTransfersWithPlayer(p)}
                      className="flex items-center gap-1 px-2 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 rounded text-[11px] font-semibold cursor-pointer shrink-0 transition-colors"
                      title={t.squad.findReplacement}
                    >
                      <ArrowRightLeft className="w-3 h-3 text-rose-400" />
                      <span className="hidden sm:inline">{t.squad.findReplacement}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 1: PITCH / STARTING LINE-UP VIEW */}
      {viewMode === 'pitch' ? (
        <div className="space-y-6">
          {squadElements.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/80 border border-dashed border-slate-800 rounded-xl space-y-3">
              <Shield className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">{t.squad.noSquadYet}</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {t.squad.teamIdHelper}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pitch Surface Graphic */}
              <div className="pitch-surface relative w-full rounded-2xl overflow-hidden border border-emerald-900/80 shadow-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/70 to-emerald-950 p-6 sm:p-8 min-h-[580px] flex flex-col justify-between">
                {/* Field Markings */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  {/* Penalty Box Top */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-28 border border-white rounded-b-xl"></div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-12 border border-white"></div>
                  {/* Halfway line & center circle */}
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border border-white rounded-full"></div>
                  {/* Penalty Box Bottom */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-28 border border-white rounded-t-xl"></div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-12 border border-white"></div>
                </div>

                {/* Pitch Formation Header Tag */}
                <div className="relative z-10 flex items-center justify-between text-xs text-emerald-200/90 font-medium pb-2 border-b border-emerald-800/40">
                  <span className="font-semibold uppercase tracking-wider">
                    Starting XI · {starterElements.length === 11 ? `${t.squad.formation} ${currentFormation}` : t.squad.startingXi}
                  </span>
                  <span>{t.squad.playersOnPitch}</span>
                </div>

                {/* ROW 1: GOALKEEPER (GKP) */}
                <div className="relative z-10 flex justify-center py-2">
                  {starterGkps.map((p) => {
                    const pick = starterPicks.find((pick) => pick.elementId === p.id);
                    return (
                      <PitchPlayerCard
                        key={p.id}
                        player={p}
                        club={teamsMap.get(p.team)}
                        pick={pick}
                        isSwapSource={swapSourceId === p.id}
                        onSwap={() => handleInitiateOrExecuteSwap(p.id)}
                        onSetCaptain={() => handleSetCaptain(p.id)}
                        onSetViceCaptain={() => handleSetViceCaptain(p.id)}
                        onRemove={() => handleRemovePlayer(p.id)}
                        onTransfer={onNavigateToTransfersWithPlayer}
                        lang={lang}
                      />
                    );
                  })}
                  {starterGkps.length === 0 && (
                    <div className="text-[11px] text-emerald-400/80 italic py-3">
                      {t.squad.pickGkpStarter}
                    </div>
                  )}
                </div>

                {/* ROW 2: DEFENDERS (DEF) */}
                <div className="relative z-10 flex justify-center flex-wrap gap-2 sm:gap-5 py-2">
                  {starterDefs.map((p) => {
                    const pick = starterPicks.find((pick) => pick.elementId === p.id);
                    return (
                      <PitchPlayerCard
                        key={p.id}
                        player={p}
                        club={teamsMap.get(p.team)}
                        pick={pick}
                        isSwapSource={swapSourceId === p.id}
                        onSwap={() => handleInitiateOrExecuteSwap(p.id)}
                        onSetCaptain={() => handleSetCaptain(p.id)}
                        onSetViceCaptain={() => handleSetViceCaptain(p.id)}
                        onRemove={() => handleRemovePlayer(p.id)}
                        onTransfer={onNavigateToTransfersWithPlayer}
                        lang={lang}
                      />
                    );
                  })}
                  {starterDefs.length === 0 && (
                    <div className="text-[11px] text-emerald-400/80 italic py-3">
                      {t.squad.pickDefStarter}
                    </div>
                  )}
                </div>

                {/* ROW 3: MIDFIELDERS (MID) */}
                <div className="relative z-10 flex justify-center flex-wrap gap-2 sm:gap-5 py-2">
                  {starterMids.map((p) => {
                    const pick = starterPicks.find((pick) => pick.elementId === p.id);
                    return (
                      <PitchPlayerCard
                        key={p.id}
                        player={p}
                        club={teamsMap.get(p.team)}
                        pick={pick}
                        isSwapSource={swapSourceId === p.id}
                        onSwap={() => handleInitiateOrExecuteSwap(p.id)}
                        onSetCaptain={() => handleSetCaptain(p.id)}
                        onSetViceCaptain={() => handleSetViceCaptain(p.id)}
                        onRemove={() => handleRemovePlayer(p.id)}
                        onTransfer={onNavigateToTransfersWithPlayer}
                        lang={lang}
                      />
                    );
                  })}
                  {starterMids.length === 0 && (
                    <div className="text-[11px] text-emerald-400/80 italic py-3">
                      {t.squad.pickMidStarter}
                    </div>
                  )}
                </div>

                {/* ROW 4: FORWARDS (FWD) */}
                <div className="relative z-10 flex justify-center flex-wrap gap-2 sm:gap-5 py-2">
                  {starterFwds.map((p) => {
                    const pick = starterPicks.find((pick) => pick.elementId === p.id);
                    return (
                      <PitchPlayerCard
                        key={p.id}
                        player={p}
                        club={teamsMap.get(p.team)}
                        pick={pick}
                        isSwapSource={swapSourceId === p.id}
                        onSwap={() => handleInitiateOrExecuteSwap(p.id)}
                        onSetCaptain={() => handleSetCaptain(p.id)}
                        onSetViceCaptain={() => handleSetViceCaptain(p.id)}
                        onRemove={() => handleRemovePlayer(p.id)}
                        onTransfer={onNavigateToTransfersWithPlayer}
                        lang={lang}
                      />
                    );
                  })}
                  {starterFwds.length === 0 && (
                    <div className="text-[11px] text-emerald-400/80 italic py-3">
                      {t.squad.pickFwdStarter}
                    </div>
                  )}
                </div>
              </div>

              {/* BENCH AREA */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {t.squad.benchTitle} ({t.squad.playersCount.replace('{count}', benchElements.length.toString())})
                  </h3>
                  <span className="text-[11px] text-slate-500">{t.squad.benchDesc}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(() => {
                    let outfieldSubNum = 0;
                    return benchElements.map((p) => {
                      const health = getPlayerHealthStatus(p);
                      const isGk = p.element_type === 1;
                      let subLabel = '';
                      if (isGk) {
                        subLabel = t.squad.subGkp;
                      } else {
                        outfieldSubNum++;
                        subLabel = t.squad.subNumber.replace('{num}', outfieldSubNum.toString());
                      }

                      return (
                        <div
                          key={p.id}
                          className={`border rounded-lg p-3 relative flex flex-col justify-between transition-colors ${
                            swapSourceId === p.id
                              ? 'bg-slate-950 border-emerald-400 ring-2 ring-emerald-500/40'
                              : isGk
                              ? 'bg-slate-950 border-emerald-900/40 hover:border-emerald-600/60'
                              : health.hasHealthIssue
                              ? health.isDoubtful
                                ? 'bg-amber-950/20 border-amber-800/70 hover:border-amber-600/80'
                                : 'bg-rose-950/20 border-rose-800/70 hover:border-rose-600/80'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-0.5 rounded-lg ${health.hasHealthIssue ? health.ringColor : ''}`}>
                              <ClubJersey
                                club={teamsMap.get(p.team)}
                                isGoalkeeper={isGk}
                                size="sm"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold truncate ${
                                    isGk
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {subLabel}
                                </span>
                                <span className="font-mono text-emerald-400 font-bold ml-1">
                                  £{(p.now_cost / 10).toFixed(1)}m
                                </span>
                              </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate">
                                {p.web_name}
                              </span>
                              {health.hasHealthIssue && (
                                <span
                                  className={`px-1 py-0.2 rounded text-[9px] font-extrabold flex items-center gap-0.5 border ${health.badgeColor} shrink-0`}
                                  title={p.news || health.badgeLabel}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {health.badgeLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {teamsMap.get(p.team)?.short_name} · Form {p.form}
                            </div>
                            {health.hasHealthIssue && p.news && (
                              <div
                                className="text-[10px] text-rose-300/90 font-medium truncate mt-0.5"
                                title={p.news}
                              >
                                {p.news}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1">
                          <button
                            onClick={() => handleInitiateOrExecuteSwap(p.id)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>{t.squad.swapBtn}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            {onNavigateToTransfersWithPlayer && health.hasHealthIssue && (
                              <button
                                onClick={() => onNavigateToTransfersWithPlayer(p)}
                                title={t.squad.findReplacement}
                                className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemovePlayer(p.id)}
                              title={t.squad.removePlayer}
                              className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                  {benchElements.length === 0 && (
                    <div className="col-span-4 p-4 text-center text-xs text-slate-500">
                      {t.squad.emptyBench}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: DETAILED LIST / TABULAR VIEW */
        <div className="space-y-6">
          <SquadPositionSection
            title={t.squad.posGkpTitle}
            requiredCount={2}
            players={gkpList}
            teamsMap={teamsMap}
            onRemove={handleRemovePlayer}
            onTransfer={onNavigateToTransfersWithPlayer}
            lang={lang}
          />
          <SquadPositionSection
            title={t.squad.posDefTitle}
            requiredCount={5}
            players={defList}
            teamsMap={teamsMap}
            onRemove={handleRemovePlayer}
            onTransfer={onNavigateToTransfersWithPlayer}
            lang={lang}
          />
          <SquadPositionSection
            title={t.squad.posMidTitle}
            requiredCount={5}
            players={midList}
            teamsMap={teamsMap}
            onRemove={handleRemovePlayer}
            onTransfer={onNavigateToTransfersWithPlayer}
            lang={lang}
          />
          <SquadPositionSection
            title={t.squad.posFwdTitle}
            requiredCount={3}
            players={fwdList}
            teamsMap={teamsMap}
            onRemove={handleRemovePlayer}
            onTransfer={onNavigateToTransfersWithPlayer}
            lang={lang}
          />
        </div>
      )}

      {/* Manual Quick Adder when squad incomplete */}
      {activeTab === 'manual' && squadElements.length < 15 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {t.squad.quickAddTitle.replace('{count}', squadElements.length.toString())}
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={manualPosFilter}
              onChange={(e) => setManualPosFilter(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="1">{t.explorer.posGkp} - {t.squad.needPos.replace('{count}', Math.max(0, 2 - gkpList.length).toString())}</option>
              <option value="2">{t.explorer.posDef} - {t.squad.needPos.replace('{count}', Math.max(0, 5 - defList.length).toString())}</option>
              <option value="3">{t.explorer.posMid} - {t.squad.needPos.replace('{count}', Math.max(0, 5 - midList.length).toString())}</option>
              <option value="4">{t.explorer.posFwd} - {t.squad.needPos.replace('{count}', Math.max(0, 3 - fwdList.length).toString())}</option>
            </select>

            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder={t.squad.quickAddPlaceholder}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {manualCandidates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
              {manualCandidates.map((p) => {
                const c = teamsMap.get(p.team);
                return (
                  <div
                    key={p.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <ClubJersey
                        club={c}
                        isGoalkeeper={p.element_type === 1}
                        size="sm"
                      />
                      <div>
                        <div className="font-semibold text-white">{p.web_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {c?.short_name} · £{(p.now_cost / 10).toFixed(1)}m · {p.total_points} pts
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleAddPlayer(p);
                        setManualSearch('');
                      }}
                      className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/60 rounded cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: GENERATE BEST BUDGET SQUAD */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{t.squad.budgetModalTitle}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.squad.budgetModalDesc}</p>
              </div>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 p-4 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">{t.squad.budgetLabel}</span>
                <span className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                  £{budgetSlider.toFixed(1)}m
                </span>
              </div>
              <input
                type="range"
                min="95.0"
                max="105.0"
                step="0.5"
                value={budgetSlider}
                onChange={(e) => setBudgetSlider(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>£95.0m</span>
                <span>£100.0m</span>
                <span>£105.0m</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              {lang === 'id'
                ? 'Algoritma secara otomatis memilih 2 Kiper, 5 Bek, 5 Gelandang, dan 3 Penyerang dengan kombinasi form dan jadwal terbaik tanpa melanggar pagu anggaran dan batas 3 pemain per klub.'
                : 'The algorithm automatically selects 2 GKP, 5 DEF, 5 MID, and 3 FWD with the best form and fixture combinations while respecting budget and the 3 players per club limit.'}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
              >
                {t.squad.cancelBtn}
              </button>
              <button
                onClick={handleApplyBudgetSquad}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.squad.applyBudgetSquad}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// PITCH PLAYER CARD COMPONENT WITH REAL CLUB JERSEY
interface PitchPlayerCardProps {
  player: FPLElement;
  club?: FPLTeam;
  pick?: any;
  isSwapSource: boolean;
  onSwap: () => void;
  onSetCaptain: () => void;
  onSetViceCaptain: () => void;
  onRemove: () => void;
  onTransfer?: (player: FPLElement) => void;
  lang: Language;
}

const PitchPlayerCard: React.FC<PitchPlayerCardProps> = ({
  player,
  club,
  pick,
  isSwapSource,
  onSwap,
  onSetCaptain,
  onSetViceCaptain,
  onRemove,
  onTransfer,
  lang,
}) => {
  const t = translations[lang];
  const isCaptain = pick?.isCaptain;
  const isViceCaptain = pick?.isViceCaptain;
  const health = getPlayerHealthStatus(player);

  return (
    <div
      className={`relative group flex flex-col items-center transition-transform hover:scale-105 duration-150 w-20 sm:w-24 ${
        isSwapSource ? 'scale-110 z-20' : ''
      }`}
    >
      {/* Club Kit Jersey with Captaincy Badge & Injury Badge */}
      <div className="relative cursor-pointer" onClick={onSwap}>
        <div
          className={`transition-all rounded-lg p-0.5 ${
            isSwapSource
              ? 'ring-2 ring-amber-400 animate-pulse'
              : health.hasHealthIssue
              ? health.ringColor
              : ''
          }`}
        >
          <ClubJersey
            club={club}
            isGoalkeeper={player.element_type === 1}
            size="md"
          />
        </div>

        {/* Injury / Availability Warning Badge */}
        {health.hasHealthIssue && (
          <div
            title={`${player.news || (health.isDoubtful ? t.squad.doubtfulBadge : t.squad.injuredBadge)} (${health.badgeLabel})`}
            className={`absolute -top-1 -left-1 z-10 px-1 py-0.2 rounded-md shadow-lg border text-[9px] font-extrabold flex items-center gap-0.5 cursor-help ${health.badgeColor}`}
          >
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            <span>{health.badgeLabel}</span>
          </div>
        )}

        {/* Captain (C) or Vice-Captain (VC) Badge */}
        {isCaptain ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetViceCaptain();
            }}
            title={t.squad.clickToSetVc}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-black font-extrabold text-[10px] flex items-center justify-center shadow-lg border border-amber-600 cursor-pointer"
          >
            C
          </button>
        ) : isViceCaptain ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetCaptain();
            }}
            title={t.squad.clickToSetC}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-300 text-black font-extrabold text-[10px] flex items-center justify-center shadow-lg border border-slate-500 cursor-pointer"
          >
            V
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetCaptain();
            }}
            title={t.squad.makeCaptain}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 hover:bg-amber-400 text-slate-400 hover:text-black font-bold text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-slate-700 shadow"
          >
            C
          </button>
        )}
      </div>

      {/* Name and Price Plate with Health Indicator */}
      <div
        onClick={onSwap}
        className={`mt-1 w-full border rounded px-1 py-0.5 text-center shadow-md cursor-pointer transition-colors ${
          health.hasHealthIssue
            ? 'bg-rose-950/90 border-rose-800/80 hover:bg-rose-900/90'
            : 'bg-slate-950/95 hover:bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          {health.hasHealthIssue && (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                health.isDoubtful ? 'bg-amber-400' : 'bg-rose-500'
              }`}
            />
          )}
          <span className="block text-[11px] sm:text-xs font-bold text-white truncate">
            {player.web_name}
          </span>
        </div>
        <span
          className={`block text-[9px] sm:text-[10px] font-mono tabular-nums font-semibold truncate ${
            health.hasHealthIssue ? health.textClass : 'text-emerald-400'
          }`}
          title={health.hasHealthIssue ? player.news || health.badgeLabel : undefined}
        >
          {health.hasHealthIssue
            ? `${health.badgeLabel} ${health.isDoubtful ? t.squad.doubtfulBadge : t.squad.injuredBadge}`
            : `£${(player.now_cost / 10).toFixed(1)}m · ${player.total_points}${t.squad.pointsAbbr}`}
        </span>
      </div>

      {/* Quick Hover Controls */}
      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onSwap}
          title={t.squad.swapBtn}
          className="p-1 rounded bg-slate-950/90 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
        >
          <ArrowRightLeft className="w-2.5 h-2.5" />
        </button>
        {onTransfer && (
          <button
            onClick={() => onTransfer(player)}
            title={t.squad.transferBtn}
            className="p-1 rounded bg-slate-950/90 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
          >
            <TrendingUp className="w-2.5 h-2.5" />
          </button>
        )}
        <button
          onClick={onRemove}
          title={t.squad.removePlayer}
          className="p-1 rounded bg-slate-950/90 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};

// LIST VIEW SQUAD POSITION COMPONENT
interface SquadPositionSectionProps {
  title: string;
  requiredCount: number;
  players: FPLElement[];
  teamsMap: Map<number, FPLTeam>;
  onRemove: (id: number) => void;
  onTransfer?: (player: FPLElement) => void;
  lang: Language;
}

const SquadPositionSection: React.FC<SquadPositionSectionProps> = ({
  title,
  requiredCount,
  players,
  teamsMap,
  onRemove,
  onTransfer,
  lang,
}) => {
  const t = translations[lang];
  const isComplete = players.length === requiredCount;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>{title}</span>
          <span className="text-xs font-mono font-normal text-slate-400">
            ({players.length}/{requiredCount})
          </span>
        </h3>
        {isComplete && <span className="text-[11px] text-emerald-400 font-semibold">{t.squad.filledBadge}</span>}
      </div>

      {players.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800/80 rounded-lg">
          {t.squad.emptyPosText}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {players.map((p) => {
            const club = teamsMap.get(p.team);
            const price = (p.now_cost / 10).toFixed(1);
            const health = getPlayerHealthStatus(p);

            return (
              <div
                key={p.id}
                className={`border rounded-lg p-3 relative group flex flex-col justify-between transition-colors ${
                  health.hasHealthIssue
                    ? health.isDoubtful
                      ? 'bg-amber-950/20 border-amber-800/70 hover:border-amber-600/80'
                      : 'bg-rose-950/20 border-rose-800/70 hover:border-rose-600/80'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`p-0.5 rounded-lg ${health.hasHealthIssue ? health.ringColor : ''}`}>
                      <ClubJersey
                        club={club}
                        isGoalkeeper={p.element_type === 1}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">{club?.short_name}</span>
                        <span className="font-mono tabular-nums text-emerald-400 font-bold">
                          £{price}m
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="font-bold text-white text-sm tracking-tight truncate">
                          {p.web_name}
                        </div>
                        {health.hasHealthIssue && (
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-extrabold flex items-center gap-0.5 border ${health.badgeColor} shrink-0`}
                            title={p.news || health.badgeLabel}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {health.badgeLabel}
                          </span>
                        )}
                      </div>
                      {health.hasHealthIssue && p.news && (
                        <div
                          className="text-[10px] text-rose-300/90 font-medium truncate mt-0.5"
                          title={p.news}
                        >
                          {p.news}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 font-mono tabular-nums">
                    <span>{p.total_points} pts</span>
                    <span>Form: {p.form}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-1 pt-2 border-t border-slate-800/60">
                  {onTransfer && (
                    <button
                      onClick={() => onTransfer(p)}
                      title={t.squad.findReplacement}
                      className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>{t.squad.transferBtn}</span>
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(p.id)}
                    title={t.squad.removePlayer}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-auto cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
