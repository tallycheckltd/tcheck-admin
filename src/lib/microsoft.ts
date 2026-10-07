/**
 * Sign in with Microsoft — the browser half of authorization code + PKCE. The server holds the client
 * secret and verifies the ID token (server/src/services/microsoftAuth.service.ts); this file only makes
 * the one-time verifier / state / nonce, sends the person to Microsoft, and hands the code back.
 *   mode 'signin'  — the login page
 *   mode 'connect' — a School Admin tying the school to its Microsoft 365 (Integrations)
 */
import { api } from './api';

export type MicrosoftMode = 'signin' | 'connect';
interface Pending { state: string; nonce: string; verifier: string; mode: MicrosoftMode; at: number }
const KEY = 'tcheck.microsoft.pending';
export const MICROSOFT_REDIRECT_PATH = '/auth/microsoft';

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export interface MicrosoftConfig { enabled: boolean; clientId: string | null; authorizeUrl: string; scope: string }
export const getMicrosoftConfig = () => api.get<MicrosoftConfig>('/auth/microsoft/config');

export async function startMicrosoft(mode: MicrosoftMode) {
  const cfg = await getMicrosoftConfig();
  if (!cfg.enabled || !cfg.clientId) throw new Error('Sign in with Microsoft is not set up on this TCheck server.');
  const pending: Pending = { state: random(24), nonce: random(24), verifier: random(48), mode, at: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(pending));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier))));
  const url = new URL(cfg.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: cfg.clientId, response_type: 'code', response_mode: 'query', scope: cfg.scope,
    redirect_uri: `${window.location.origin}${MICROSOFT_REDIRECT_PATH}`, state: pending.state, nonce: pending.nonce,
    code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  window.location.assign(url.toString());
}

/** On the redirect page: check Microsoft's answer belongs to the attempt this tab started. */
export function takeMicrosoftResult(search: string): { mode: MicrosoftMode; body: { code: string; codeVerifier: string; nonce: string; redirectUri: string } } {
  const q = new URLSearchParams(search);
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  const pending = raw ? (JSON.parse(raw) as Pending) : null;
  if (q.get('error')) throw new Error(q.get('error_description')?.split('\n')[0] || 'Microsoft sign-in was cancelled.');
  if (!pending || pending.state !== q.get('state') || Date.now() - pending.at > 10 * 60_000) throw new Error('That Microsoft sign-in has expired or was started in another tab. Start again.');
  const code = q.get('code');
  if (!code) throw new Error('Microsoft did not return a sign-in code. Start again.');
  return { mode: pending.mode, body: { code, codeVerifier: pending.verifier, nonce: pending.nonce, redirectUri: `${window.location.origin}${MICROSOFT_REDIRECT_PATH}` } };
}
