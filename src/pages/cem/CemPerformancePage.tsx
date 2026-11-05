import { useState } from 'react';
import { clsx } from 'clsx';
import { Gauge, GraduationCap, MessageSquare, Star, Wrench } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { ProgrammeQuality } from './CemTeamPage';

/**
 * SBS (Hans, 2026-11-05) — "My performance": a CEM's own scorecard over a period. Programmes and
 * delegates, the programmes' results (attendance, punctuality, ratings, NPS, completion) and the
 * service numbers (tickets, messages). A Head of CEM sees the same card for each CEM in their team.
 * Server: GET /cem/performance (cemPerformance.service); counts and averages only.
 */

interface Timing { medianSeconds: number | null; p90Seconds: number | null }
export interface PerfRow {
  cem: { id: string; firstName: string; lastName: string };
  programmes: number; students: number; tickets: number; openTickets: number; enoughData: boolean;
  acknowledge: Timing | null; resolve: Timing | null; slaBreachRate: number | null; escalationsReceived: number; escalationsRaised: number;
  dmAwaitingReply: number; dmOldestWaitingSeconds: number | null; dmResponseMedianSeconds: number | null;
  quality: ProgrammeQuality | null;
}
interface Data { from: string; to: string; minTickets: number; team: PerfRow[]; self: string | null }

const PERIODS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 3 months', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
] as const;

const dur = (s: number | null | undefined) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} days`;
};
const p = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

function Tile({ value, label, hint, tone }: { value: string; label: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4">
      <p className={clsx('text-2xl font-bold', tone === 'good' ? 'text-green-600 dark:text-green-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
const toneFor = (v: number | null | undefined, good: number, warn: number) => (v === null || v === undefined ? undefined : v >= good ? 'good' : v >= warn ? 'warn' : 'bad');

export function Scorecard({ r, minTickets, own }: { r: PerfRow; minTickets: number; own: boolean }) {
  const q = r.quality;
  const section = 'glass-card p-5 space-y-3';
  const h = 'text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2';
  return (
    <div className="space-y-4">
      <section className={section}>
        <h3 className={h}><GraduationCap size={18} className="text-blue-500" /> Programmes and delegates</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile value={String(q?.programmesLive ?? r.programmes)} label="Programmes running" />
          <Tile value={String(q?.programmesDelivered ?? 0)} label="Programmes delivered" />
          <Tile value={String(q?.delegates ?? r.students)} label="Delegates looked after" />
          <Tile value={p(q?.completionRate)} label="Completion rate" hint="Of delegates in delivered programmes" tone={toneFor(q?.completionRate, 80, 60)} />
        </div>
      </section>
      <section className={section}>
        <h3 className={h}><Star size={18} className="text-blue-500" /> Programme quality</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile value={p(q?.attendanceRate)} label="Attendance" hint={q ? `${q.sessionsHeld} sessions held` : undefined} tone={toneFor(q?.attendanceRate, 80, 70)} />
          <Tile value={p(q?.onTimeRate)} label="On time" tone={toneFor(q?.onTimeRate, 80, 60)} />
          <Tile value={q?.averageRating == null ? '—' : `${q.averageRating}/10`} label="Session rating" hint={q?.ratingsCount ? `${q.ratingsCount} ratings` : 'No ratings yet'} tone={toneFor(q?.averageRating, 8, 6.5)} />
          <Tile value={q?.nps == null ? '—' : String(q.nps)} label="NPS" hint="% 9–10 minus % 0–6" tone={toneFor(q?.nps, 30, 0)} />
        </div>
      </section>
      <section className={section}>
        <h3 className={h}><Wrench size={18} className="text-blue-500" /> Facility tickets</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile value={String(r.tickets)} label="Tickets handled" hint={r.openTickets ? `${r.openTickets} still open` : undefined} />
          <Tile value={r.enoughData ? dur(r.acknowledge?.medianSeconds) : '—'} label="Time to acknowledge" hint={r.enoughData ? 'Typical (median)' : `Needs ${minTickets} tickets`} />
          <Tile value={r.enoughData ? dur(r.resolve?.medianSeconds) : '—'} label="Time to resolve" hint={r.enoughData ? 'Typical (median)' : `Needs ${minTickets} tickets`} />
          <Tile value={r.enoughData ? p(r.slaBreachRate) : '—'} label="Missed deadlines" hint={`${r.escalationsReceived} escalated`} tone={r.enoughData ? (r.slaBreachRate! <= 10 ? 'good' : r.slaBreachRate! <= 25 ? 'warn' : 'bad') : undefined} />
        </div>
      </section>
      <section className={section}>
        <h3 className={h}><MessageSquare size={18} className="text-blue-500" /> Messages from delegates</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Tile value={String(r.dmAwaitingReply)} label={own ? 'Waiting for your reply' : 'Waiting for a reply'} tone={r.dmAwaitingReply === 0 ? 'good' : r.dmAwaitingReply <= 3 ? 'warn' : 'bad'} />
          <Tile value={dur(r.dmOldestWaitingSeconds)} label="Oldest waiting" />
          <Tile value={dur(r.dmResponseMedianSeconds)} label="Typical reply time" />
        </div>
      </section>
    </div>
  );
}

export function CemPerformancePage() {
  const { user } = useAuth();
  const [period, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('90');
  const startOf = (key: string) => new Date(Date.now() - PERIODS.find((x) => x.key === key)!.days * 86_400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => startOf('90'));
  const setPeriod = (key: (typeof PERIODS)[number]['key']) => { setPeriodKey(key); setFrom(startOf(key)); };
  const { data, loading } = useApi<Data>(`/cem/performance?from=${from}`);
  const rows = data?.team ?? [];
  const [pick, setPick] = useState('');
  const own = data?.self ? rows.find((r) => r.cem.id === data.self) : undefined;
  const shown = own ?? rows.find((r) => r.cem.id === pick) ?? rows[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Gauge size={22} className="text-blue-500" /> {own ? 'My performance' : 'CEM performance'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {own ? `How your programmes are going, ${user?.firstName}, and how quickly you respond.` : 'Each CEM\'s programmes, results and responsiveness.'} Counts and averages only.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5 text-sm">
          {PERIODS.map((x) => (
            <button key={x.key} onClick={() => setPeriod(x.key)} aria-pressed={period === x.key}
              className={clsx('px-3 py-1.5 rounded-lg font-medium cursor-pointer', period === x.key ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>{x.label}</button>
          ))}
        </div>
      </div>
      {!own && rows.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {rows.map((r) => (
            <button key={r.cem.id} onClick={() => setPick(r.cem.id)} aria-pressed={shown?.cem.id === r.cem.id}
              className={clsx('px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer border', shown?.cem.id === r.cem.id ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300')}>
              {r.cem.firstName} {r.cem.lastName}
            </button>
          ))}
        </div>
      )}
      {loading && !data ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        : !shown ? <p className="glass-card p-6 text-sm text-gray-500 dark:text-gray-400 text-center">No CEMs to show yet.</p>
          : <Scorecard r={shown} minTickets={data!.minTickets} own={!!own} />}
    </div>
  );
}
