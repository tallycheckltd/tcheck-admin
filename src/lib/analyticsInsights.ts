import { FAILURE_REASON_LABEL, type PilotAnalytics, type PilotCourse, type PilotStudent } from './pilotAnalytics';

/*
 * Analytics trends and findings (2026-11-04). Everything here is worked out in the browser from the
 * one /pilot-analytics response, so the page, the CSV report and the PDF report all say the same
 * thing. Pure functions only.
 */

export const AT_RISK = 0.75;
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
const labelFor = (map: Record<string, string>, code: string) => map[code] ?? code.replace(/_/g, ' ').toLowerCase();

export const LATENESS_ORDER = ['early', '0-5', '5-10', '10-15', '15-30', '30-60', '60+'] as const;
export const LATENESS_LABEL: Record<string, string> = {
  early: 'Before start', '0-5': '0–5 min', '5-10': '5–10 min', '10-15': '10–15 min', '15-30': '15–30 min', '30-60': '30–60 min', '60+': 'Over 1 h',
};
export const DOW_LABEL = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface CourseRow extends PilotCourse {
  expected: number;
  rate: number | null;
  lateShare: number | null;
  checkoutShare: number | null;
}
export interface StudentRow extends PilotStudent {
  rate: number;
  band: 'none' | 'low' | 'mid' | 'good';
}

/** Short names for the server's free-text check-in failure messages, for chart legends. */
export function shortReason(reason: string): string {
  // Matched against the backend's own messages (attendance.service.ts), most specific first.
  const r = reason.toLowerCase();
  if (/too weak|weak signal|move closer|rssi/.test(r)) return 'Signal too weak';
  if (/major\/minor|uuid|beacon in range|no beacon|searching/.test(r)) return 'Wrong or missing beacon';
  if (/holding position|dwell|10 seconds/.test(r)) return 'Left before the 10 s hold';
  if (/already checked/.test(r)) return 'Already checked in';
  if (/not started|already ended|not open|no longer available|not active|expired code|has expired/.test(r)) return 'Outside the check-in window';
  if (/timestamp/.test(r)) return 'Phone clock / stale attempt';
  if (/not enrolled/.test(r)) return 'Not enrolled in the course';
  if (/baseline/.test(r)) return 'No baseline photo';
  if (/face|selfie|verification service/.test(r)) return 'Selfie check failed';
  if (/biometric|signature|fingerprint/.test(r)) return 'Fingerprint check failed';
  if (/device id|device binding|verification method/.test(r)) return 'Phone not set up';
  if (/qr|code your lecturer|online/.test(r)) return 'QR / code problem';
  if (/location|gps|bluetooth/.test(r)) return 'Bluetooth / location off';
  return reason.length > 34 ? `${reason.slice(0, 32)}…` : reason;
}

/** Turn [{day, reason, count}] into one row per day with a column per top reason (the rest = Other). */
function pivot(rows: { day: string; reason: string; count: number }[], label: (r: string) => string, top = 5) {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(label(r.reason), (totals.get(label(r.reason)) ?? 0) + r.count);
  const keys = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const shown = keys.slice(0, top);
  const byDay = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const k = shown.includes(label(r.reason)) ? label(r.reason) : 'Other';
    const row = byDay.get(r.day) ?? { day: r.day };
    row[k] = (Number(row[k]) || 0) + r.count;
    byDay.set(r.day, row);
  }
  const outKeys = keys.length > top ? [...shown, 'Other'] : shown;
  // Every row carries every key (0 when absent) so stacked series never break.
  const out = [...byDay.values()].map((row) => Object.fromEntries([['day', row.day], ...outKeys.map((k) => [k, Number(row[k] ?? 0)])]) as Record<string, number | string>);
  return { keys: outKeys, rows: out.sort((a, b) => String(a.day).localeCompare(String(b.day))), totals };
}

