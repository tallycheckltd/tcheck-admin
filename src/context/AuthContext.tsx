import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // Two-step dashboard sign-in: requestOtp() verifies the password and emails a code; verifyOtp()
  // exchanges that code for the real session. Distinct from the mobile app's single-step login,
  // which never goes through this context.
  requestOtp: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('accessToken')));

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    let cancelled = false;
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = async (email: string, password: string): Promise<void> => {
    await api.post<{ otpRequired: true }>('/auth/dashboard-login', { email, password });
  };

  const verifyOtp = async (email: string, code: string): Promise<User> => {
    const data = await api.post<AuthResponse>('/auth/dashboard-login/verify-otp', { email, code });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** @see react-refresh/only-export-components — hook colocated with provider */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
