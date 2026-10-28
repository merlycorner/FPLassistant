import React, { useEffect } from 'react';
import { Language, translations } from '../lib/i18n';
import {
  X,
  LayoutDashboard,
  Search,
  Users,
  Shield,
  ArrowRightLeft,
  Crown,
  AlertTriangle,
  Sparkles,
  Activity,
  Globe,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
  lang: Language;
  onToggleLang: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentTab,
  onTabChange,
  lang,
  onToggleLang,
}) => {
  const t = translations[lang];

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navItems = [
    {
      id: 'dashboard',
      label: t.nav.dashboard,
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800/60',
      description: lang === 'id' ? 'Ringkasan GW 8 Live, skor & deadline' : 'GW 8 Live summary, scores & deadline',
    },
    {
      id: 'explorer',
      label: t.nav.explorer,
      icon: Search,
      description: lang === 'id' ? 'Database 669 pemain & filter xG' : '669 players database & xG filters',
    },
    {
      id: 'compare',
      label: t.nav.compare,
      icon: Users,
      description: lang === 'id' ? 'Head-to-head statistik 2 pemain' : 'Head-to-head statistical comparison',
    },
    {
      id: 'squad',
      label: t.nav.squad,
      icon: Shield,
      badge: 'Field XI',
      badgeColor: 'bg-indigo-950 text-indigo-400 border-indigo-800/60',
      description: lang === 'id' ? 'Visual lapangan, formasi & Best XI' : 'Pitch layout, formations & Best XI',
    },
    {
      id: 'transfers',
      label: t.nav.transfers,
      icon: ArrowRightLeft,
      description: lang === 'id' ? 'Rekomendasi transfer berbasis data' : 'Data-driven transfer suggestions',
    },
    {
      id: 'captains',
      label: t.nav.captains,
      icon: Crown,
      badge: 'Armband',
      badgeColor: 'bg-amber-950 text-amber-400 border-amber-800/60',
      description: lang === 'id' ? 'Kalkulator kapten setiap gameweek' : 'Every gameweek captaincy engine',
    },
    {
      id: 'injuries',
      label: t.nav.injuries,
      icon: AlertTriangle,
      badge: 'Radar',
      badgeColor: 'bg-rose-950 text-rose-400 border-rose-800/60',
      description: lang === 'id' ? 'Pemantau cedera & kebugaran skuad' : 'Injury, bans & squad health radar',
    },
    {
      id: 'picks',
      label: t.nav.picks,
      icon: Sparkles,
      description: lang === 'id' ? 'Dream Team resmi & pemain proyeksi' : 'Official Dream Team & projected picks',
    },
    {
      id: 'priceWatch',
      label: t.nav.priceWatch,
      icon: Activity,
      description: lang === 'id' ? 'Tren transfer & pergerakan harga' : 'Transfer trends & price movements',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <aside
          className="w-80 sm:w-88 bg-slate-950 border-r border-slate-800 text-slate-100 flex flex-col shadow-2xl relative z-10 animate-in slide-in-from-left duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={t.nav.menuTitle}
        >
          {/* Sidebar Top / Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-black text-base shadow-md">
                PL
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight leading-none">
                  FPL Assistant
                </h2>
                <span className="text-[11px] text-emerald-400 font-medium">
                  Fantasy Premier League 2026/27
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={t.nav.closeMenu}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links List */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 focus:outline-none">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.nav.menuTitle}
            </div>

            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onClose();
                  }}
                  className={`w-full group flex items-start gap-3.5 p-3 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-950/60 border border-emerald-700/70 text-white font-semibold shadow-inner'
                      : 'hover:bg-slate-900/90 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 transition-colors ${
                      isActive
                        ? 'bg-emerald-500 text-black shadow'
                        : 'bg-slate-900 text-slate-400 group-hover:text-emerald-400 group-hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono uppercase tracking-wider ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 shrink-0 mt-2 transition-transform ${
                      isActive
                        ? 'text-emerald-400 translate-x-0.5'
                        : 'text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 space-y-3">
            {/* Language Toggle in Sidebar */}
            <div className="flex items-center justify-between px-2 text-xs">
              <span className="text-slate-400 font-medium">Bahasa / Language:</span>
              <button
                onClick={onToggleLang}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'id' ? 'Bahasa Indonesia' : 'English'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 px-2">
              <span>Official FPL Public API</span>
              <span className="font-mono text-emerald-400">Rp0 Tech Stack</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