export function deriveTrends(data: PilotAnalytics) {
  const attendanceByDay = (data.attendanceByDay ?? []).map((d) => ({ ...d, rate: share(d.attended, d.expected) }));
  const expected = attendanceByDay.reduce((n, d) => n + d.expected, 0);
  const attended = attendanceByDay.reduce((n, d) => n + d.attended, 0);
  const attendanceRate = share(attended, expected);
  const prev = data.previousPeriod;
  const prevAttendanceRate = prev ? share(prev.attended, prev.expected) : null;
  const emptyClasses = attendanceByDay.reduce((n, d) => n + d.emptyClasses, 0);
  const classesHeld = attendanceByDay.reduce((n, d) => n + d.classes, 0);

  const courses: CourseRow[] = (data.courses ?? []).map((c) => {
    const exp = c.enrolled * c.classesHeld;
    return { ...c, expected: exp, rate: share(c.checkins, exp), lateShare: share(c.late, c.checkins), checkoutShare: share(c.checkouts, c.checkins) };
  });

  const students: StudentRow[] = (data.students ?? []).map((s) => {
    const rate = s.expected ? s.attended / s.expected : 0;
    return { ...s, rate, band: s.attended === 0 ? 'none' : rate < 0.5 ? 'low' : rate < AT_RISK ? 'mid' : 'good' };
  });
  const atRisk = students.filter((s) => s.rate < AT_RISK);
  const neverAttended = students.filter((s) => s.attended === 0);
  const activeStudents = students.filter((s) => s.attended > 0).length;
  const distribution = [
    { band: 'None (0%)', key: 'none', count: students.filter((s) => s.band === 'none').length },
    { band: 'Under 50%', key: 'low', count: students.filter((s) => s.band === 'low').length },
    { band: '50–74%', key: 'mid', count: students.filter((s) => s.band === 'mid').length },
    { band: '75–99%', key: 'good', count: students.filter((s) => s.band === 'good' && s.rate < 1).length },
    { band: 'All (100%)', key: 'all', count: students.filter((s) => s.rate >= 1).length },
  ];

  const lateMap = new Map((data.lateness ?? []).map((l) => [l.bucket, l.count]));
  const lateness = LATENESS_ORDER.map((b) => ({ bucket: b, label: LATENESS_LABEL[b], count: lateMap.get(b) ?? 0 }));
  const lateTotal = lateness.reduce((n, l) => n + l.count, 0);
  const onTimeShare = share((lateMap.get('early') ?? 0) + (lateMap.get('0-5') ?? 0) + (lateMap.get('5-10') ?? 0) + (lateMap.get('10-15') ?? 0), lateTotal);

  const hourCheckins = new Map<number, number>();
  for (const h of data.checkInsByHour ?? []) hourCheckins.set(h.hour, (hourCheckins.get(h.hour) ?? 0) + h.count);
  const hourFails = new Map((data.failuresByHour ?? []).map((h) => [h.hour, h.count]));
  const usedHours = [...hourCheckins.keys(), ...hourFails.keys()];
  const hourFrom = usedHours.length ? Math.max(0, Math.min(...usedHours) - 1) : 6;
  const hourTo = usedHours.length ? Math.min(23, Math.max(...usedHours) + 1) : 20;
  const hours = Array.from({ length: hourTo - hourFrom + 1 }, (_, i) => {
    const h = hourFrom + i;
    return { hour: h, label: `${String(h).padStart(2, '0')}:00`, checkins: hourCheckins.get(h) ?? 0, failures: hourFails.get(h) ?? 0 };
  });

  const failureTrend = pivot(data.failureReasonsByDay ?? [], shortReason);
  const signInTrend = pivot(data.signInFailuresByDay ?? [], (r) => labelFor(FAILURE_REASON_LABEL, r), 4);
  const signInRateByDay = (data.signInsByDay ?? []).map((d) => {
    const row: Record<string, number | string | null> = { day: d.day, ok: d.ok, failed: d.failed, rate: share(d.ok, d.ok + d.failed) == null ? null : Math.round((d.ok / (d.ok + d.failed)) * 100) };
    const f = signInTrend.rows.find((r) => r.day === d.day);
    for (const k of signInTrend.keys) row[k] = Number(f?.[k] ?? 0);
    return row;
  });

  // Running totals of the three onboarding steps across the period.
  const before = data.onboardingBefore ?? { signedIn: 0, terms: 0, baseline: 0 };
  const obDays = new Map((data.onboardingByDay ?? []).map((d) => [d.day, d]));
  const allDays = [...new Set([...(data.checkInsByDay ?? []).map((d) => d.day), ...(data.signInsByDay ?? []).map((d) => d.day), ...obDays.keys()])].sort();
  let run = { ...before };
  const onboarding = allDays.map((day) => {
    const d = obDays.get(day);
    run = { signedIn: run.signedIn + (d?.signedIn ?? 0), terms: run.terms + (d?.terms ?? 0), baseline: run.baseline + (d?.baseline ?? 0) };
    return { day, ...run, newSignedIn: d?.signedIn ?? 0 };
  });

  const checkoutByDay = (data.checkInsByDay ?? []).map((d) => {
    const total = d.present + d.late + d.other;
    return { ...d, total, checkoutRate: total ? Math.round((d.withCheckout / total) * 100) : null };
  });

  const heat = new Map<string, number>();
  for (const h of data.checkInsByHour ?? []) heat.set(`${h.dow}-${h.hour}`, h.count);
  const heatMax = Math.max(0, ...(data.checkInsByHour ?? []).map((h) => h.count));

  const k = data.kpis;
  const prevSignIns = prev ? prev.signInsOk + prev.signInsFailed : 0;
  const signInsPeriod = (data.signInsByDay ?? []).reduce((n, d) => n + d.ok + d.failed, 0);
  const signInsOkPeriod = (data.signInsByDay ?? []).reduce((n, d) => n + d.ok, 0);
  const checkOutsPeriod = (data.checkInsByDay ?? []).reduce((n, d) => n + d.withCheckout, 0);
  const compare = prev ? [
    { metric: 'Check-ins', now: k.checkInsPeriod, before: prev.checkIns, better: 'up' as const },
    { metric: 'Attendance rate', now: attendanceRate, before: prevAttendanceRate, better: 'up' as const, rate: true },
    { metric: 'Seats expected', now: expected, before: prev.expected, better: 'none' as const },
    { metric: 'Check-out rate', now: share(checkOutsPeriod, k.checkInsPeriod), before: share(prev.checkOuts, prev.checkIns), better: 'up' as const, rate: true },
    { metric: 'Failed check-in attempts', now: k.checkInFailedAttemptsPeriod ?? 0, before: prev.failedAttempts, better: 'down' as const },
    { metric: 'Sign-in attempts', now: signInsPeriod, before: prevSignIns, better: 'none' as const },
    { metric: 'Sign-in success', now: share(signInsOkPeriod, signInsPeriod), before: share(prev.signInsOk, prevSignIns), better: 'up' as const, rate: true },
  ] : [];

  return {
    hasTrends: data.attendanceByDay !== undefined,
    attendanceByDay, expected, attended, attendanceRate, prevAttendanceRate, emptyClasses, classesHeld,
    courses, students, atRisk, neverAttended, activeStudents, distribution,
    lateness, onTimeShare, hours, failureTrend, signInTrend, signInRateByDay, onboarding, checkoutByDay,
    heat, heatMax, compare,
  };
}
export type Trends = ReturnType<typeof deriveTrends>;

