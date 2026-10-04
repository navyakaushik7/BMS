import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp, getMe } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load by validating the stored JWT against /me
  useEffect(() => {
    const token = localStorage.getItem('bms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem('bms_token');
        localStorage.removeItem('bms_user');
      })
      .finally(() => setLoading(false));
  }, []);

  // Any 401 (expired session, or an admin revoked this account) -> back to Login
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('bms:logout', onLogout);
    return () => window.removeEventListener('bms:logout', onLogout);
  }, []);

  /** Step 1: send phone number, backend texts an OTP to it. */
  const requestOtp = useCallback(async (phone) => {
    const { data } = await apiRequestOtp(phone);
    // dev_otp is only ever returned when Twilio isn't configured (local dev)
    return data;
  }, []);

  /** Step 2: submit the code the user received by SMS. */
  const verifyOtp = useCallback(async (phone, code) => {
    const { data } = await apiVerifyOtp(phone, code);
    localStorage.setItem('bms_token', data.token);
    localStorage.setItem('bms_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bms_token');
    localStorage.removeItem('bms_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
