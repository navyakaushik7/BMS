import { useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { getVoterReligions } from '../lib/api';

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-60', '60+'];
const CONTACT_STATUSES = ['Not Contacted', 'Contacted', 'Promised Support', 'Needs Follow-up', 'Not Interested'];

export default function FilterPanel({ filters, onChange, booths, schemes, wardId }) {
  const [religions, setReligions] = useState([]);
  const set = (patch) => onChange({ ...filters, ...patch });

  useEffect(() => {
    getVoterReligions(wardId ? { ward_id: wardId } : {}).then(({ data }) => setReligions(data)).catch(() => {});
  }, [wardId]);

  const hasAnyFilter = filters.search || filters.ageGroup || filters.booth_id || filters.scheme_id || filters.religion || filters.caste || filters.contact_status;

  return (
    <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, voter ID or phone..."
          value={filters.search || ''}
          onChange={(e) => set({ search: e.target.value })}
          className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-brass/50"
        />
      </div>

      <select
        value={filters.ageGroup || ''}
        onChange={(e) => set({ ageGroup: e.target.value || undefined })}
        className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper"
      >
        <option value="">All ages</option>
        {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      <select
        value={filters.booth_id || ''}
        onChange={(e) => set({ booth_id: e.target.value || undefined })}
        className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper"
      >
        <option value="">All booths</option>
        {booths.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <select
        value={filters.scheme_id || ''}
        onChange={(e) => set({ scheme_id: e.target.value || undefined })}
        className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper"
      >
        <option value="">All schemes</option>
        {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select
        value={filters.religion || ''}
        onChange={(e) => set({ religion: e.target.value || undefined })}
        className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper"
      >
        <option value="">All religions</option>
        {religions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      <input
        type="text"
        placeholder="Caste / sub-caste..."
        value={filters.caste || ''}
        onChange={(e) => set({ caste: e.target.value || undefined })}
        className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper w-40"
      />

      <select
        value={filters.contact_status || ''}
        onChange={(e) => set({ contact_status: e.target.value || undefined })}
        className="bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper"
      >
        <option value="">All outreach status</option>
        {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {hasAnyFilter && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-ink/80 dark:hover:text-paper/80 px-2"
        >
          <Filter className="w-3.5 h-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
}
