import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SmartBarChart, { compact } from './SmartBarChart';

const COLORS = ['#5A6ACF', '#C08829', '#2F7A4D', '#B23A34', '#6B4F8A'];
const pct = (v, t) => (t ? `${((v / t) * 100).toFixed(1)}%` : '0%');

function Card({ title, insight, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 p-5 rounded-2xl shadow-card min-w-0 ${className}`}>
      <h3 className="font-semibold text-ink dark:text-paper text-sm">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3 min-h-[16px] truncate" title={insight}>{insight}</p>
      {children}
    </div>
  );
}

const top = (rows) => (rows?.length ? [...rows].sort((a, b) => b.value - a.value)[0] : null);
const sum = (rows) => (rows || []).reduce((s, r) => s + r.value, 0);

export default function AnalyticsCharts({ analytics, showDemographics = true }) {
  if (!analytics) return null;
  const { boothStats = [], schemeDistribution = [], ageDistribution = [], genderDistribution = [], religionDistribution = [], casteDistribution = [], stats } = analytics;

  const booths = boothStats.map((b) => ({ name: b.name, value: b.voters }));
  const gT = sum(genderDistribution), aT = sum(ageDistribution), rT = sum(religionDistribution), cT = sum(casteDistribution), bT = sum(booths);
  const tA = top(ageDistribution), tR = top(religionDistribution), tC = top(casteDistribution), tB = top(booths), tS = top(schemeDistribution);
  const unenrolled = Math.max(0, (stats?.totalVoters || 0) - (stats?.enrolledVoters || 0));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
      <Card title="Voters per Booth" insight={tB ? `Top: ${tB.name} (${compact(tB.value)}, ${pct(tB.value, bT)})` : ''}>
        <SmartBarChart data={booths} color="#46586B" topN={10} emptyLabel="No booths yet" />
      </Card>

      <Card title="Scheme Enrolment" insight={tS ? `Top: ${tS.name} · ${compact(unenrolled)} voters have no scheme` : ''}>
        <SmartBarChart data={schemeDistribution} color="#C08829" topN={10} emptyLabel="No enrolments yet" />
      </Card>

      {showDemographics && (
        <>
          <Card title="Caste" insight={tC ? `Largest: ${tC.name} (${pct(tC.value, cT)})` : ''}>
            <SmartBarChart data={casteDistribution} color="#8A5A44" topN={10} emptyLabel="No voters yet" />
          </Card>

          <Card title="Religion" insight={tR ? `Largest: ${tR.name} (${pct(tR.value, rT)})` : ''}>
            <SmartBarChart data={religionDistribution} color="#B23A34" topN={8} emptyLabel="No voters yet" />
          </Card>
        </>
      )}

      <Card title="Age Groups" insight={tA && aT ? `Largest: ${tA.name} (${pct(tA.value, aT)})` : ''}>
        <SmartBarChart data={ageDistribution} color="#2F7A4D" sort={false} orientation="columns" emptyLabel="No voters yet" />
      </Card>

      <Card title="Gender" insight={gT ? `${genderDistribution.length} categories` : ''}>
        {gT === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-slate-400">No voters yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={genderDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {genderDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v.toLocaleString('en-IN')} (${pct(v, gT)})`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}