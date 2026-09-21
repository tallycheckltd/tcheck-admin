import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A production build must be given a real, absolute backend URL. `VITE_API_URL` is baked into the bundle
 * at build time, and two outages came from it being wrong without anyone noticing: a variable stored as
 * "Sensitive" in Vercel comes back as the literal text `[SENSITIVE]` from `vercel env pull`, so any
 * locally-run build (`vercel build`, `--prebuilt`) shipped that placeholder — logins 405'd, and Socket.IO
 * connected to the wrong origin. The client falls back to `/api` for a bad value, which keeps plain API
 * calls working and HIDES the problem, so the build itself refuses instead.
 */
function assertApiUrl(mode: string) {
  const url = (loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL ?? '').trim()
  if (!/^https?:\/\/[^\s/]+/i.test(url)) {
    throw new Error(
      `VITE_API_URL must be an absolute http(s) URL for a production build, got ${JSON.stringify(url)}. ` +
        'Set it as a NON-sensitive Vercel env var (Sensitive vars come back as "[SENSITIVE]" from `vercel env pull`), ' +
        'e.g. https://tcheck-backend-production-3127.up.railway.app/api',
    )
  }
  if (process.env.VERCEL && /localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error(`VITE_API_URL points at ${url} — refusing to deploy a dashboard that talks to localhost.`)
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertApiUrl(mode)
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:3001',
        '/socket.io': { target: 'http://localhost:3001', ws: true },
      },
    },
  }
})
