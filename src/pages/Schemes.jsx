import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, Gift, X, Users, Pencil, Download, Upload, FileSpreadsheet, UserPlus, UserMinus, Loader2, Search } from 'lucide-react';
import { createScheme, deleteScheme, updateScheme, getSchemeVoters, unenrollSchemeVoter, enrollSchemeVoters, getVoters, updateVoter, bulkImportVoters } from '../lib/api';
import { exportSchemeViewToExcel, parseVoterExcelFile, downloadVoterTemplate } from '../utils/excelUtils';
import { getSocket } from '../lib/socket';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import SmartBarChart from '../components/charts/SmartBarChart';
import VoterModal from '../components/VoterModal';

const input = 'w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper';
const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-ink dark:text-paper text-xs font-semibold disabled:opacity-60';
const PAGE = 50;

export default function Schemes() {
  const { schemes, booths, wardId, refreshSchemes, refreshBooths } = useData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [selectedId, setSelectedId] = useState(null);
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ caste: '', religion: '', booth: '', q: '' });
  const [limit, setLimit] = useState(PAGE);
  const [form, setForm] = useState({ name: '', category: '' });
  const [editScheme, setEditScheme] = useState(null);
  const [editVoter, setEditVoter] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const scheme = schemes.find((s) => s.id === selectedId) || null;
  const flash = (text, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg(null), 5000); };

  // keep a valid selection
  useEffect(() => {
    if (!schemes.length) return setSelectedId(null);
    if (!schemes.some((s) => s.id === selectedId)) setSelectedId(schemes[0].id);
  }, [schemes, selectedId]);

  const loadVoters = useCallback(async () => {
    if (!selectedId) return setVoters([]);
    setLoading(true);
    try {
      const { data } = await getSchemeVoters(selectedId, wardId ? { ward_id: wardId } : {});
      setVoters(data);
    } finally { setLoading(false); }
  }, [selectedId, wardId]);

  useEffect(() => { setFilters({ caste: '', religion: '', booth: '', q: '' }); setLimit(PAGE); loadVoters(); }, [loadVoters]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('voter:updated', loadVoters);
    return () => socket.off('voter:updated', loadVoters);
  }, [loadVoters]);

  const grouped = useMemo(() => schemes.reduce((acc, s) => { (acc[s.category] = acc[s.category] || []).push(s); return acc; }, {}), [schemes]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return voters.filter((v) =>
      (!filters.caste || (v.caste || 'Not specified') === filters.caste) &&
      (!filters.religion || (v.religion || 'Not specified') === filters.religion) &&
      (!filters.booth || String(v.booth_id) === filters.booth) &&
      (!q || v.name.toLowerCase().includes(q) || v.voter_card_id.toLowerCase().includes(q)));
  }, [voters, filters]);

  const tally = (rows, key) => {
    const m = new Map();
    rows.forEach((v) => { const k = v[key] || 'Not specified'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  // caste chart follows the other filters (but not the caste filter itself) so it always shows the category split
  const casteData = useMemo(() => tally(voters.filter((v) =>
    (!filters.religion || (v.religion || 'Not specified') === filters.religion) &&
    (!filters.booth || String(v.booth_id) === filters.booth)), 'caste'), [voters, filters.religion, filters.booth]);
  const religions = useMemo(() => tally(voters, 'religion').map((r) => r.name), [voters]);
  const castes = useMemo(() => tally(voters, 'caste').map((r) => r.name), [voters]);

  const setF = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setLimit(PAGE); };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim()) return;
    setBusy(true);
    try { await createScheme({ name: form.name.trim(), category: form.category.trim(), ward_id: wardId }); setForm({ name: '', category: '' }); await refreshSchemes(); }
    catch { flash('Failed', true); } finally { setBusy(false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? Voters will be unenrolled from it.`)) return;
    await deleteScheme(s.id); await refreshSchemes();
  };

  const saveScheme = async (e) => {
    e.preventDefault();
    try { await updateScheme(editScheme.id, { name: editScheme.name, category: editScheme.category }); setEditScheme(null); await refreshSchemes(); flash('Saved'); }
    catch { flash('Failed', true); }
  };

  const remove = async (v) => {
    if (!window.confirm(`Remove ${v.name} from ${scheme.name}?`)) return;
    await unenrollSchemeVoter(scheme.id, v.id);
    setVoters((list) => list.filter((x) => x.id !== v.id));
    refreshSchemes();
  };

  const saveVoter = async (data) => {
    await updateVoter(editVoter.id, data);
    setEditVoter(null); await loadVoters(); await refreshSchemes(); flash('Saved');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !scheme) return;
    if (isAdmin && !wardId) return flash('Select a ward first', true);
    setBusy(true);
    try {
      // every row joins this scheme; rows already listing other schemes keep them
      const rows = (await parseVoterExcelFile(file)).map((r) => ({
        ...r, scheme_name: [r.scheme_name, scheme.name].filter(Boolean).join(', ')
      }));
      const { data } = await bulkImportVoters(rows, wardId || undefined);
      await Promise.all([loadVoters(), refreshSchemes(), refreshBooths()]);
      flash(`${data.importedCount} added, ${data.updatedCount || 0} updated${data.skippedCount ? `, ${data.skippedCount} skipped` : ''}`);
    } catch (err) { flash(err.response?.data?.error || 'Import failed', true); }
    finally { setBusy(false); }
  };

  const row = (v) => (
    <tr key={v.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <td className="px-3 py-2.5"><p className="text-ink dark:text-paper font-medium">{v.name}</p><p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{v.voter_card_id}</p></td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{v.age} · {v.gender?.[0]}</td>
      <td className="px-3 py-2.5 text-ink dark:text-paper">{v.caste || '-'}</td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{v.religion || '-'}</td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 max-w-[160px] truncate">{booths.find((b) => b.id === v.booth_id)?.name || '-'}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <button onClick={() => setEditVoter(v)} title="Edit voter" className="p-1.5 rounded-lg text-slate-500 hover:text-brass hover:bg-brass/10"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => remove(v)} title="Remove from scheme" className="p-1.5 rounded-lg text-slate-500 hover:text-seal-red hover:bg-seal-red/10"><UserMinus className="w-4 h-4" /></button>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <h1 className="text-xl font-bold text-ink dark:text-paper">Schemes</h1>
        {msg && <span className={`text-xs px-3 py-1.5 rounded-lg ${msg.error ? 'bg-seal-red/10 text-seal-red' : 'bg-emerald-500/10 text-emerald-500'}`}>{msg.text}</span>}
      </div>

      {isAdmin && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]"><label className="block text-xs text-slate-500 mb-1">Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Welfare" className={input} /></div>
          <div className="flex-1 min-w-[160px]"><label className="block text-xs text-slate-500 mb-1">Scheme</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Old Age Pension" className={input} /></div>
          <button type="submit" disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brass hover:bg-brass-light text-ink text-xs font-semibold disabled:opacity-60"><Plus className="w-4 h-4" /> Add</button>
        </form>
      )}

      {!schemes.length ? (
        <div className="text-center py-16 border border-dashed border-black/10 dark:border-white/10 rounded-2xl text-slate-500 text-sm">No schemes</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
          {/* Scheme list */}
          <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-3 lg:sticky lg:top-0 max-h-[70vh] overflow-y-auto scrollbar-thin">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-3 last:mb-0">
                <p className="px-2 py-1 text-[11px] uppercase tracking-wide font-semibold text-slate-500">{cat}</p>
                {items.map((s) => (
                  <div key={s.id} onClick={() => setSelectedId(s.id)} role="button"
                    className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${s.id === selectedId ? 'bg-brass/15 text-brass dark:text-brass-light font-semibold' : 'text-ink dark:text-paper hover:bg-black/5 dark:hover:bg-white/10'}`}>
                    <span className="truncate">{s.name}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{s.enrolled_count}</span>
                      <button title="Edit" onClick={(e) => { e.stopPropagation(); setEditScheme({ ...s }); }} className="p-1 rounded text-slate-400 hover:text-brass lg:opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5" /></button>
                      {isAdmin && <button title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(s); }} className="p-1 rounded text-slate-400 hover:text-seal-red lg:opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Scheme-wise detail */}
          {scheme && (
            <div className="min-w-0 space-y-5">
              <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brass/15 flex items-center justify-center"><Gift className="w-5 h-5 text-brass" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-ink dark:text-paper leading-tight">{scheme.name}</h2>
                      <p className="text-xs text-slate-500">{scheme.category} · {voters.length.toLocaleString('en-IN')} enrolled{filtered.length !== voters.length && ` · ${filtered.length.toLocaleString('en-IN')} shown`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                    <button onClick={() => setAddOpen(true)} className={btn}><UserPlus className="w-4 h-4" /> Add voters</button>
                    <button onClick={downloadVoterTemplate} className={btn} title="Template"><FileSpreadsheet className="w-4 h-4" /> Template</button>
                    <button onClick={() => fileRef.current?.click()} disabled={busy} className={btn}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import</button>
                    <button onClick={() => exportSchemeViewToExcel({ scheme, voters: filtered })} disabled={!filtered.length} className={btn}><Download className="w-4 h-4" /> Export</button>
                  </div>
                </div>

                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Caste</p>
                <SmartBarChart data={casteData} color="#8A5A44" topN={8} emptyLabel="No voters enrolled" />
              </div>

              <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 flex flex-wrap gap-2 border-b border-black/10 dark:border-white/10">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={filters.q} onChange={(e) => setF('q', e.target.value)} placeholder="Search" className={`${input} pl-9`} />
                  </div>
                  <select value={filters.caste} onChange={(e) => setF('caste', e.target.value)} className={`${input} !w-auto max-w-[180px]`}><option value="">All castes</option>{castes.map((c) => <option key={c}>{c}</option>)}</select>
                  <select value={filters.religion} onChange={(e) => setF('religion', e.target.value)} className={`${input} !w-auto max-w-[160px]`}><option value="">All religions</option>{religions.map((c) => <option key={c}>{c}</option>)}</select>
                  <select value={filters.booth} onChange={(e) => setF('booth', e.target.value)} className={`${input} !w-auto max-w-[180px]`}><option value="">All booths</option>{booths.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase text-slate-500 border-b border-black/10 dark:border-white/10">
                      {['Voter', 'Age', 'Caste', 'Religion', 'Booth', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={6} className="text-center py-10 text-xs text-slate-500">Loading…</td></tr>
                        : !filtered.length ? <tr><td colSpan={6} className="text-center py-10 text-xs text-slate-500">No voters</td></tr>
                        : filtered.slice(0, limit).map(row)}
                    </tbody>
                  </table>
                </div>
                {filtered.length > limit && (
                  <button onClick={() => setLimit((l) => l + PAGE)} className="w-full py-3 text-xs font-semibold text-brass hover:bg-black/5 dark:hover:bg-white/5">
                    Show more ({(filtered.length - limit).toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {editScheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveScheme} className="bg-white dark:bg-ink-light w-full max-w-sm rounded-2xl p-6 space-y-4 border border-black/10 dark:border-white/10">
            <div className="flex justify-between items-center"><h3 className="font-bold text-ink dark:text-paper">Edit scheme</h3><button type="button" onClick={() => setEditScheme(null)}><X className="w-5 h-5 text-slate-500" /></button></div>
            <div><label className="block text-xs text-slate-500 mb-1">Scheme</label><input required value={editScheme.name} onChange={(e) => setEditScheme({ ...editScheme, name: e.target.value })} className={input} /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Category</label><input required value={editScheme.category} onChange={(e) => setEditScheme({ ...editScheme, category: e.target.value })} className={input} /></div>
            <button className="w-full py-2.5 rounded-lg bg-brass hover:bg-brass-light text-ink text-sm font-semibold">Save</button>
          </form>
        </div>
      )}

      <VoterModal isOpen={!!editVoter} onClose={() => setEditVoter(null)} onSave={saveVoter} voter={editVoter} booths={booths} schemes={schemes} />
      {addOpen && scheme && <AddVoters scheme={scheme} wardId={wardId} enrolledIds={new Set(voters.map((v) => v.id))} onClose={() => setAddOpen(false)}
        onDone={async (n) => { setAddOpen(false); await Promise.all([loadVoters(), refreshSchemes()]); flash(`${n} added`); }} />}
    </div>
  );
}

/** Search the ward's voters and enrol the selected ones into the scheme. */
function AddVoters({ scheme, wardId, enrolledIds, onClose, onDone }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      const { data } = await getVoters({ search: q.trim(), ...(wardId ? { ward_id: wardId } : {}) });
      setResults(data.filter((v) => !enrolledIds.has(v.id)).slice(0, 30));
    }, 300);
    return () => clearTimeout(t);
  }, [q, wardId, enrolledIds]);

  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const save = async () => { setBusy(true); try { const { data } = await enrollSchemeVoters(scheme.id, [...picked]); onDone(data.enrolled); } finally { setBusy(false); } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-ink-light w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <h3 className="font-bold text-ink dark:text-paper flex items-center gap-2"><Users className="w-4 h-4" /> Add to {scheme.name}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, voter ID or phone" className={input} /></div>
        <div className="flex-1 overflow-y-auto px-4 pb-2 scrollbar-thin divide-y divide-black/5 dark:divide-white/5">
          {results.map((v) => (
            <label key={v.id} className="flex items-center gap-3 py-2.5 cursor-pointer text-sm">
              <input type="checkbox" checked={picked.has(v.id)} onChange={() => toggle(v.id)} className="accent-[#C08829]" />
              <span className="text-ink dark:text-paper">{v.name} <span className="text-xs font-mono text-slate-500 ml-1">{v.voter_card_id}</span></span>
              <span className="ml-auto text-xs text-slate-500">{v.caste || ''}</span>
            </label>
          ))}
          {q.trim().length >= 2 && !results.length && <p className="text-center text-xs text-slate-500 py-6">No voters</p>}
        </div>
        <div className="p-4 border-t border-black/10 dark:border-white/10">
          <button onClick={save} disabled={!picked.size || busy} className="w-full py-2.5 rounded-lg bg-brass hover:bg-brass-light text-ink text-sm font-semibold disabled:opacity-50">Add {picked.size || ''}</button>
        </div>
      </div>
    </div>
  );
}
