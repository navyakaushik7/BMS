import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Landmark, Pencil, Download, X } from 'lucide-react';
import { getVoters, createBooth, deleteBooth, updateBooth } from '../lib/api';
import { exportVotersToExcel } from '../utils/excelUtils';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Trash2 } from 'lucide-react';

export default function Booths() {
  const { booths, wardId, refreshBooths } = useData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [votersByBooth, setVotersByBooth] = useState({});
  const [openId, setOpenId] = useState(null);
  const [newBoothName, setNewBoothName] = useState('');
  const [newBoothAddress, setNewBoothAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadBoothVoters = useCallback(async (boothId) => {
    const { data } = await getVoters({ booth_id: boothId, ward_id: wardId });
    setVotersByBooth((prev) => ({ ...prev, [boothId]: data }));
  }, [wardId]);

  useEffect(() => { setVotersByBooth({}); setOpenId(null); }, [wardId, booths.length]);

  const toggle = (boothId) => {
    if (openId === boothId) { setOpenId(null); return; }
    setOpenId(boothId);
    if (!votersByBooth[boothId]) loadBoothVoters(boothId);
  };

  const handleAddBooth = async (e) => {
    e.preventDefault();
    if (!newBoothName.trim()) return;
    setAdding(true);
    try {
      await createBooth({ name: newBoothName.trim(), address: newBoothAddress.trim() || undefined, ward_id: wardId });
      setNewBoothName('');
      setNewBoothAddress('');
      await refreshBooths();
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteBooth = async (booth) => {
    if (!window.confirm(`Delete booth "${booth.name}"? Voters assigned to it will be unassigned.`)) return;
    await deleteBooth(booth.id);
    await refreshBooths();
  };

  const handleSaveBooth = async (e) => {
    e.preventDefault();
    await updateBooth(editing.id, { name: editing.name, address: editing.address });
    setEditing(null);
    await refreshBooths();
  };

  const handleExportBooth = async (booth) => {
    const { data } = await getVoters({ booth_id: booth.id, ward_id: wardId });
    exportVotersToExcel(data, `${booth.name.replace(/[^\w]+/g, '-')}.xlsx`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink dark:text-paper">Booth-wise View</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {booths.length} booth{booths.length !== 1 ? 's' : ''} in this ward
          {!isAdmin && <span className="ml-1">(admin adds or removes booths)</span>}
        </p>
      </div>

      {isAdmin && (
      <form onSubmit={handleAddBooth} className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Booth name</label>
          <input value={newBoothName} onChange={(e) => setNewBoothName(e.target.value)} placeholder="Booth 3 - Panchayat Bhawan"
            className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Address (optional)</label>
          <input value={newBoothAddress} onChange={(e) => setNewBoothAddress(e.target.value)} placeholder="Street / locality"
            className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper" />
        </div>
        <button type="submit" disabled={adding} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brass hover:bg-brass-light text-ink dark:text-paper text-xs font-semibold disabled:opacity-60">
          <Plus className="w-4 h-4" /> Add Booth
        </button>
      </form>
      )}

      <div className="space-y-3">
        {booths.length === 0 && (
          <div className="text-center py-16 border border-dashed border-black/10 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 text-sm">
            No booths yet. Add one above.
          </div>
        )}
        {booths.map((b) => (
          <div key={b.id} className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
            <button onClick={() => toggle(b.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5">
              <div className="flex items-center gap-3">
                <Landmark className="w-4 h-4 text-brass dark:text-brass-light" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-ink dark:text-paper">{b.name}</p>
                  {b.address && <p className="text-xs text-slate-500 dark:text-slate-400">{b.address}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">{b.voter_count} voter{b.voter_count !== 1 ? 's' : ''}</span>
                <span role="button" title="Export" onClick={(e) => { e.stopPropagation(); handleExportBooth(b); }}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brass hover:bg-brass/10"><Download className="w-3.5 h-3.5" /></span>
                <span role="button" title="Edit" onClick={(e) => { e.stopPropagation(); setEditing({ ...b, address: b.address || '' }); }}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brass hover:bg-brass/10"><Pencil className="w-3.5 h-3.5" /></span>
                {isAdmin && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteBooth(b); }}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${openId === b.id ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {openId === b.id && (
              <div className="border-t border-black/10 dark:border-white/10 px-5 py-3">
                {!votersByBooth[b.id] ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">Loading…</p>
                ) : votersByBooth[b.id].length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No voters assigned to this booth.</p>
                ) : (
                  <div className="divide-y divide-black/10 dark:divide-white/10">
                    {votersByBooth[b.id].map((v) => (
                      <div key={v.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-ink dark:text-paper">{v.name} <span className="text-slate-500 dark:text-slate-400 font-mono text-xs ml-1">{v.voter_card_id}</span></span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                          {v.religion || 'Religion N/A'}{v.caste ? ` · ${v.caste}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={handleSaveBooth} className="bg-white dark:bg-ink-light w-full max-w-sm rounded-2xl p-6 space-y-4 border border-black/10 dark:border-white/10">
            <div className="flex justify-between items-center"><h3 className="font-bold text-ink dark:text-paper">Edit booth</h3><button type="button" onClick={() => setEditing(null)}><X className="w-5 h-5 text-slate-500" /></button></div>
            <div><label className="block text-xs text-slate-500 mb-1">Name</label>
              <input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Address</label>
              <input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper" /></div>
            <button className="w-full py-2.5 rounded-lg bg-brass hover:bg-brass-light text-ink text-sm font-semibold">Save</button>
          </form>
        </div>
      )}
    </div>
  );
}
