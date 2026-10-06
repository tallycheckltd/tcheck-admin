import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '../ui/Input';
import { Slider } from '../ui/Slider';
import { UserCheck, MessageSquareOff, MessageSquare, ShieldCheck, Megaphone, ScanFace, Timer, CalendarDays, Layers, ChevronDown, ToggleRight, Server, Briefcase, Sparkles, IdCard } from 'lucide-react';
import type { SchoolSettingsValue } from './tenantSettings';


/**
 * A tenant's settings form (attendance, features, advanced) — shared by the platform's tenant page
 * (UAT §2) and the create wizard, so they can't drift apart. Moved out of SchoolsPage.tsx unchanged.
 */


// Compact settings-list row (icon + title + switch on one line, description below in muted
// text) — replaces the old one-per-card layout so 6 feature toggles don't turn into 6 screens of
// scroll. Rows sit inside an AccordionSection's divide-y list, not individually bordered.
function ToggleRow({ icon: Icon, title, description, checked, onChange }: {
  icon: ElementType; title: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer group">
      <span className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
          <Icon size={14} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900 dark:text-white">{title}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{description}</span>
        </span>
      </span>
      <span
        onClick={() => onChange(!checked)}
        className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </label>
  );
}

/** Collapsible section with a colored icon badge and optional right-aligned summary — the
 * structural unit the whole settings panel is built from. Cuts the panel's default height
 * dramatically (rarely-touched sections start closed) without needing a wider modal, and gives
 * each group a distinct identity instead of five identical gray boxes stacked vertically. */
