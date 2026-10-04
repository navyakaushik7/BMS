import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CalendarDays, AlertCircle, RefreshCw, Wifi, WifiOff, Upload, Landmark, Gift,
  FileBarChart, ChevronRight, CheckCircle2, AlertTriangle, Users, PhoneCall
} from 'lucide-react';
import { getAnalytics } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import StatCards from '../components/StatCards';
import AnalyticsCharts from '../components/charts/AnalyticsCharts';

// Preferences set on the Settings > Dashboard tab
const readFlag = (key, fallback = true) => {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
};

const fmt = (n) => (n ?? 0).toLocaleString('en-IN');
const pctOf = (v, t) => (t ? Math.round((v / t) * 1000) / 10 : 0);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const named = (rows, name) => (rows || []).find((r) => r.name === name)?.value || 0;

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl shadow-card p-5 min-w-0 ${className}`}>
      <h3 className="font-semibold text-ink dark:text-paper text-sm">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Skeleton() {
  const block = (h, key) => <div key={key} className={`${h} rounded-2xl bg-black/5 dark:bg-white/5`} />;
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => block('h-28', i))}</div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">{[0, 1, 2].map((i) => block('h-56', i))}</div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{Array.from({ length: 4 }).map((_, i) => block('h-72', i))}</div>
    </div>
  );
}

// ---- Scheme coverage ----
function CoveragePanel({ stats, schemes }) {
  const total = stats.totalVoters;
  const enrolled = stats.enrolledVoters;
  const unenrolled = Math.max(0, total - enrolled);
  const topSchemes = [...(schemes || [])].sort((a, b) => b.value - a.value).slice(0, 4);
  const max = topSchemes[0]?.value || 1;

  return (
    <Panel title="Scheme coverage" subtitle="Voters enrolled in at least one welfare scheme">
      <div className="flex items-end justify-between gap-4 mb-2">
        <div className="text-3xl font-bold text-ink dark:text-paper">{stats.coveragePct}%</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          <span className="text-ink dark:text-paper font-semibold">{fmt(enrolled)}</span> enrolled,{' '}
          <span className="text-ink dark:text-paper font-semibold">{fmt(unenrolled)}</span> not yet
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={stats.coveragePct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-seal-green transition-all" style={{ width: `${Math.min(100, stats.coveragePct)}%` }} />
      </div>

      <div className="mt-5 space-y-3">
        {topSchemes.length ? topSchemes.map((s) => (
          <div key={s.name}>
            <div className="flex items-center justify-between text-xs mb-1 gap-3">
              <span className="text-ink dark:text-paper truncate">{s.name}</span>
              <span className="text-slate-500 dark:text-slate-400 shrink-0">{fmt(s.value)} voters ({pctOf(s.value, total)}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-brass" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
          </div>
        )) : <p className="text-xs text-slate-500 dark:text-slate-400">No enrolments yet. Enrol voters from the Schemes page.</p>}
      </div>
    </Panel>
  );
}

// ---- Outreach progress ----
const OUTREACH_COLORS = {
  'Contacted': 'bg-sky-500',
  'Promised Support': 'bg-seal-green',
  'Needs Follow-up': 'bg-brass',
  'Not Interested': 'bg-seal-red',
  'Not Contacted': 'bg-black/15 dark:bg-white/15'
};
const OUTREACH_ORDER = ['Promised Support', 'Contacted', 'Needs Follow-up', 'Not Interested', 'Not Contacted'];

function OutreachPanel({ stats, distribution, onNavigate }) {
  const total = stats.totalVoters;
  const contacted = stats.contactedVoters || 0;
  const pct = pctOf(contacted, total);
  const byStatus = OUTREACH_ORDER
    .map((name) => ({ name, value: distribution?.find((d) => d.name === name)?.value || 0 }))
    .filter((d) => d.value > 0);

  return (
    <Panel title="Voter outreach" subtitle="Field contact progress for this pre-poll drive">
      <div className="flex items-end justify-between gap-4 mb-2">
        <div className="text-3xl font-bold text-ink dark:text-paper">{pct}%</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          <span className="text-ink dark:text-paper font-semibold">{fmt(contacted)}</span> reached of{' '}
          <span className="text-ink dark:text-paper font-semibold">{fmt(total)}</span>
        </div>
      </div>
      {total === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Add voters to start tracking outreach.</p>
      ) : (
        <>
          <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex">
            {byStatus.map((d) => (
              <div key={d.name} className={OUTREACH_COLORS[d.name]} style={{ width: `${(d.value / total) * 100}%` }} title={`${d.name}: ${fmt(d.value)}`} />
            ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {byStatus.map((d) => (
              <li key={d.name} className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${OUTREACH_COLORS[d.name]}`} />
                <span className="text-ink dark:text-paper flex-1 min-w-0 truncate">{d.name}</span>
                <span className="text-slate-500 dark:text-slate-400">{fmt(d.value)} ({pctOf(d.value, total)}%)</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onNavigate?.('register')}
            className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-brass dark:text-brass-light hover:underline">
            <PhoneCall className="w-3.5 h-3.5" /> Go to Voters to update status
          </button>
        </>
      )}
    </Panel>
  );
}

