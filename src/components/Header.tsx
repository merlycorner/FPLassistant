import React from 'react';
import { Language, translations } from '../lib/i18n';
import {
  LayoutDashboard,
  Users,
  GitCompare,
  Shield,
  ArrowRightLeft,
  Crown,
  Sparkles,
  Coins,
  RefreshCw,
  Globe,
  Sun,
  Moon,
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  lang: Language;
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  lastUpdated?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  lastUpdated,
  onRefresh,
  isRefreshing,
}) => {
  const t = translations[lang];

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'explorer', label: t.nav.explorer, icon: Users },
    { id: 'compare', label: t.nav.compare, icon: GitCompare },
    { id: 'squad', label: t.nav.squad, icon: Shield },
    { id: 'transfers', label: t.nav.transfers, icon: ArrowRightLeft },
    { id: 'captains', label: t.nav.captains, icon: Crown },
    { id: 'picks', label: t.nav.picks, icon: Sparkles },
    { id: 'priceWatch', label: t.nav.priceWatch, icon: Coins },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-8">
        {/* ROW 1: BRAND TITLE & UTILITIES */}
        <div className="flex items-center justify-between h-14 sm:h-16 border-b border-slate-800/60">
          {/* BRAND TITLE: FPL Assistant · Fantasy Premier League 2026/2027 */}
          <button
            onClick={() => onTabChange('dashboard')}
            className="cursor-pointer group flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-400 group-hover:bg-emerald-500/20 transition-all shadow-sm">
              <Shield className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                FPL Assistant
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide">
                Fantasy Premier League 2026/2027
              </span>
            </div>
          </button>

          {/* RIGHT UTILITIES: Refresh, Theme Switch & Language Switch */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {formattedTime && (
              <span className="hidden md:inline-flex text-xs text-slate-400 tabular-nums">
                {t.app.lastUpdated} {formattedTime}
              </span>
            )}

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title={t.app.refresh}
              className="p-2 text-slate-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              aria-label={t.app.refresh}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={onToggleTheme}
              className="p-2 text-slate-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              title={theme === 'dark' ? t.app.themeLight : t.app.themeDark}
              aria-label={t.app.themeToggle}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </button>

            {/* Language Toggle (ID / EN) */}
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              title={lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'id' ? 'ID' : 'EN'}</span>
            </button>
          </div>
        </div>

        {/* ROW 2: SINGLE-FRAME NAVIGATION DECK (NO HORIZONTAL SCROLL) */}
        <nav
          aria-label={t.nav.menuTitle}
          className="w-full py-1.5 overflow-hidden"
        >
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-1.5 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer truncate w-full ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                  }`}
                  title={item.label}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
};
