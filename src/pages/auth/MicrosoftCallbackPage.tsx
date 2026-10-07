import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { takeMicrosoftResult } from '../../lib/microsoft';
import type { AuthResponse } from '../../types';

/** Where Microsoft sends the person back: finish a sign-in, or a School Admin's Microsoft 365 connect. */
export function MicrosoftCallbackPage() {
  const [error, setError] = useState('');
  const ran = useRef(false); // React StrictMode runs effects twice in dev; a code is single-use

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { mode, body } = takeMicrosoftResult(window.location.search);
        if (mode === 'connect') {
          await api.post('/integrations/microsoft/connect', body);
          window.location.replace('/admin/integrations?microsoft=connected');
          return;
        }
        const data = await api.post<AuthResponse>('/auth/microsoft/complete', body);
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        window.location.replace('/'); // AuthContext loads the session from the stored token
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Microsoft sign-in failed.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {error ? (
          <>
            <p className="text-sm text-red-400" role="alert">{error}</p>
            <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300">Back to sign in</Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Finishing Microsoft sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
