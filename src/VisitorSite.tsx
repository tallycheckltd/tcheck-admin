import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VisitorPassPage } from './pages/public/VisitorPassPage';

/**
 * Visitors (2026-11-13) — what the visitor address (e.g. visit.tallycheck.co.ke) serves: the pass
 * page and nothing else. No staff sign-in, no dashboard code (main.tsx loads this instead of App).
 *   /TCV…        the pass from the visitor's email
 *   /pass/TCV…   the same (older links)
 */
function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4">
      <div className="max-w-sm text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Visitor pass</p>
        <h1 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">Open the link in your invitation email</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your pass has its own link. If you can't find the email, ask the person who invited you to send it again.</p>
      </div>
    </div>
  );
}

export default function VisitorSite() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pass/:qrToken" element={<VisitorPassPage />} />
        <Route path="/:qrToken" element={<VisitorPassPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
