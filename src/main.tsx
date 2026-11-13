import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Visitors (2026-11-13): the visitor address (visit.… / visitors.…, or VITE_VISITOR_HOSTS) serves only
// the pass page — a small bundle for a phone at the gate, and no staff sign-in. Everything else is the dashboard.
const host = window.location.hostname
const visitorHosts = String(import.meta.env.VITE_VISITOR_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)
// …and the free Vercel address used until a custom domain exists (tcheck-visit.vercel.app).
const isVisitorSite = visitorHosts.includes(host) || /^(visit|visitors)\./.test(host) || /(^|-)visit(ors)?\.vercel\.app$/.test(host)
const Root = isVisitorSite ? lazy(() => import('./VisitorSite.tsx')) : lazy(() => import('./App.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
)
