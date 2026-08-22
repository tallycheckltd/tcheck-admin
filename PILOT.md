# Moi Pilot preview branch — deploys against the isolated `generous-emotion` Railway backend
# (tcheck-backend-moi-production.up.railway.app) via vercel.json's `/api/*` rewrite. Not for merge.
#
# CI (.github/workflows/deploy.yml) deploys this branch as a Vercel PREVIEW build (not
# production) on every push, under the same tcheck-admin Vercel project as `main` — same
# VERCEL_PROJECT_ID/VERCEL_ORG_ID secrets, just a different, stable preview URL.
#
# If VITE_API_URL is set as a Preview-scoped env var in the Vercel project settings, it takes
# precedence over the rewrite (see src/lib/api.ts) — not required for correct routing, since the
# rewrite alone is sufficient, but src/lib/socket.ts's websocket URL also derives from it, so set
# it too if the Socket.IO connection needs to reach the isolated backend directly.
