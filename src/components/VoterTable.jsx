import { Pencil, Trash2, Users } from 'lucide-react';

const STATUS_STYLES = {
  'Not Contacted': 'bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-400',
  'Contacted': 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'Promised Support': 'bg-seal-green/15 text-seal-green dark:text-emerald-400',
  'Needs Follow-up': 'bg-brass/15 text-brass dark:text-brass-light',
  'Not Interested': 'bg-seal-red/15 text-seal-red'
};
const STATUSES = Object.keys(STATUS_STYLES);

export default function VoterTable({ voters, onEdit, onDelete, onShowFamily, onStatusChange, loading }) {
  if (loading) {
    return <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm">Loading voters…</div>;
  }

  if (voters.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
        <p className="text-slate-500 dark:text-slate-400 text-sm">No voters match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Voter ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Age / Gender</th>
              <th className="px-4 py-3 font-medium">Religion / Caste</th>
              <th className="px-4 py-3 font-medium">Booth</th>
              <th className="px-4 py-3 font-medium">Scheme</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Outreach</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {voters.map((v) => {
              const status = v.contact_status || 'Not Contacted';
              return (
                <tr key={v.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{v.voter_card_id}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink dark:text-paper font-medium">{v.name}</div>
                    {v.relation_name && <div className="text-xs text-slate-500 dark:text-slate-400">{v.relation_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{v.age} / {v.gender}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {v.religion || 'N/A'}{v.caste ? ` · ${v.caste}` : ''}{v.sub_caste ? ` (${v.sub_caste})` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{v.booth_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {Array.isArray(v.schemes) && v.schemes.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {v.schemes.map((s) => (
                          <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brass/15 text-brass dark:text-brass-light whitespace-nowrap">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{v.phone || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={status}
                      onChange={(e) => onStatusChange?.(v, e.target.value)}
                      title={v.notes || undefined}
                      className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer ${STATUS_STYLES[status] || STATUS_STYLES['Not Contacted']}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {v.family_id && (
                        <button onClick={() => onShowFamily(v)} title="Show household / family members"
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brass dark:hover:text-brass-light hover:bg-brass-light/10">
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => onEdit(v)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brass dark:hover:text-brass-light hover:bg-brass-light/10">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(v)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