function AccordionSection({ icon: Icon, iconColor, title, summary, defaultOpen = true, children }: {
  icon: ElementType; iconColor: string; title: string; summary?: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className={`flex items-center justify-center w-8 h-8 rounded-xl ${iconColor}`}>
            <Icon size={15} />
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {summary && !open && (
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">{summary}</span>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Shared between the Edit-School modal and the create wizard's Step 3 — one source of truth so
 * the two surfaces can't drift apart. Three collapsible groups instead of five flat cards:
 * Attendance (mode + override + thresholds, everything about how check-in behaves day to day —
 * open by default), Features (the toggle list — open by default, but now a dense divide-y list
 * instead of six separate boxes), and Advanced (the isolated-backend override — closed by
 * default, since "leave blank unless..." describes the rare case, not the common one). */
export function SchoolSettingsFields({ value, onChange }: { value: SchoolSettingsValue; onChange: (v: SchoolSettingsValue) => void }) {
  const enabledFeatureCount = Object.values(value.features).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <AccordionSection icon={CalendarDays} iconColor="bg-blue-500/10 text-blue-500" title="Attendance">
        <div className="pt-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Stage-based institutions drop the calendar entirely — students progress through a fixed training pipeline of modules instead of scheduled classes.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, attendanceMode: 'CALENDAR_BASED' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  value.attendanceMode === 'CALENDAR_BASED' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                }`}
              >
                <CalendarDays size={13} /> Calendar-Based
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, attendanceMode: 'STAGE_BASED' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  value.attendanceMode === 'STAGE_BASED' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Layers size={13} /> Stage-Based
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-white/5">
            <ToggleRow
              icon={UserCheck}
              title="Manual check-in override"
              description="Lets lecturers mark students present by hand (dead battery, hardware exceptions) from the live session dashboard."
              checked={value.allowManualLecturerOverride}
              onChange={(v) => onChange({ ...value, allowManualLecturerOverride: v })}
            />
          </div>

          <div className="space-y-4 border-t border-gray-100 dark:border-white/5 pt-4">
            <Slider
              label="Late Threshold"
              min={0} max={60} step={1} unit=" min"
              value={value.lateThresholdMinutes}
              onChange={(v) => onChange({ ...value, lateThresholdMinutes: v })}
            />
            <Slider
              label="Extremely Late Threshold"
              min={0} max={90} step={1} unit=" min"
              value={value.extremelyLateThresholdMinutes}
              onChange={(v) => onChange({ ...value, extremelyLateThresholdMinutes: v })}
            />
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        icon={ToggleRight}
        iconColor="bg-violet-500/10 text-violet-500"
        title="Features"
        summary={`${enabledFeatureCount}/${Object.keys(value.features).length} enabled`}
      >
        <div className="pt-1 divide-y divide-gray-100 dark:divide-white/5">
          <ToggleRow
            icon={MessageSquare}
            title="Messaging"
            description="Chat, campus/course rooms, and direct messages. Off hides the Chat tab entirely on mobile — no messaging feature at all for this institution, not just muted."
            checked={value.features.messaging}
            onChange={(v) => onChange({ ...value, features: { ...value.features, messaging: v } })}
          />
          <ToggleRow
            icon={MessageSquareOff}
            title="Anonymous Chat"
            description="Lets students post anonymously in Campus/Session Chat rooms."
            checked={value.features.anonymousChat}
            onChange={(v) => onChange({ ...value, features: { ...value.features, anonymousChat: v } })}
          />
          <ToggleRow
            icon={ShieldCheck}
            title="Biometric Strict Mode"
            description="Blocks the selfie fallback — students without biometric hardware can't check in. Only applies while Face ID & Baseline Photo is on (turning this on turns that on too)."
            checked={value.features.biometricStrictMode}
            onChange={(v) => onChange({ ...value, features: { ...value.features, biometricStrictMode: v, ...(v ? { faceIdCheckIn: true } : {}) } })}
          />
          <ToggleRow
            icon={Megaphone}
            title="Announcements"
            description="Lets this institution send announcements — each role reaches only its own people."
            checked={value.features.broadcasts}
            onChange={(v) => onChange({ ...value, features: { ...value.features, broadcasts: v } })}
          />
          <ToggleRow
            icon={ScanFace}
            title="Face ID & Baseline Photo"
            description="One switch for identity. On: each student takes a one-time baseline photo and proves it's them at every check-in (Face ID / fingerprint, or a selfie on phones without biometrics). Off: no baseline photo and no identity check — students check in with the classroom beacon only, so someone carrying a student's phone could check in for them. Turning it back on asks anyone without a photo for one the next time they open the app."
            checked={value.features.faceIdCheckIn}
            onChange={(v) => onChange({ ...value, features: { ...value.features, faceIdCheckIn: v, ...(v ? {} : { biometricStrictMode: false }) } })}
          />
          <ToggleRow
            icon={Timer}
            title="Dwell Time Tracking"
            description="Requires ~10s of sustained signal presence before an Aura check-in is accepted. Off allows an instant tap the moment the signal is detected."
            checked={value.features.dwellTimeTracking}
            onChange={(v) => onChange({ ...value, features: { ...value.features, dwellTimeTracking: v } })}
          />
          <ToggleRow
            icon={Briefcase}
            title="Executive Ed Suite"
            description="Tools for executive and short-course programmes — cohorts and corporate attendees tracked separately from regular class attendance."
            checked={value.features.execEdSuite}
            onChange={(v) => onChange({ ...value, features: { ...value.features, execEdSuite: v } })}
          />
          <ToggleRow
            icon={Sparkles}
            title="Onboarding Journey"
            description="Premium onboarding: an approval email, a registration-progress percentage on each student's profile, a staff alert when they finish their profile, and programme-welcome / materials-ready templates for Client Experience Managers."
            checked={value.features.onboardingJourney}
            onChange={(v) => onChange({ ...value, features: { ...value.features, onboardingJourney: v } })}
          />
          <ToggleRow
            icon={IdCard}
            title={'"Tell Us About You" Profile Prompt'}
            description="Asks each student for gender, date of birth, nationality, job title and company once, right after sign-in (after the baseline photo where Face ID & Baseline Photo is on). Off means new students skip this entirely — existing answers are untouched either way."
            checked={value.features.profileCompletionPrompt}
            onChange={(v) => onChange({ ...value, features: { ...value.features, profileCompletionPrompt: v } })}
          />
        </div>
      </AccordionSection>

      <AccordionSection
        icon={Server}
        iconColor="bg-gray-400/10 text-gray-500 dark:text-gray-400"
        title="Advanced"
        summary={value.apiBaseUrl ? 'Isolated backend set' : 'Default backend'}
        defaultOpen={false}
      >
        <div className="pt-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Leave blank unless this institution runs on its own isolated backend (e.g. a pilot with a
            separate database). If set, the mobile apps redirect to this URL after the institution is
            selected instead of using the default backend.
          </p>
          <Input
            placeholder="https://tcheck-backend-example.up.railway.app/api"
            value={value.apiBaseUrl}
            onChange={(e) => onChange({ ...value, apiBaseUrl: e.target.value })}
          />
        </div>
      </AccordionSection>
    </div>
  );
}

