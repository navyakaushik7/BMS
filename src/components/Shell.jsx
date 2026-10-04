import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Landmark, Gift, FileBarChart, ShieldCheck, Settings as SettingsIcon, LogOut, Sun, Moon, Wifi, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'register', label: 'Voters', icon: Users },
  { key: 'booths', label: 'Booths', icon: Landmark },
  { key: 'schemes', label: 'Schemes', icon: Gift },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'staff', label: 'Access', icon: ShieldCheck, adminOnly: true },
  { key: 'settings', label: 'Settings', icon: SettingsIcon }
];

export default function Shell({ page, onNavigate, children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { wards, selectedWardId, setSelectedWardId } = useData();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('bms_sidebar') === '1');
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { localStorage.setItem('bms_sidebar', collapsed ? '1' : '0'); }, [collapsed]);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user?.role === 'admin');
  const current = items.find((i) => i.key === page);
  const initials = (user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const go = (key) => { onNavigate(key); setDrawer(false); };
  const confirmLogout = () => { if (window.confirm('Log out?')) logout(); };

  // `rail` = icon-only (desktop collapsed). The mobile drawer is always full width.
  const Sidebar = ({ rail }) => (
    <div className="h-full flex flex-col bg-white dark:bg-ink-light border-r border-black/10 dark:border-white/10">
      <div className={`h-16 flex items-center border-b border-black/10 dark:border-white/10 ${rail ? 'justify-center' : 'px-5 gap-2.5'}`}>
        <div className="w-8 h-8 rounded-lg bg-brass/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-brass dark:text-brass-light" />
        </div>
        {!rail && <p className="text-sm font-bold text-ink dark:text-paper leading-tight">Booth Management</p>}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {items.map(({ key, label, icon: Icon }) => {
          const active = page === key;
          return (
            <button key={key} onClick={() => go(key)} title={rail ? label : undefined} aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center rounded-lg text-sm transition-colors ${rail ? 'justify-center py-2.5' : 'gap-2.5 px-3 py-2.5'} ${
                active ? 'bg-brass/15 text-brass dark:text-brass-light font-semibold'
                       : 'text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-paper hover:bg-black/5 dark:hover:bg-white/10'}`}>
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!rail && label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-black/10 dark:border-white/10 p-3 space-y-2">
        <div className={`flex items-center ${rail ? 'justify-center' : 'gap-2.5 px-1'}`} title={rail ? user?.name : undefined}>
          <div className="w-8 h-8 rounded-full bg-slate/15 dark:bg-white/10 text-xs font-bold flex items-center justify-center text-ink dark:text-paper shrink-0">{initials}</div>
          {!rail && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-paper truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{user?.role === 'admin' ? 'Admin' : user?.wardName || 'MLA'}</p>
            </div>
          )}
        </div>
        <button onClick={confirmLogout} title="Logout"
          className={`w-full flex items-center rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:text-seal-red hover:bg-seal-red/10 transition-colors ${rail ? 'justify-center py-2.5' : 'gap-2.5 px-3 py-2.5'}`}>
          <LogOut className="w-[18px] h-[18px]" /> {!rail && 'Logout'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-paper dark:bg-ink overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:block shrink-0 transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <Sidebar rail={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 max-w-[80%] h-full"><Sidebar rail={false} /></aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-ink-light/40 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setDrawer(true)} className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400" aria-label="Menu"><Menu className="w-5 h-5" /></button>
            <button onClick={() => setCollapsed((c) => !c)} className="hidden lg:block p-2 -ml-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Collapse sidebar">
              {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <h2 className="text-base font-semibold text-ink dark:text-paper truncate">{current?.label}</h2>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-seal-green dark:text-emerald-400"><Wifi className="w-3.5 h-3.5" /> Live</span>
            {user?.role === 'admin' ? (
              <select value={selectedWardId ?? ''} onChange={(e) => setSelectedWardId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-ink dark:text-paper max-w-[140px]">
                <option value="">All wards</option>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{user?.wardName}</span>}
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10" title="Theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