export type Severity = 'bad' | 'warn' | 'good';
export interface Insight { severity: Severity; title: string; detail: string; widget?: string }

const p = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);

/**
 * The findings at the top of the page: each names a problem, how big it is, the most likely cause
 * and where to look. Worst first. Thresholds are the same ones the headline tiles use.
 */
export function buildInsights(data: PilotAnalytics, t: Trends): Insight[] {
  const out: Insight[] = [];
  const k = data.kpis;

  // Onboarding.
  const notSignedIn = k.students - k.signedIn;
  if (k.students > 0 && k.signedIn / k.students < 0.8) {
    out.push({
      severity: k.signedIn / k.students < 0.4 ? 'bad' : 'warn',
      title: `${notSignedIn.toLocaleString()} students (${p(notSignedIn / k.students)}) have never signed in on a phone`,
      detail: `Only ${k.signedIn.toLocaleString()} of ${k.students.toLocaleString()} are set up. They cannot check in until they do.${k.signedIn > k.termsAccepted ? ` ${(k.signedIn - k.termsAccepted).toLocaleString()} signed in but have not accepted the terms yet.` : ''}${k.termsAccepted > k.baselineCaptured ? ` ${(k.termsAccepted - k.baselineCaptured).toLocaleString()} stopped before taking the baseline photo.` : ''}`,
      widget: 'funnel',
    });
  }

  // Attendance.
  if (t.attendanceRate != null && t.expected >= 10) {
    const trend = t.prevAttendanceRate != null ? ` (previous period ${p(t.prevAttendanceRate)})` : '';
    if (t.attendanceRate < 0.75) {
      out.push({
        severity: t.attendanceRate < 0.5 ? 'bad' : 'warn',
        title: `Attendance is ${p(t.attendanceRate)}${trend}`,
        detail: `${t.attended.toLocaleString()} check-ins out of ${t.expected.toLocaleString()} seats expected across ${t.classesHeld.toLocaleString()} classes. ${t.neverAttended.length ? `${t.neverAttended.length.toLocaleString()} enrolled students did not attend a single class.` : ''}`,
        widget: 'attendance-trend',
      });
    } else if (t.prevAttendanceRate != null && t.attendanceRate < t.prevAttendanceRate - 0.1) {
      out.push({ severity: 'warn', title: `Attendance fell from ${p(t.prevAttendanceRate)} to ${p(t.attendanceRate)}`, detail: 'Compared with the previous period of the same length.', widget: 'period-compare' });
    }
  }

  // Check-in failures and their main cause.
  const tried = (k.checkInFirstTryPeriod ?? 0) + (k.checkInRetriedPeriod ?? 0) + (k.checkInGaveUpPeriod ?? 0);
  if ((k.checkInGaveUpPeriod ?? 0) > 0 || (k.checkInFailedAttemptsPeriod ?? 0) > 0) {
    const top = [...t.failureTrend.totals.entries()].sort((a, b) => b[1] - a[1]);
    const totalFails = top.reduce((n, [, c]) => n + c, 0);
    const cause = top[0] ? ` The main reason is "${top[0][0]}" (${p(top[0][1] / totalFails)} of failures)${top[1] ? `, then "${top[1][0]}" (${p(top[1][1] / totalFails)})` : ''}.` : '';
    const weak = top.find(([r]) => r === 'Signal too weak' || r === 'Wrong or missing beacon');
    const fix = weak && weak[1] / totalFails >= 0.3 ? ' Most of these are beacon range problems: check the beacon is powered and placed in the room, or relax the class threshold.' : '';
    out.push({
      severity: (k.checkInGaveUpPeriod ?? 0) > 0 && (k.checkInSuccessRate ?? 1) < 0.85 ? 'bad' : 'warn',
      title: `${(k.checkInGaveUpPeriod ?? 0).toLocaleString()} student-class check-ins never went through; ${(k.checkInRetriedPeriod ?? 0).toLocaleString()} needed retries`,
      detail: `${(k.checkInFailedAttemptsPeriod ?? 0).toLocaleString()} failed attempts. Success rate ${p(k.checkInSuccessRate)} of ${tried.toLocaleString()} tries.${cause}${fix}`,
      widget: 'failure-trend',
    });
  }

  // Worst courses.
  const weakCourses = t.courses.filter((c) => c.rate != null && c.expected >= 5 && c.rate < 0.6).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
  if (weakCourses.length) {
    out.push({
      severity: weakCourses.some((c) => (c.rate ?? 0) < 0.4) ? 'bad' : 'warn',
      title: `${weakCourses.length} course${weakCourses.length === 1 ? '' : 's'} under 60% attendance`,
      detail: weakCourses.slice(0, 4).map((c) => `${c.code} ${p(c.rate)} (${c.lecturer}${c.gaveUp ? `, ${c.gaveUp} gave up` : ''})`).join('; ') + (weakCourses.length > 4 ? '; …' : '') + '.',
      widget: 'courses',
    });
  }
  const noClasses = t.courses.filter((c) => c.classesHeld === 0 && c.enrolled > 0);
  if (noClasses.length && t.courses.length) {
    out.push({ severity: 'warn', title: `${noClasses.length} course${noClasses.length === 1 ? ' has' : 's have'} students but held no classes in this period`, detail: noClasses.slice(0, 6).map((c) => c.code).join(', ') + '. Check the timetable is loaded.', widget: 'courses' });
  }
  if (t.emptyClasses > 0) {
    out.push({ severity: t.emptyClasses / Math.max(1, t.classesHeld) > 0.2 ? 'bad' : 'warn', title: `${t.emptyClasses} class${t.emptyClasses === 1 ? '' : 'es'} had nobody check in`, detail: 'Either the class did not happen, the beacon was missing or off, or students could not get in. See Classes.', widget: 'classes' });
  }

  // Students at risk.
  if (t.atRisk.length) {
    const failing = t.atRisk.filter((s) => s.failedAttempts > 0).length;
    const notSet = t.atRisk.filter((s) => !s.signedIn).length;
    out.push({
      severity: t.atRisk.length / Math.max(1, t.students.length) > 0.3 ? 'bad' : 'warn',
      title: `${t.atRisk.length.toLocaleString()} students are under ${p(AT_RISK)} attendance`,
      detail: `${notSet ? `${notSet.toLocaleString()} of them have not signed in on a phone. ` : ''}${failing ? `${failing.toLocaleString()} tried to check in and failed at least once. ` : ''}${t.atRisk.length - notSet - failing > 0 ? 'The rest are signed in and never tried, so they are most likely not coming to class.' : ''}`,
      widget: 'students-at-risk',
    });
  }

  // Lateness.
  if (t.onTimeShare != null && t.onTimeShare < 0.8) {
    out.push({ severity: t.onTimeShare < 0.6 ? 'bad' : 'warn', title: `Only ${p(t.onTimeShare)} of check-ins are within 15 minutes of the start`, detail: 'Students are arriving late, or the check-in only works for them well after the class has started.', widget: 'lateness' });
  }

  // Check-outs.
  if (k.checkOutRate != null && k.checkInsPeriod >= 10 && k.checkOutRate < 0.5) {
    out.push({ severity: 'warn', title: `Only ${p(k.checkOutRate)} of check-ins also checked out`, detail: 'Students leave without checking out, so their time in class cannot be confirmed.', widget: 'checkins-per-day' });
  }

  // Sign-ins.
  const signTotals = [...t.signInTrend.totals.entries()].sort((a, b) => b[1] - a[1]);
  const failedSignIns = signTotals.reduce((n, [, c]) => n + c, 0);
  const okSignIns = (data.signInsByDay ?? []).reduce((n, d) => n + d.ok, 0);
  if (failedSignIns >= 5 && failedSignIns / (failedSignIns + okSignIns) > 0.15) {
    out.push({
      severity: failedSignIns / (failedSignIns + okSignIns) > 0.35 ? 'bad' : 'warn',
      title: `${p(failedSignIns / (failedSignIns + okSignIns))} of sign-in attempts fail`,
      detail: `${failedSignIns.toLocaleString()} failed. Top reasons: ${signTotals.slice(0, 3).map(([r, c]) => `${r} (${c})`).join(', ')}.`,
      widget: 'signin-trend',
    });
  }
  if (k.pinLockedNow > 0) out.push({ severity: 'bad', title: `${k.pinLockedNow} student${k.pinLockedNow === 1 ? ' is' : 's are'} locked out right now`, detail: 'They typed a wrong PIN 5 times. Unlock or reset them in Needs help now.', widget: 'needs-help' });
  if (k.pendingDeviceChanges > 0) out.push({ severity: 'warn', title: `${k.pendingDeviceChanges} phone change${k.pendingDeviceChanges === 1 ? '' : 's'} waiting for approval`, detail: 'Those students cannot check in from their new phone until it is approved in Verification.', widget: 'device-events' });
  const openTickets = data.tickets.filter((x) => !['RESOLVED', 'CLOSED'].includes(x.status)).length;
  if (openTickets > 0) out.push({ severity: 'warn', title: `${openTickets} support ticket${openTickets === 1 ? '' : 's'} not answered`, detail: 'Students are waiting for a reply.', widget: 'tickets' });

  const order: Record<Severity, number> = { bad: 0, warn: 1, good: 2 };
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  if (!out.length) out.push({ severity: 'good', title: 'Nothing is failing in this period', detail: 'Attendance, check-ins and sign-ins are all within healthy ranges.' });
  return out;
}
