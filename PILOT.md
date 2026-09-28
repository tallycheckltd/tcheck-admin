# Moi Pilot dashboard — `moi-pilot` branch. Not for merge.

This branch is the admin dashboard for Moi University's isolated backend (Railway project `generous-emotion`,
https://tcheck-backend-moi-production.up.railway.app). It is the current `main` dashboard plus three changes:

- `src/lib/apiBase.ts` — API_BASE is fixed to Moi's backend; `VITE_API_URL` is ignored on this branch, so it can
  never talk to shared production even though the Vercel project's env points there.
- `vercel.json` — `/api/*` rewrite points at Moi's backend (belt and braces).
- `.github/workflows/deploy.yml` — also runs on pushes to `moi-pilot`, deploying a Vercel PREVIEW (never `--prod`).

Refreshing it: merge `main` into `moi-pilot`, keep these three changes, push. Production is never touched.
