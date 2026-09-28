import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Smartphone } from 'lucide-react';

/**
 * The "smart link" the feedback-request email's button points at
 * (`${CLIENT_URL}/feedback/:requestId}` — see server/src/services/email.service.ts's
 * sendFeedbackRequestEmail). Unauthenticated on purpose: students don't have dashboard accounts,
 * so this page's only job is bouncing straight into the mobile app's `tcheck://feedback` custom
 * URL scheme (registered on both clients — see StudentAttendanceApp.swift's `.onOpenURL` and
 * MainActivity's intent-filter). No API call happens here; the app itself fetches the request's
 * prompt once it's open and authenticated (GET /feedback-requests/:id).
 *
 * There's no verified Universal Links/App Links domain configured for this project (CLIENT_URL is
 * still a bare dev/staging host, not a domain either mobile OS trusts to auto-launch the app), so
 * this redirect — not a true universal link — is what actually gets someone from "tapped a link in
 * Mail/Gmail" to "app opens" today. If the OS blocks the scheme (app not installed, or a webmail
 * client that strips custom-scheme navigation) the fallback copy below is what they see instead.
 */
export function FeedbackRedirectPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [attempted, setAttempted] = useState(false);

  const deepLink = `tcheck://feedback?requestId=${encodeURIComponent(requestId ?? '')}`;

  useEffect(() => {
    if (!requestId) return;
    window.location.href = deepLink;
    const timer = setTimeout(() => setAttempted(true), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
      <div className="relative w-full max-w-sm mx-4 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
          <Star size={28} className="text-blue-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-950 dark:text-white">Opening the TCheck app…</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          We're taking you to your feedback form.
        </p>

        {attempted && (
          <div className="mt-6 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Didn't open automatically? Make sure the TCheck app is installed, then tap below.
            </p>
            <a
              href={deepLink}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              <Smartphone size={16} /> Open TCheck App
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
