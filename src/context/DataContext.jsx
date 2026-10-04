import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getBooths, getSchemes, getWards } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [booths, setBooths] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [wards, setWards] = useState([]);
  // Admin can switch which ward they're viewing; MLAs are locked to their own.
  const [selectedWardId, setSelectedWardId] = useState(user?.wardId ?? null);
  const [loading, setLoading] = useState(true);

  const effectiveWardId = user?.role === 'admin' ? selectedWardId : user?.wardId;

  const refreshBooths = useCallback(async () => {
    const { data } = await getBooths(effectiveWardId ? { ward_id: effectiveWardId } : {});
    setBooths(data);
  }, [effectiveWardId]);

  const refreshSchemes = useCallback(async () => {
    const { data } = await getSchemes(effectiveWardId ? { ward_id: effectiveWardId } : {});
    setSchemes(data);
  }, [effectiveWardId]);

  const refreshWards = useCallback(async () => {
    const { data } = await getWards();
    setWards(data);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      refreshBooths(),
      refreshSchemes(),
      user.role === 'admin' ? refreshWards() : Promise.resolve()
    ]).finally(() => setLoading(false));
  }, [user, effectiveWardId, refreshBooths, refreshSchemes, refreshWards]);

  // Real-time sync: join the ward's socket room so all connected sessions
  // for that ward get pushed voter:created / voter:updated / voter:deleted events.
  useEffect(() => {
    if (!effectiveWardId) return;
    const socket = getSocket();
    socket.emit('join-ward', effectiveWardId);
  }, [effectiveWardId]);

  return (
    <DataContext.Provider
      value={{
        booths, schemes, wards, loading,
        wardId: effectiveWardId,
        selectedWardId, setSelectedWardId,
        refreshBooths, refreshSchemes, refreshWards
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}