// ---- Quick actions ----
function QuickActions({ onNavigate }) {
  const items = [
    { key: 'register', icon: Upload, title: 'Add or import voters', sub: 'One by one, or in bulk from Excel' },
    { key: 'booths', icon: Landmark, title: 'Manage booths', sub: 'Add and edit polling booths' },
    { key: 'schemes', icon: Gift, title: 'Manage schemes', sub: 'Create schemes and enrol voters' },
    { key: 'reports', icon: FileBarChart, title: 'Download reports', sub: 'Export tables to Excel' }
  ];
  return (
    <Panel title="Quick actions" subtitle="Jump to common tasks">
      <div className="-mx-2 space-y-0.5">
        {items.map(({ key, icon: Icon, title, sub }) => (
          <button key={key} type="button" onClick={() => onNavigate?.(key)}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
            <span className="w-9 h-9 rounded-lg bg-brass/10 text-brass dark:text-brass-light flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink dark:text-paper">{title}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ---- Key insights ----
function Insights({ analytics }) {
  const { stats, boothStats = [], ageDistribution = [], genderDistribution = [] } = analytics;
  const total = stats.totalVoters;
  const boothTotal = boothStats.reduce((s, b) => s + b.voters, 0);
  const largest = boothStats[0];
  const seniors = named(ageDistribution, '60+');
  const young = named(ageDistribution, '18-25');
  const female = genderDistribution.find((g) => /^f/i.test(g.name))?.value || 0;
  const male = genderDistribution.find((g) => /^m/i.test(g.name))?.value || 0;

  const tiles = [
    {
      label: 'Largest booth',
      value: largest && largest.voters ? largest.name : 'No data yet',
      sub: largest && largest.voters ? `${fmt(largest.voters)} voters, ${pctOf(largest.voters, boothTotal)}% of the total` : 'Add booths and voters to see this',
      small: true
    },
    { label: 'Senior voters (60+)', value: `${pctOf(seniors, total)}%`, sub: `${fmt(seniors)} voters may need help reaching the booth` },
    { label: 'Young voters (18-25)', value: `${pctOf(young, total)}%`, sub: `${fmt(young)} voters in the youngest age group` },
    male && female
      ? { label: 'Gender ratio', value: fmt(Math.round((female / male) * 1000)), sub: 'women for every 1,000 men' }
      : { label: 'Gender ratio', value: 'Not available', sub: 'Needs both male and female records', small: true }
  ];

  return (
    <Panel title="Key insights" subtitle="What stands out in the current data" className="xl:col-span-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 -m-5 mt-0 rounded-b-2xl overflow-hidden border-t border-black/5 dark:border-white/5">
        {tiles.map((t, i) => (
          <div key={t.label}
            className={`p-5 border-black/5 dark:border-white/5 ${i % 2 === 0 ? 'sm:border-r' : ''} ${i < 2 ? 'border-b' : ''} ${i === 2 ? 'border-b sm:border-b-0' : ''}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.label}</p>
            <p className={`font-bold text-ink dark:text-paper mt-1 truncate ${t.small ? 'text-lg' : 'text-2xl'}`} title={t.value}>{t.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.sub}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---- Data health ----
function DataHealth({ analytics, onNavigate }) {
  const { stats, boothStats = [], casteDistribution = [], religionDistribution = [] } = analytics;
  const checks = [
    { label: 'Voters not yet contacted', count: Math.max(0, stats.totalVoters - (stats.contactedVoters || 0)), go: 'register' },
    { label: 'Booths with no voters', count: boothStats.filter((b) => b.voters === 0).length, go: 'booths' },
    { label: 'Voters missing caste', count: named(casteDistribution, 'Not specified'), go: 'register' },
    { label: 'Voters missing religion', count: named(religionDistribution, 'Not specified'), go: 'register' },
    { label: 'Voters in no scheme', count: Math.max(0, stats.totalVoters - stats.enrolledVoters), go: 'schemes' }
  ];
  const allGood = checks.every((c) => c.count === 0);

  return (
    <Panel title="Data health" subtitle={allGood ? 'Everything looks complete' : 'Gaps worth filling before polling day'}>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-3 py-2">
            {c.count === 0
              ? <CheckCircle2 className="w-4 h-4 text-seal-green dark:text-emerald-400 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-brass shrink-0" />}
            <span className="text-sm text-ink dark:text-paper flex-1 min-w-0 truncate">{c.label}</span>
            <span className="text-sm font-semibold text-ink dark:text-paper">{fmt(c.count)}</span>
            {c.count > 0 && (
              <button type="button" onClick={() => onNavigate?.(c.go)}
                className="text-xs font-semibold text-brass dark:text-brass-light hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass rounded">
                Fix
              </button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---- Page ----
export default function Overview({ onNavigate }) {
  const { user } = useAuth();
  const { wardId, wards, booths } = useData();
  const [boothId, setBoothId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [connected, setConnected] = useState(false);
  const [live] = useState(() => readFlag('bms_live'));
  const [showDemo] = useState(() => readFlag('bms_show_demo'));
  const timer = useRef(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = {};
      if (wardId) params.ward_id = wardId;
      if (boothId) params.booth_id = boothId;
      const { data } = await getAnalytics(params);
      setAnalytics(data);
      setUpdatedAt(new Date());
    } catch { setError('Could not load the overview. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, [wardId, boothId]);

  useEffect(() => { setBoothId(''); }, [wardId]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  // Live updates: debounce bursts of socket events into a single refetch
  useEffect(() => {
    const socket = getSocket();
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    setConnected(socket.connected);
    socket.on('connect', up);
    socket.on('disconnect', down);

    const handler = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 800); };
    const events = ['voter:created', 'voter:updated', 'voter:deleted', 'voters:bulk-imported'];
    if (live) events.forEach((e) => socket.on(e, handler));

    return () => {
      socket.off('connect', up);
      socket.off('disconnect', down);
      events.forEach((e) => socket.off(e, handler));
      clearTimeout(timer.current);
    };
  }, [load, live]);

  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const isAdmin = user?.role === 'admin';
  const scopeName = isAdmin
    ? (wardId ? wards.find((w) => w.id === wardId)?.name || 'Selected ward' : 'All wards')
    : user?.wardName;
  const boothName = boothId ? booths.find((b) => String(b.id) === String(boothId))?.name : '';
  const firstName = (user?.name || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let liveChip;
  if (!live) liveChip = { text: 'Live updates off', cls: 'text-slate-500 dark:text-slate-400', icon: WifiOff, title: 'Turn on in Settings > Dashboard' };
  else if (connected) liveChip = { text: 'Live', cls: 'text-seal-green dark:text-emerald-400', icon: Wifi, title: 'Updates automatically when voter data changes' };
  else liveChip = { text: 'Reconnecting', cls: 'text-brass', icon: WifiOff, title: 'Trying to reconnect to the server' };
  const LiveIcon = liveChip.icon;

  const chip = 'text-xs px-3 py-1.5 rounded-full bg-white dark:bg-ink-light border border-black/10 dark:border-white/10';
  const chipRow = `flex items-center gap-1.5 ${chip}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-paper">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pre-poll voter analysis for <span className="text-ink dark:text-paper font-medium">{scopeName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={boothId} onChange={(e) => setBoothId(e.target.value)} aria-label="Booth filter"
            className={`${chip} text-ink dark:text-paper max-w-[200px]`}>
            <option value="">All booths</option>
            {booths.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className={`${chipRow} text-slate-500 dark:text-slate-400`}><CalendarDays className="w-3.5 h-3.5" /> {today}</span>
          <span className={`${chipRow} ${liveChip.cls}`} title={liveChip.title}><LiveIcon className="w-3.5 h-3.5" /> {liveChip.text}</span>
          <button type="button" onClick={handleRefresh} disabled={refreshing}
            title={updatedAt ? `Last updated ${updatedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Refresh'}
            className={`${chipRow} text-ink dark:text-paper hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60`}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-seal-red/30 bg-seal-red/10 text-seal-red px-5 py-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={load} className="ml-auto flex items-center gap-1 font-semibold shrink-0"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
        </div>
      ) : loading && !analytics ? <Skeleton /> : analytics && (
        <div className="space-y-6">
          {analytics.stats.totalVoters === 0 && (
            <div className="flex items-center gap-4 rounded-2xl border border-brass/30 bg-brass/10 px-5 py-4 flex-wrap">
              <Users className="w-5 h-5 text-brass shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold text-ink dark:text-paper">
                  {boothName ? `No voters in ${boothName} yet` : 'No voters added yet'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Import your voter list from Excel to see analysis here.</p>
              </div>
              <button type="button" onClick={() => onNavigate?.('register')}
                className="px-4 py-2 rounded-lg bg-brass hover:bg-brass-light text-ink text-xs font-semibold">Add or import voters</button>
            </div>
          )}

          <StatCards stats={analytics.stats} topBooth={analytics.boothStats?.[0]} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <CoveragePanel stats={analytics.stats} schemes={analytics.schemeDistribution} />
            <OutreachPanel stats={analytics.stats} distribution={analytics.contactStatusDistribution} onNavigate={onNavigate} />
            <QuickActions onNavigate={onNavigate} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Insights analytics={analytics} />
            <DataHealth analytics={analytics} onNavigate={onNavigate} />
          </div>

          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-ink dark:text-paper">Breakdowns</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {boothName ? `Voter charts for ${boothName}` : `Voter charts for ${scopeName}`}
              </p>
            </div>
            <AnalyticsCharts analytics={analytics} showDemographics={showDemo} />
          </div>
        </div>
      )}
    </div>
  );
}
