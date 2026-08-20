import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import {
  UploadCloud, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Building2, GraduationCap, Users, CalendarRange, PartyPopper,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { School } from '../../types';

type StepKey = 'rooms' | 'staff' | 'students' | 'timetable';

interface IngestSummary {
  step: StepKey;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const STEPS: { key: StepKey; title: string; icon: typeof Building2; requiredColumns: string[]; optionalColumns: string[]; help: string }[] = [
  {
    key: 'rooms',
    title: 'Facilities & Room Index',
    icon: Building2,
    requiredColumns: ['building', 'roomName'],
    optionalColumns: ['capacity'],
    help: 'Validates room names before Step 4 references them — hardware (beacon) mapping happens later, on-site, via the Heatmap Simulator.',
  },
  {
    key: 'staff',
    title: 'Faculty & Staff Provisioning',
    icon: Users,
    requiredColumns: ['email', 'firstName', 'lastName'],
    optionalColumns: [],
    help: 'Creates Lecturer accounts with a temporary password. Existing emails are left untouched, never overwritten.',
  },
  {
    key: 'students',
    title: 'Student Identity & Roster',
    icon: GraduationCap,
    requiredColumns: ['studentId', 'firstName', 'lastName', 'email'],
    optionalColumns: [],
    help: 'Pre-seeds student accounts — no biometric data imported. A student claims their account in the app on first login.',
  },
  {
    key: 'timetable',
    title: 'Timetable & Course Matrix',
    icon: CalendarRange,
    requiredColumns: ['courseCode', 'courseName', 'lecturerEmail', 'date', 'startTime', 'endTime'],
    optionalColumns: ['room', 'title', 'studentIds (semicolon-separated)'],
    help: 'Creates courses, links each to its lecturer (must already exist from Step 2), and schedules one class session per row. date is YYYY-MM-DD; startTime/endTime are full ISO datetimes.',
  },
];

export function SetupWizardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const schoolId = isSuperAdmin ? selectedSchoolId : user?.schoolId || '';

  const [stepIndex, setStepIndex] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summaries, setSummaries] = useState<Partial<Record<StepKey, IngestSummary>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const step = STEPS[stepIndex]!;
  const done = stepIndex >= STEPS.length;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const handleSubmitStep = async () => {
    if (!csvText.trim()) {
      setError('Upload or paste a CSV first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const endpoint = step.key === 'rooms' ? '/setup-wizard/rooms' : `/setup-wizard/${step.key}`;
      const result = await api.post<IngestSummary>(endpoint, { csvContent: csvText, schoolId });
      setSummaries((prev) => ({ ...prev, [step.key]: result }));
      setCsvText('');
      setStepIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process this step');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipStep = () => {
    setCsvText('');
    setError('');
    setStepIndex((i) => i + 1);
  };

  const restart = () => {
    setStepIndex(0);
    setSummaries({});
    setCsvText('');
    setError('');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UploadCloud className="text-blue-500" /> Enterprise Setup Wizard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bulk-onboard a school from CSV exports — rooms, staff, students, then the timetable that ties them together.
          </p>
        </div>
        {isSuperAdmin && (
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white cursor-pointer min-w-[220px]"
          >
            <option value="">Select a school…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {!schoolId ? (
        <div className="glass-card p-10 text-center text-sm text-gray-500 dark:text-gray-400">Select a school above to begin.</div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i < stepIndex || done
                      ? 'bg-emerald-500 text-white'
                      : i === stepIndex
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-400'
                  }`}
                >
                  {i < stepIndex || done ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < stepIndex ? 'bg-emerald-500' : 'bg-gray-100 dark:bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {!done ? (
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                  <step.icon size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Step {stepIndex + 1}: {step.title}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{step.help}</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3 text-xs">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Required columns</p>
                <p className="font-mono text-gray-500 dark:text-gray-400">{step.requiredColumns.join(', ')}</p>
                {step.optionalColumns.length > 0 && (
                  <>
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mt-2 mb-1">Optional columns</p>
                    <p className="font-mono text-gray-500 dark:text-gray-400">{step.optionalColumns.join(', ')}</p>
                  </>
                )}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                  className="rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <UploadCloud size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload a .csv file, or drag one here</p>
                </div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Or paste CSV content directly, e.g.\n${step.requiredColumns.join(',')}\n...`}
                  rows={6}
                  className="mt-3 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  {stepIndex > 0 && (
                    <Button variant="secondary" onClick={() => setStepIndex((i) => i - 1)}>
                      <ArrowLeft size={14} className="mr-1" /> Back
                    </Button>
                  )}
                  <Button variant="secondary" onClick={handleSkipStep}>Skip this step</Button>
                </div>
                <Button onClick={handleSubmitStep} disabled={submitting}>
                  {submitting ? 'Processing…' : <>Process &amp; Continue <ArrowRight size={14} className="ml-1" /></>}
                </Button>
              </div>

              {Object.values(summaries).length > 0 && (
                <div className="pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
                  {STEPS.slice(0, stepIndex).map((s) => {
                    const summary = summaries[s.key];
                    if (!summary) return null;
                    return <StepSummaryRow key={s.key} title={s.title} summary={summary} />;
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-10 text-center space-y-5">
              <PartyPopper size={40} className="mx-auto text-emerald-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Setup complete</h2>
              <div className="max-w-lg mx-auto space-y-2 text-left">
                {STEPS.map((s) => {
                  const summary = summaries[s.key];
                  if (!summary) return (
                    <p key={s.key} className="text-xs text-gray-400 italic">{s.title}: skipped</p>
                  );
                  return <StepSummaryRow key={s.key} title={s.title} summary={summary} />;
                })}
              </div>
              <Button onClick={restart} variant="secondary">Run another import</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StepSummaryRow({ title, summary }: { title: string; summary: IngestSummary }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3 text-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
      <p className="text-gray-500 dark:text-gray-400 mt-0.5">
        {summary.totalRows} rows · {summary.created} created · {summary.updated} updated · {summary.skipped} skipped
      </p>
      {summary.errors.length > 0 && (
        <div className="mt-1.5 flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            {summary.errors.slice(0, 5).map((err, i) => (
              <p key={i}>Row {err.row}: {err.message}</p>
            ))}
            {summary.errors.length > 5 && <p>+{summary.errors.length - 5} more</p>}
          </div>
        </div>
      )}
    </div>
  );
}
