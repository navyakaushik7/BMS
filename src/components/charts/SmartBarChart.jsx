import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { X, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const full = new Intl.NumberFormat('en-IN');
const trim = (n) => String(Math.round(n * 10) / 10);
/** 950 -> 950 · 12,400 -> 12.4K · 1,50,000 -> 1.5L · 2,00,00,000 -> 2Cr */
export const compact = (n = 0) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${trim(n / 1e7)}Cr`;
  if (a >= 1e5) return `${trim(n / 1e5)}L`;
  if (a >= 1e3) return `${trim(n / 1e3)}K`;
  return String(n);
};

const ROW_H = 30;
const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

function Tip({ active, payload, total, theme }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: theme === 'dark' ? '#16283F' : '#fff', borderColor: theme === 'dark' ? '#1E3350' : '#E5E0D0', color: theme === 'dark' ? '#F6F3EA' : '#0F1B2E' }}>
      <p className="font-semibold mb-0.5">{p.name}</p>
      <p>{full.format(p.value)} · {total ? ((p.value / total) * 100).toFixed(1) : 0}%</p>
    </div>
  );
}

/**
 * Bar chart that stays readable at any data size:
 *  - Top-N bars sorted desc; the long tail is summarised under the chart (never drawn as one giant bar)
 *  - horizontal bars so long names never overlap; labels truncated (full name in tooltip)
 *  - height grows with the number of bars; compact numbers on the axis
 *  - "View all" opens a searchable, scrollable list of every row
 * `orientation="columns"` is for a small fixed set of short labels (e.g. age groups).
 */
export default function SmartBarChart({ data = [], color = '#46586B', topN = 10, sort = true, orientation = 'rows', emptyLabel = 'No data yet', onViewAll }) {
  const { theme } = useTheme();
  const [openAll, setOpenAll] = useState(false);
  const [q, setQ] = useState('');
  const axis = theme === 'dark' ? '#8a97a8' : '#46586B';
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const clean = useMemo(() => {
    const rows = (data || []).filter((d) => d && d.value >= 0);
    if (!sort) return rows;
    // a server-side "Others" roll-up always belongs to the tail, whatever its size
    const sorted = rows.filter((d) => d.name !== 'Others').sort((a, b) => b.value - a.value);
    return [...sorted, ...rows.filter((d) => d.name === 'Others')];
  }, [data, sort]);
  const total = useMemo(() => clean.reduce((s, d) => s + d.value, 0), [clean]);

  // Top-N bars only: a rolled-up "Others" bar would dwarf them and distort the scale,
  // so the tail is summarised in a footer line instead (and fully listed in "View all").
  const shown = useMemo(() => (sort && clean.length > topN ? clean.slice(0, topN) : clean), [clean, topN, sort]);
  const restSum = useMemo(() => total - shown.reduce((s, d) => s + d.value, 0), [total, shown]);

  if (!clean.length || total === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">{emptyLabel}</div>;
  }

  const hidden = clean.length - shown.length;
  const CH = 7; // px per character (11px font, with margin)
  const labelW = Math.min(190, Math.max(80, Math.max(...shown.map((d) => String(d.name).length)) * CH + 8));
  const cell = (d, i) => <Cell key={i} fill={color} />;
  const numTick = { fill: axis, fontSize: 11 };

  const chart = orientation === 'columns' ? (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={shown} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="name" tick={numTick} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={numTick} tickLine={false} axisLine={false} tickFormatter={compact} allowDecimals={false} />
        <Tooltip cursor={{ fill: grid }} content={<Tip total={total} theme={theme} />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>{shown.map(cell)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height={Math.max(180, shown.length * ROW_H + 30)}>
      <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tick={numTick} tickLine={false} axisLine={false} tickFormatter={compact} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={labelW} tickLine={false} axisLine={false} interval={0}
          tick={({ x, y, payload }) => (
            <text x={x - 6} y={y} dy={4} textAnchor="end" fill={axis} fontSize={11}>
              <title>{payload.value}</title>{truncate(payload.value, Math.floor((labelW - 8) / CH))}
            </text>
          )} />
        <Tooltip cursor={{ fill: grid }} content={<Tip total={total} theme={theme} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>{shown.map(cell)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const list = clean.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {chart}
      {sort && hidden > 0 && (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>+{hidden} more · {compact(restSum)} ({total ? ((restSum / total) * 100).toFixed(1) : 0}%)</span>
          <button onClick={() => (onViewAll ? onViewAll() : setOpenAll(true))} className="font-medium text-brass dark:text-brass-light hover:underline">View all {clean.length}</button>
        </div>
      )}
      {openAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpenAll(false)}>
          <div className="bg-white dark:bg-ink-light w-full max-w-lg max-h-[85vh] rounded-2xl flex flex-col overflow-hidden border border-black/10 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-black/10 dark:border-white/10">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-paper dark:bg-ink border border-black/10 dark:border-white/10 text-ink dark:text-paper" />
              </div>
              <button onClick={() => setOpenAll(false)} aria-label="Close" className="text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-2.5 scrollbar-thin">
              {list.map((d) => (
                <div key={d.name} className="text-sm">
                  <div className="flex justify-between gap-3 mb-1">
                    <span className="text-ink dark:text-paper truncate" title={d.name}>{d.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-xs shrink-0">{full.format(d.value)} · {((d.value / total) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${(d.value / clean[0].value) * 100}%`, background: color }} />
                  </div>
                </div>
              ))}
              {!list.length && <p className="text-sm text-slate-500 text-center py-6">No match</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
