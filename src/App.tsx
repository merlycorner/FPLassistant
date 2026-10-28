import React, { useState, useEffect, useCallback } from 'react';
import { FPLBootstrap, FPLFixture, FPLElement, UserSquadState } from './types/fpl';
import { Language, translations } from './lib/i18n';
import { fetchBootstrapStatic, fetchFixtures } from './lib/fplApi';
import { enforceBenchGkpFirst } from './lib/scoring';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { PlayerExplorerView } from './components/PlayerExplorerView';
import { PlayerComparisonView } from './components/PlayerComparisonView';
import { MySquadView } from './components/MySquadView';
import { TransferAssistantView } from './components/TransferAssistantView';
import { GameweekPicksView } from './components/GameweekPicksView';
import { PriceWatchView } from './components/PriceWatchView';
import { CaptainRecommenderView } from './components/CaptainRecommenderView';
import { InjuryWatchView } from './components/InjuryWatchView';
import { PlayerModal } from './components/PlayerModal';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

const SQUAD_STORAGE_KEY = 'fpl_assistant_squad_v1';
const LANG_STORAGE_KEY = 'fpl_assistant_lang_v1';
const THEME_STORAGE_KEY = 'fpl_assistant_theme_v1';

export type Theme = 'dark' | 'light';

export default function App() {
  // Language
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'id';
  });

  // Display Theme (Dark / Light Mode)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const t = translations[lang];

  // Active navigation tab
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Core FPL data
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // User Squad State
  const [squadState, setSquadState] = useState<UserSquadState>(() => {
    try {
      const saved = localStorage.getItem(SQUAD_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading saved squad:', e);
    }
    return {
      picks: [],
      bank: 0,
      source: 'manual',
      lastUpdated: new Date().toISOString(),
    };
  });

  // Cross-tab interaction states
  const [comparePlayer1, setComparePlayer1] = useState<FPLElement | null>(null);
  const [comparePlayer2, setComparePlayer2] = useState<FPLElement | null>(null);
  const [transferTargetPlayer, setTransferTargetPlayer] = useState<FPLElement | null>(null);
  const [inspectModalPlayer, setInspectModalPlayer] = useState<FPLElement | null>(null);

  // Toggle language
  const handleToggleLang = () => {
    const nextLang = lang === 'id' ? 'en' : 'id';
    setLang(nextLang);
    localStorage.setItem(LANG_STORAGE_KEY, nextLang);
  };

  // Save squad changes
  const handleUpdateSquad = (newState: UserSquadState) => {
    setSquadState(newState);
    try {
      localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error('Error saving squad:', e);
    }
  };

  // Add player to squad
  const handleAddToSquad = (player: FPLElement) => {
    if (squadState.picks.some((p) => p.elementId === player.id)) return;
    if (squadState.picks.length >= 15) return;

    let updatedPicks = [
      ...squadState.picks,
      {
        elementId: player.id,
        position: squadState.picks.length + 1,
      },
    ];

    if (bootstrap) {
      const pMap = new Map<number, FPLElement>();
      bootstrap.elements.forEach((el) => pMap.set(el.id, el));
      updatedPicks = enforceBenchGkpFirst(updatedPicks, pMap);
    }

    handleUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });
  };

  // Initial data loading
  const loadFplData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setFetchError(null);

    try {
      const [bootResult, fixResult] = await Promise.all([
        fetchBootstrapStatic(),
        fetchFixtures(),
      ]);

      setBootstrap(bootResult.data);
      setFixtures(fixResult);
      setLastUpdated(bootResult.lastUpdated);
    } catch (err: any) {
      console.error('Failed to load FPL data:', err);
      setFetchError(err.message || 'Error connecting to FPL API');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFplData(false);
  }, [loadFplData]);

  // Navigate to compare with selected player
  const handleSelectForCompare = (player: FPLElement) => {
    if (!comparePlayer1) {
      setComparePlayer1(player);
    } else if (!comparePlayer2 && comparePlayer1.id !== player.id) {
      setComparePlayer2(player);
    } else {
      setComparePlayer1(player);
      setComparePlayer2(null);
    }
    setCurrentTab('compare');
  };

  // Navigate to transfers with player to sell
  const handleNavigateToTransfersWithPlayer = (player: FPLElement) => {
    setTransferTargetPlayer(player);
    setCurrentTab('transfers');
  };

  // Swap player in squad
  const handleSwapInSquad = (playerOut: FPLElement, playerIn: FPLElement) => {
    let updatedPicks = squadState.picks.map((pick) => {
      if (pick.elementId === playerOut.id) {
        return { ...pick, elementId: playerIn.id };
      }
      return pick;
    });

    if (bootstrap) {
      const pMap = new Map<number, FPLElement>();
      bootstrap.elements.forEach((el) => pMap.set(el.id, el));
      updatedPicks = enforceBenchGkpFirst(updatedPicks, pMap);
    }

    handleUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });

    setCurrentTab('squad');
  };

  // Set captain in squad
  const handleSetCaptain = (elementId: number) => {
    const updatedPicks = squadState.picks.map((pick) => ({
      ...pick,
      isCaptain: pick.elementId === elementId,
      isViceCaptain: pick.elementId === elementId ? false : pick.isViceCaptain,
    }));

    handleUpdateSquad({
      ...squadState,
      picks: updatedPicks,
      lastUpdated: new Date().toISOString(),
    });
  };

  const squadPlayerIds = squadState.picks.map((p) => p.elementId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      {/* Header with single-frame navigation, Theme toggle & Language switch */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        lang={lang}
        onToggleLang={handleToggleLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        lastUpdated={lastUpdated}
        onRefresh={() => loadFplData(true)}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="py-24 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
            <div className="text-base font-semibold text-slate-200">{t.app.loading}</div>
            <p className="text-xs text-slate-500">
              {t.app.loadingDesc}
            </p>
          </div>
        ) : fetchError ? (
          <div className="py-16 max-w-lg mx-auto text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{t.app.errorLoading}</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{fetchError}</p>
            <button
              onClick={() => loadFplData(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.app.retry}</span>
            </button>
          </div>
        ) : bootstrap ? (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                bootstrap={bootstrap}
                fixtures={fixtures}
                lang={lang}
                onNavigate={setCurrentTab}
                lastUpdated={lastUpdated}
              />
            )}

            {currentTab === 'explorer' && (
              <PlayerExplorerView
                players={bootstrap.elements}
                teams={bootstrap.teams}
                fixtures={fixtures}
                lang={lang}
                squadPlayerIds={squadPlayerIds}
                onAddToSquad={handleAddToSquad}
                onSelectForCompare={handleSelectForCompare}
              />
            )}

            {currentTab === 'compare' && (
              <PlayerComparisonView
                players={bootstrap.elements}
                teams={bootstrap.teams}
                fixtures={fixtures}
                lang={lang}
                initialPlayer1={comparePlayer1}
                initialPlayer2={comparePlayer2}
              />
            )}

            {currentTab === 'squad' && (
              <MySquadView
                bootstrap={bootstrap}
                squadState={squadState}
                onUpdateSquad={handleUpdateSquad}
                lang={lang}
                onNavigateToTransfersWithPlayer={handleNavigateToTransfersWithPlayer}
              />
            )}

            {currentTab === 'transfers' && (
              <TransferAssistantView
                bootstrap={bootstrap}
                fixtures={fixtures}
                squadState={squadState}
                lang={lang}
                initialPlayerToSell={transferTargetPlayer}
                onSwapInSquad={handleSwapInSquad}
              />
            )}

            {currentTab === 'captains' && (
              <CaptainRecommenderView
                bootstrap={bootstrap}
                fixtures={fixtures}
                squadState={squadState}
                lang={lang}
                onSelectPlayer={(player) => setInspectModalPlayer(player)}
                onSetCaptainInSquad={handleSetCaptain}
              />
            )}

            {currentTab === 'injuries' && (
              <InjuryWatchView
                bootstrap={bootstrap}
                squadState={squadState}
                lang={lang}
                onSelectPlayer={(player) => setInspectModalPlayer(player)}
                onNavigateToTransfersWithPlayer={handleNavigateToTransfersWithPlayer}
              />
            )}

            {currentTab === 'picks' && (
              <GameweekPicksView
                bootstrap={bootstrap}
                fixtures={fixtures}
                lang={lang}
                onSelectPlayer={(player) => setInspectModalPlayer(player)}
              />
            )}

            {currentTab === 'priceWatch' && (
              <PriceWatchView
                bootstrap={bootstrap}
                lang={lang}
                onSelectPlayer={(player) => setInspectModalPlayer(player)}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Inspect Modal if opened from Picks, Captains, or PriceWatch */}
      {inspectModalPlayer && bootstrap && (
        <PlayerModal
          player={inspectModalPlayer}
          club={bootstrap.teams.find((t) => t.id === inspectModalPlayer.team)}
          fixtures={fixtures}
          allTeams={bootstrap.teams}
          lang={lang}
          onClose={() => setInspectModalPlayer(null)}
          onAddToSquad={handleAddToSquad}
          isInSquad={squadPlayerIds.includes(inspectModalPlayer.id)}
          onCompareWith={handleSelectForCompare}
        />
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-400">FPL Assistant</span> · MVP 0.1 ·{' '}
            <span>{t.app.tagline}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{t.app.allRights}</span>
            <span>·</span>
            <span>{t.app.techStack}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
