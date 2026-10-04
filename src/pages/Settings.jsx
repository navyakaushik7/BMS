import { useState, useEffect } from 'react';
import {
  User, Palette, LayoutDashboard, Database, MapPin, Plus, Check, LogOut,
  Sun, Moon, Wifi, WifiOff, Upload, FileBarChart, RotateCcw
} from 'lucide-react';
import { createWard } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ---- tiny local-preference helpers (Overview reads the same keys) ----
const readFlag = (key, fallback = true) => {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
};
const writeFlag = (key, val) => { try { localStorage.setItem(key, val ? '1' : '0'); } catch { /* ignore */ } };

const TABS = [
  { key: 'account', label: 'My Account', icon: User },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'data', label: 'Data & Sync', icon: Database },
  { key: 'wards', label: 'Wards', icon: MapPin, adminOnly: true }
];

// ---- building blocks ----
function Panel({ title, description, footer, children }) {
  return (
    <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl shadow-card">
      <div className="px-6 py-5 border-b border-black/10 dark:border-white/10">
        <h2 className="text-lg font-bold text-ink dark:text-paper">{title}</h2>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="px-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">{footer}</div>
      )}
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="grid xl:grid-cols-[210px_minmax(0,1fr)] gap-x-8 gap-y-2 py-5 border-b border-black/5 dark:border-white/5 last:border-0">
      <div className="text-sm font-semibold text-ink dark:text-paper xl:pt-1">{label}</div>
      <div className="min-w-0">
        {children}
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">{hint}</p>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
    >
      <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-brass' : 'bg-black/15 dark:bg-white/20'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span className="text-sm text-ink dark:text-paper">{label}</span>
    </button>
  );
}

function ActionButton({ icon: Icon, children, onClick, tone = 'default' }) {
  const tones = {
    default: 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-ink dark:text-paper',
    danger: 'bg-seal-red/10 hover:bg-seal-red/20 text-seal-red'
  };
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${tones[tone]}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
}

function useSocketStatus() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = getSocket();
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    setConnected(s.connected);
    s.on('connect', up);
    s.on('disconnect', down);
    return () => { s.off('connect', up); s.off('disconnect', down); };
  }, []);
  return connected;
}

// ---- tab panels ----
function AccountTab() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const initials = (user?.name || '?')
  .split(' ')
  .filter((w) => /^[A-Za-z]/.test(w))
  .slice(-2)
  .map((w) => w[0])
  .join('')
  .toUpperCase();
  return (
    <Panel title="My Account" description="Your profile and what you can access.">
      <div className="flex items-center gap-4 py-6 border-b border-black/5 dark:border-white/5">
        <div className="w-14 h-14 rounded-full bg-brass/15 text-brass dark:text-brass-light text-lg font-bold flex items-center justify-center">{initials}</div>
        <div className="min-w-0">
          <p className="font-semibold text-ink dark:text-paper truncate">{user?.name}</p>
          <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brass/15 text-brass dark:text-brass-light">
            {isAdmin ? 'Administrator' : 'MLA'}
          </span>
        </div>
      </div>

      <Row label="Phone number" hint="Used to sign you in with a one-time code by SMS.">
        <span className="font-mono text-sm text-ink dark:text-paper">{user?.phone}</span>
      </Row>
      <Row
        label="Ward access"
        hint={isAdmin
          ? 'Admins can view every ward. Switch wards from the dropdown in the top bar.'
          : 'You can only see voters, booths and schemes that belong to this ward.'}
      >
        <span className="text-sm text-ink dark:text-paper">{isAdmin ? 'All wards' : user?.wardName || 'Not assigned'}</span>
      </Row>
      <Row label="Session" hint="Signing out clears this device. You will need a new code to sign back in.">
        <ActionButton icon={LogOut} tone="danger" onClick={() => { if (window.confirm('Log out?')) logout(); }}>Log out</ActionButton>
      </Row>
    </Panel>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: 'light', label: 'Light', icon: Sun, swatch: 'bg-paper border-black/10', line: 'bg-ink/20' },
    { key: 'dark', label: 'Dark', icon: Moon, swatch: 'bg-ink border-white/20', line: 'bg-paper/30' }
  ];
  return (
    <Panel title="Appearance" description="How the app looks on this device." footer="Changes apply instantly and are saved on this device.">
      <Row label="Theme" hint="Dark mode is easier on the eyes when you are working late or on a projector.">
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {options.map(({ key, label, icon: Icon, swatch, line }) => {
            const active = theme === key;
            return (
              <button key={key} type="button" onClick={() => setTheme(key)} aria-pressed={active}
                className={`w-full min-w-0 rounded-xl border-2 p-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${active ? 'border-brass' : 'border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/30'}`}>
                <div className={`h-16 rounded-lg border ${swatch} p-2 space-y-1.5`}>
                  <div className={`h-1.5 w-1/2 rounded-full ${line}`} />
                  <div className={`h-1.5 w-4/5 rounded-full ${line}`} />
                  <div className="h-1.5 w-1/3 rounded-full bg-brass" />
                </div>
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink dark:text-paper"><Icon className="w-3.5 h-3.5" /> {label}</span>
                  {active && <Check className="w-4 h-4 text-brass" />}
                </div>
              </button>
            );
          })}
        </div>
      </Row>
    </Panel>
  );
}

