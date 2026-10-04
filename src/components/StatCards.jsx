import { Users, Landmark, Gift, Home, Percent, BarChart3 } from 'lucide-react';
import { compact } from './charts/SmartBarChart';

export default function StatCards({ stats, topBooth }) {
  if (!stats) return null;
  const items = [
    { title: 'Voters', value: compact(stats.totalVoters), sub: `${stats.totalCastes} castes · ${stats.totalReligions} religions`, icon: Users, tint: 'bg-blue-500/15 text-blue-500', accent: '#5A6ACF' },
    { title: 'Booths', value: stats.totalBooths, sub: topBooth ? `Largest: ${topBooth.name}` : 'No booths', icon: Landmark, tint: 'bg-cyan-500/15 text-cyan-500', accent: '#2E8B8B' },
    { title: 'Avg / Booth', value: compact(stats.avgPerBooth), sub: 'voters per booth', icon: BarChart3, tint: 'bg-amber-500/15 text-amber-500', accent: '#C08829' },
    { title: 'Coverage', value: `${stats.coveragePct}%`, sub: `${compact(stats.enrolledVoters)} in a scheme`, icon: Percent, tint: 'bg-emerald-500/15 text-emerald-500', accent: '#2F7A4D' },
    { title: 'Schemes', value: stats.totalSchemes, sub: 'active schemes', icon: Gift, tint: 'bg-purple-500/15 text-purple-500', accent: '#6B4F8A' },
    { title: 'Households', value: compact(stats.households), sub: 'distinct families', icon: Home, tint: 'bg-rose-500/15 text-rose-500', accent: '#B23A34' }
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.title} className="p-4 rounded-2xl bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 shadow-card min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wide">{it.title}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${it.tint}`}><Icon className="w-4 h-4" /></div>
            </div>
            <div className="w-6 h-[3px] rounded-full mb-2" style={{ backgroundColor: it.accent }} />
            <div className="text-2xl font-bold text-ink dark:text-paper">{it.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={it.sub}>{it.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
