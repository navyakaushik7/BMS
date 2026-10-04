import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const RELIGIONS = ['Hindu', 'Sikh', 'Muslim', 'Christian', 'Other'];
const CONTACT_STATUSES = ['Not Contacted', 'Contacted', 'Promised Support', 'Needs Follow-up', 'Not Interested'];

const emptyForm = (booths) => ({
  voter_card_id: `VTR-${Math.floor(10000 + Math.random() * 90000)}`,
  name: '', relation_name: '', age: '', gender: 'Male', phone: '', address: '',
  religion: '', caste: '', sub_caste: '',
  contact_status: 'Not Contacted', notes: '',
  booth_id: booths[0]?.id || ''
});

export default function VoterModal({ isOpen, onClose, onSave, voter, booths, schemes }) {
  const [formData, setFormData] = useState(emptyForm(booths));
  const [schemeIds, setSchemeIds] = useState([]);

  useEffect(() => {
    if (voter) {
      setFormData({ ...voter, age: voter.age || '', booth_id: voter.booth_id || '' });
      const existingIds = Array.isArray(voter.schemes) ? voter.schemes.map((s) => s.id) : (voter.scheme_id ? [voter.scheme_id] : []);
      setSchemeIds(existingIds);
    } else {
      setFormData(emptyForm(booths));
      setSchemeIds([]);
    }
  }, [voter, isOpen, booths]);

  if (!isOpen) return null;

  const toggleScheme = (id) => {
    setSchemeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const field = (label, key, props = {}) => (
    <div>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input
        value={formData[key] ?? ''}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper"
        {...props}
      />
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      age: parseInt(formData.age, 10),
      booth_id: formData.booth_id ? parseInt(formData.booth_id, 10) : null,
      contact_status: formData.contact_status || 'Not Contacted',
      notes: formData.notes || '',
      scheme_ids: schemeIds
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-ink-light border border-black/10 dark:border-white/10 w-full max-w-2xl rounded-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-lg font-bold text-ink dark:text-paper">{voter ? 'Edit Voter' : 'Add Voter'}</h2>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-paper"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
            Voter ID is the candidate key: the one field guaranteed unique per person. Phone numbers are
            often shared across a household, so use Relation Name to tell family members apart.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Voter ID (candidate key)</label>
              <input type="text" required disabled={!!voter} value={formData.voter_card_id}
                onChange={(e) => setFormData({ ...formData, voter_card_id: e.target.value })}
                className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper disabled:opacity-60" />
            </div>
            {field('Name', 'name', { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Relation Name (e.g. "S/O Ram Singh")', 'relation_name')}
            {field('Phone', 'phone')}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Age</label>
              <input type="number" required min={18} value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper" /></div>
            <div><label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Gender</label>
              <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper">
                <option>Male</option><option>Female</option><option>Other</option>
              </select></div>
            <div><label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Religion</label>
              <select value={formData.religion || ''} onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper">
                <option value="">-- Select --</option>
                {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Caste', 'caste')}
            {field('Sub-Caste', 'sub_caste')}
          </div>
          {field('Address', 'address')}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Booth</label>
            <select value={formData.booth_id} onChange={(e) => setFormData({ ...formData, booth_id: e.target.value })}
              className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper">
              <option value="">-- None --</option>{booths.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Schemes enrolled <span className="normal-case font-normal">(a voter can be part of more than one)</span>
            </label>
            {schemes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No schemes set up yet for this ward.</p>
            ) : (
              <div className="flex flex-wrap gap-2 bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg p-2.5 max-h-32 overflow-y-auto scrollbar-thin">
                {schemes.map((s) => {
                  const checked = schemeIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border ${
                        checked
                          ? 'bg-brass/15 border-brass/40 text-ink dark:text-paper font-medium'
                          : 'border-black/10 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-paper'
                      }`}
                    >
                      <input type="checkbox" className="accent-brass" checked={checked} onChange={() => toggleScheme(s.id)} />
                      {s.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Outreach status</label>
            <select value={formData.contact_status || 'Not Contacted'} onChange={(e) => setFormData({ ...formData, contact_status: e.target.value })}
              className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper">
              {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {voter?.last_contacted_at && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Last contacted {new Date(voter.last_contacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</label>
            <textarea rows={2} value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Asked about road repair, wants a follow-up call next week"
              className="w-full bg-paper dark:bg-ink border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-ink dark:text-paper resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-paper">Cancel</button>
            <button type="submit" className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brass hover:bg-brass-light text-ink dark:text-paper text-xs font-semibold"><Save className="w-4 h-4" /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
