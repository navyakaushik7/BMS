import { useState, useEffect, useCallback } from 'react';
import { UserPlus, ShieldOff, ShieldCheck, Pencil, Trash2, X } from 'lucide-react';
import { getStaff, createStaff, updateStaff, deleteStaff, deactivateStaff, reactivateStaff } from '../lib/api';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const input = 'w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper';
const blank = { name: '', phone: '', role: 'mla', ward_id: '' };

function Fields({ f, set, wards }) {
  return (
    <>
      <div><label className="block text-xs text-slate-500 mb-1">Name</label><input required value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} className={input} /></div>
      <div><label className="block text-xs text-slate-500 mb-1">Phone</label><input required placeholder="+919999900003" value={f.phone} onChange={(e) => set({ ...f, phone: e.target.value })} className={input} /></div>
      <div><label className="block text-xs text-slate-500 mb-1">Role</label>
        <select value={f.role} onChange={(e) => set({ ...f, role: e.target.value })} className={input}><option value="mla">MLA</option><option value="admin">Admin</option></select></div>
      {f.role === 'mla' && (
        <div><label className="block text-xs text-slate-500 mb-1">Ward</label>
          <select required value={f.ward_id || ''} onChange={(e) => set({ ...f, ward_id: e.target.value })} className={input}>
            <option value="">Select</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select></div>
      )}
    </>
  );
}

export default function Staff() {
  const { wards } = useData();
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStaff((await getStaff()).data); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, fallback = 'Failed') => {
    setError(''); setBusy(true);
    try { await fn(); await load(); return true; }
    catch (err) { setError(err.response?.data?.error || fallback); return false; }
    finally { setBusy(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => createStaff({ name: form.name.trim(), phone: form.phone.trim(), role: form.role, ward_id: form.role === 'mla' ? parseInt(form.ward_id, 10) || undefined : undefined }))) setForm(blank);
  };
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => updateStaff(edit.id, { name: edit.name.trim(), phone: edit.phone.trim(), role: edit.role, ward_id: edit.role === 'mla' ? parseInt(edit.ward_id, 10) || null : null }))) setEdit(null);
  };
  const revoke = (m) => window.confirm(`Revoke access for ${m.name}? They are logged out immediately.`) && run(() => deactivateStaff(m.id));
  const restore = (m) => run(() => reactivateStaff(m.id));
  const remove = (m) => window.confirm(`Delete ${m.name} permanently?`) && run(() => deleteStaff(m.id));

  const shown = staff.filter((s) => filter === 'all' || (filter === 'active' ? s.is_active : !s.is_active));
  const revokedCount = staff.filter((s) => !s.is_active).length;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-xl font-bold text-ink dark:text-paper">Access</h1>
        <div className="flex rounded-lg overflow-hidden border border-black/10 dark:border-white/10 text-xs">
          {[['all', `All (${staff.length})`], ['active', 'Active'], ['revoked', `Revoked (${revokedCount})`]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 ${filter === k ? 'bg-brass/15 text-brass font-semibold' : 'text-slate-500 bg-white dark:bg-ink-light'}`}>{l}</button>
          ))}
        </div>
      </div>

      <form onSubmit={add} className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <Fields f={form} set={setForm} wards={wards} />
        <button disabled={busy} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-brass hover:bg-brass-light text-ink text-xs font-semibold disabled:opacity-60 h-[38px]"><UserPlus className="w-4 h-4" /> Add</button>
      </form>
      {error && <p role="alert" className="text-xs text-seal-red mb-3">{error}</p>}

      <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-black/10 dark:border-white/10">
            {['Name', 'Phone', 'Role', 'Ward', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-8 text-xs text-slate-500">Loading…</td></tr>
              : !shown.length ? <tr><td colSpan={6} className="text-center py-8 text-xs text-slate-500">None</td></tr>
              : shown.map((s) => {
                const me = s.id === user?.id;
                return (
                  <tr key={s.id} className={`border-b border-black/5 dark:border-white/5 ${s.is_active ? '' : 'opacity-70'}`}>
                    <td className="px-4 py-3 text-ink dark:text-paper">{s.name}{me && <span className="ml-2 text-[10px] text-slate-500">(you)</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.phone}</td>
                    <td className="px-4 py-3 text-slate-500 uppercase text-xs">{s.role}</td>
                    <td className="px-4 py-3 text-slate-500">{s.ward_name || '-'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-seal-red/10 text-seal-red'}`}>{s.is_active ? 'Active' : 'Revoked'}</span></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEdit({ ...s })} title="Edit" className="p-1.5 rounded-lg text-slate-500 hover:text-brass hover:bg-brass/10"><Pencil className="w-4 h-4" /></button>
                      {s.is_active
                        ? <button onClick={() => revoke(s)} disabled={me} title={me ? 'Cannot revoke yourself' : 'Revoke'} className="p-1.5 rounded-lg text-slate-500 hover:text-seal-red hover:bg-seal-red/10 disabled:opacity-30"><ShieldOff className="w-4 h-4" /></button>
                        : <button onClick={() => restore(s)} title="Restore" className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10"><ShieldCheck className="w-4 h-4" /></button>}
                      <button onClick={() => remove(s)} disabled={me} title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:text-seal-red hover:bg-seal-red/10 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={save} className="bg-white dark:bg-ink-light w-full max-w-sm rounded-2xl p-6 space-y-4 border border-black/10 dark:border-white/10">
            <div className="flex justify-between items-center"><h3 className="font-bold text-ink dark:text-paper">Edit</h3><button type="button" onClick={() => { setEdit(null); setError(''); }}><X className="w-5 h-5 text-slate-500" /></button></div>
            <Fields f={edit} set={setEdit} wards={wards} />
            {error && <p className="text-xs text-seal-red">{error}</p>}
            <button disabled={busy} className="w-full py-2.5 rounded-lg bg-brass hover:bg-brass-light text-ink text-sm font-semibold disabled:opacity-60">Save</button>
          </form>
        </div>
      )}
    </div>
  );
}