function DashboardTab() {
  const [live, setLive] = useState(() => readFlag('bms_live'));
  const [demo, setDemo] = useState(() => readFlag('bms_show_demo'));

  const reset = () => {
    setLive(true); setDemo(true);
    writeFlag('bms_live', true); writeFlag('bms_show_demo', true);
  };

  return (
    <Panel
      title="Dashboard"
      description="Control what the Overview page shows."
      footer={<div className="flex items-center justify-between gap-3 flex-wrap">
        <span>Changes apply instantly and are saved on this device.</span>
        <ActionButton icon={RotateCcw} onClick={reset}>Reset to defaults</ActionButton>
      </div>}
    >
      <Row label="Live updates" hint="Refresh the Overview automatically when voters are added, edited, deleted or imported. Turn off to update only when you press Refresh.">
        <Toggle checked={live} onChange={(v) => { setLive(v); writeFlag('bms_live', v); }} label={live ? 'On' : 'Off'} />
      </Row>
      <Row label="Caste & religion charts" hint="Hide these two charts when you are presenting on a shared screen. The data itself is not affected.">
        <Toggle checked={demo} onChange={(v) => { setDemo(v); writeFlag('bms_show_demo', v); }} label={demo ? 'Shown' : 'Hidden'} />
      </Row>
    </Panel>
  );
}

function DataTab({ onNavigate }) {
  const connected = useSocketStatus();
  const go = (k) => onNavigate?.(k);
  return (
    <Panel title="Data & Sync" description="Connection status and shortcuts for working with voter data.">
      <Row label="Real-time sync" hint="When connected, changes made by other staff in your ward appear without reloading.">
        <span className={`inline-flex items-center gap-2 text-sm font-semibold ${connected ? 'text-seal-green dark:text-emerald-400' : 'text-seal-red'}`}>
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </Row>
      <Row label="Voter list" hint="Bulk import from Excel is on the Voters page. Admins must pick a ward in the top bar first.">
        <ActionButton icon={Upload} onClick={() => go('register')}>Import or add voters</ActionButton>
      </Row>
      <Row label="Reports" hint="Download booth, scheme and demographic tables as an Excel file.">
        <ActionButton icon={FileBarChart} onClick={() => go('reports')}>Open reports</ActionButton>
      </Row>
      <Row label="API server">
        <code className="text-xs font-mono px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink dark:text-paper">
          {import.meta.env.VITE_API_URL || '/api'}
        </code>
      </Row>
    </Panel>
  );
}

function WardsTab() {
  const { wards, refreshWards } = useData();
  const [newWard, setNewWard] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleAddWard = async (e) => {
    e.preventDefault();
    const name = newWard.trim();
    if (!name) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await createWard({ name });
      await refreshWards();
      setNewWard('');
      setNotice(`Ward "${name}" added.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add the ward. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Wards" description="Each MLA account is tied to one ward. Voters, booths and schemes are kept separate per ward.">
      <Row label={`All wards (${wards.length})`}>
        {wards.length ? (
          <ul className="max-h-64 overflow-y-auto scrollbar-thin rounded-xl border border-black/10 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5">
            {wards.map((w) => (
              <li key={w.id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink dark:text-paper">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> <span className="truncate">{w.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No wards yet. Add the first one below.</p>
        )}
      </Row>
      <Row label="Add a ward" hint="Create the ward first, then add its booths and assign an MLA from the Access page.">
        <form onSubmit={handleAddWard} className="flex items-center gap-2 max-w-md">
          <input
            value={newWard} onChange={(e) => setNewWard(e.target.value)} placeholder="Ward name" aria-label="Ward name"
            className="flex-1 min-w-0 bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper focus:outline focus:outline-2 focus:outline-brass"
          />
          <button type="submit" disabled={busy || !newWard.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brass hover:bg-brass-light text-ink text-xs font-semibold disabled:opacity-50 shrink-0">
            <Plus className="w-4 h-4" /> Add ward
          </button>
        </form>
        {error && <p className="text-xs text-seal-red mt-2">{error}</p>}
        {notice && <p className="text-xs text-seal-green dark:text-emerald-400 mt-2">{notice}</p>}
      </Row>
    </Panel>
  );
}

// ---- page ----
export default function Settings({ onNavigate }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('account');
  const tabs = TABS.filter((t) => !t.adminOnly || user?.role === 'admin');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink dark:text-paper">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your account, display and data preferences</p>
      </div>

      <div className="grid md:grid-cols-[230px_minmax(0,1fr)] gap-6 items-start">
        <nav aria-label="Settings sections"
          className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-2 shadow-card">
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button key={key} type="button" onClick={() => setTab(key)} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active ? 'bg-brass/15 text-brass dark:text-brass-light font-semibold'
                         : 'text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-paper hover:bg-black/5 dark:hover:bg-white/10'}`}>
                <Icon className="w-[18px] h-[18px] shrink-0" /> {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 max-w-3xl">
          {tab === 'account' && <AccountTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'data' && <DataTab onNavigate={onNavigate} />}
          {tab === 'wards' && user?.role === 'admin' && <WardsTab />}
        </div>
      </div>
    </div>
  );
}