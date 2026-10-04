import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { getAnalytics, getSchemeCaste } from '../lib/api';
import { exportReportToExcel } from '../utils/excelUtils';
import { useData } from '../context/DataContext';

function ReportTable({ title, rows, columns }) {
  return (
    <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-5">
      <h3 className="font-semibold text-ink dark:text-paper mb-4 text-sm">{title}</h3>
      {rows?.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-black/10 dark:border-white/10">
              {columns.map((c) => <th key={c.key} className={`py-2 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-black/5 dark:border-white/5">
                {columns.map((c) => (
                  <td key={c.key} className={`py-2 ${c.align === 'right' ? 'text-right text-brass dark:text-brass-light' : 'text-ink dark:text-paper'}`}>
                    {r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">No data yet.</p>
      )}
    </div>
  );
}

export default function Reports() {
  const { wardId } = useData();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAnalytics(wardId ? { ward_id: wardId } : {});
      setAnalytics(data);
    } finally {
      setLoading(false);
    }
  }, [wardId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleExport = async () => {
    if (!analytics) return;
    const { data: schemeCaste } = await getSchemeCaste(wardId ? { ward_id: wardId } : {});
    exportReportToExcel(
      {
        boothStats: analytics.boothStats,
        schemeStats: analytics.schemeDistribution,
        ageStats: analytics.ageDistribution,
        religionStats: analytics.religionDistribution,
        casteStats: analytics.casteDistribution,
        schemeCaste
      },
      `voter-analytics-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink dark:text-paper">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Booth, scheme, and demographic breakdowns</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!analytics}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-ink dark:text-paper text-xs font-semibold disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export Report (.xlsx)
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">Loading report…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReportTable
            title="Booth-wise Voter Count"
            rows={analytics?.boothStats}
            columns={[{ key: 'name', label: 'Booth' }, { key: 'voters', label: 'Voters', align: 'right' }]}
          />
          <ReportTable
            title="Scheme Coverage"
            rows={analytics?.schemeDistribution}
            columns={[{ key: 'name', label: 'Scheme' }, { key: 'value', label: 'Enrolled', align: 'right' }]}
          />
          <ReportTable
            title="Age Group Distribution"
            rows={analytics?.ageDistribution}
            columns={[{ key: 'name', label: 'Age Group' }, { key: 'value', label: 'Voters', align: 'right' }]}
          />
          <ReportTable
            title="Religion Split"
            rows={analytics?.religionDistribution}
            columns={[{ key: 'name', label: 'Religion' }, { key: 'value', label: 'Voters', align: 'right' }]}
          />
          <div className="lg:col-span-2">
            <ReportTable
              title="Caste Breakdown"
              rows={analytics?.casteDistribution}
              columns={[{ key: 'name', label: 'Caste' }, { key: 'value', label: 'Voters', align: 'right' }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
