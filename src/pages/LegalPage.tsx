import { ExternalLink } from 'lucide-react';
import { LEGAL_URLS } from '../lib/legalUrls';

/** Privacy Policy & Terms of Service — the published text lives on the website only, so this page
 * just points there instead of carrying a copy that could drift from it. */
export function LegalPage() {
  const docs = [
    { label: 'Privacy Policy', detail: 'How Tcheck collects, uses and protects your data.', href: LEGAL_URLS.privacy },
    { label: 'Terms of Service', detail: 'The terms that govern your use of Tcheck.', href: LEGAL_URLS.terms },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Legal</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Privacy Policy & Terms of Service</p>
      </div>
      <div className="grid gap-4 max-w-3xl">
        {docs.map((d) => (
          <a
            key={d.href}
            href={d.href}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-5 flex items-center justify-between gap-4 hover:ring-2 hover:ring-blue-500/40 transition"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{d.label}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{d.detail}</p>
            </div>
            <ExternalLink size={18} className="text-blue-500 shrink-0" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}
