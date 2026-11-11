import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { takeMicrosoftResult } from '../../lib/microsoft';
import type { AuthResponse } from '../../types';
import { AuthShell, AuthBrand, AuthAlert } from '../../components/auth/AuthShell';
import { auth } from '../../components/auth/authStyles';

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
    <AuthShell>
      <div className="text-center space-y-4 py-2">
        <div className="flex justify-center mb-2"><AuthBrand /></div>
        {error ? (
          <>
            <AuthAlert>{error}</AuthAlert>
            <Link to="/login" className={`inline-block text-sm ${auth.link}`}>Back to sign in</Link>
          </>
        ) : (
          <>
            <div className="w-7 h-7 mx-auto border-2 border-slate-300 border-t-blue-600 dark:border-white/20 dark:border-t-white rounded-full animate-spin" role="status" aria-label="Loading" />
            <p className={auth.subtitle}>Finishing Microsoft sign-in…</p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
