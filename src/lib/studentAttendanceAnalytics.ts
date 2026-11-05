import { csvField } from './csv';
import { formatCheckInTypeShort } from '../utils/checkInTypeLabel';

/*
 * Student profile → course attendance analytics (11-05). Pure helpers: filter a student's expected
 * sessions (GET /users/:id/attendance-sessions) by year / course, roll them up by week or month and
 * by course, and build the CSV. The rate is attended ÷ expected, the same definition the profile's
 * Course Attendance table and every report use (server reportMetrics.service.ts).
 */

export type SessionState = 'ATTENDED' | 'INCOMPLETE' | 'ABSENT';
export type Grouping = 'week' | 'month';

export interface StudentSession {
  classId: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  title: string;
  /** The class's own calendar day, YYYY-MM-DD. */
  date: string;
  startTime: string;
  room: string | null;
  termId: string | null;
  termName: string | null;
  state: SessionState;
  rejectedAttempt: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInType: string | null;
  punctuality: 'ON_TIME' | 'LATE' | 'EXTREMELY_LATE' | 'MANUAL' | null;
  checkOut: 'CHECKED_OUT' | 'MISSING' | 'OPEN' | null;
}

export interface SessionsResponse {
  sessions: StudentSession[];
  generatedAt: string;
}

/** Minimal shape of a GET /users/:id/attendance-history record used by the fallback below. */
export interface HistoryLike {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInType: string;
  status: string;
  class: ({ title: string; room: string | null; date?: string; startTime?: string; course: { id?: string; name: string; code: string } }) | null;
  termId: string | null;
  termName: string | null;
}

/**
 * Fallback for a server that doesn't have /attendance-sessions yet: check-ins only. Absences can't
 * be known from check-ins alone, so the page labels rates as unavailable instead of showing 100%.
 */
export function sessionsFromHistory(history: HistoryLike[]): StudentSession[] {
  return history
    .filter((h) => h.status === 'PRESENT' && h.class)
    .map((h) => ({
      classId: h.id,
      courseId: h.class!.course.id ?? h.class!.course.code,
      courseName: h.class!.course.name,
      courseCode: h.class!.course.code,
      title: h.class!.title,
      date: (h.class!.date ?? h.checkInAt).slice(0, 10),
      startTime: h.class!.startTime ?? h.checkInAt,
      room: h.class!.room,
      termId: h.termId,
      termName: h.termName,
      state: 'ATTENDED' as const,
      rejectedAttempt: false,
      checkInAt: h.checkInAt,
      checkOutAt: h.checkOutAt,
      checkInType: h.checkInType,
      punctuality: null,
      checkOut: h.checkOutAt ? 'CHECKED_OUT' as const : null,
    }));
}

export interface Rollup {
  expected: number;
  attended: number;
  incomplete: number;
  absent: number;
  late: number;
  checkedOut: number;
  missingCheckOut: number;
  /** attended ÷ expected, 0–100 with one decimal; null when nothing was expected. */
  rate: number | null;
}

export function rollup(sessions: StudentSession[]): Rollup {
  const r = { expected: 0, attended: 0, incomplete: 0, absent: 0, late: 0, checkedOut: 0, missingCheckOut: 0 };
  for (const s of sessions) {
    r.expected++;
    if (s.state === 'ATTENDED') r.attended++;
    else if (s.state === 'INCOMPLETE') r.incomplete++;
    else r.absent++;
    if (s.punctuality === 'LATE' || s.punctuality === 'EXTREMELY_LATE') r.late++;
    if (s.checkOut === 'CHECKED_OUT') r.checkedOut++;
    else if (s.checkOut === 'MISSING') r.missingCheckOut++;
  }
  return { ...r, rate: r.expected > 0 ? Math.round((r.attended / r.expected) * 1000) / 10 : null };
}

export const yearOf = (s: StudentSession) => Number(s.date.slice(0, 4));

/** Years with at least one session, newest first. */
export function yearsIn(sessions: StudentSession[]): number[] {
  return [...new Set(sessions.map(yearOf))].sort((a, b) => b - a);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Week key = the Monday of the class's calendar week (UTC, so a day can never shift). */
function weekStart(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function periodKey(s: StudentSession, g: Grouping): string {
  return g === 'month' ? s.date.slice(0, 7) : weekStart(s.date);
}

export function periodLabel(key: string, g: Grouping, withYear = true): string {
  const y = key.slice(0, 4);
  const m = MONTHS[Number(key.slice(5, 7)) - 1];
  if (g === 'month') return withYear ? `${m} ${y}` : m;
  const day = Number(key.slice(8, 10));
  return withYear ? `Week of ${day} ${m} ${y}` : `${day} ${m}`;
}

export interface PeriodRow extends Rollup { key: string; label: string; shortLabel: string }

/** Oldest → newest, for the trend chart and the per-period table. */
export function byPeriod(sessions: StudentSession[], g: Grouping): PeriodRow[] {
  const groups = new Map<string, StudentSession[]>();
  for (const s of sessions) {
    const k = periodKey(s, g);
    const list = groups.get(k);
    if (list) list.push(s); else groups.set(k, [s]);
  }
  const multiYear = new Set([...groups.keys()].map((k) => k.slice(0, 4))).size > 1;
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, label: periodLabel(key, g), shortLabel: periodLabel(key, g, multiYear), ...rollup(list) }));
}

export interface CourseRow extends Rollup { courseId: string; courseName: string; courseCode: string }

export function byCourse(sessions: StudentSession[]): CourseRow[] {
  const groups = new Map<string, StudentSession[]>();
  for (const s of sessions) {
    const list = groups.get(s.courseId);
    if (list) list.push(s); else groups.set(s.courseId, [s]);
  }
  return [...groups.values()]
    .map((list) => ({ courseId: list[0].courseId, courseName: list[0].courseName, courseCode: list[0].courseCode, ...rollup(list) }))
    .sort((a, b) => a.courseName.localeCompare(b.courseName));
}

/** Plain-words status for one session (no colour coding anywhere). */
export function sessionStatus(s: StudentSession): string {
  if (s.state === 'ABSENT') return s.rejectedAttempt ? 'Absent (attempt rejected)' : 'Absent';
  if (s.state === 'INCOMPLETE') return 'Incomplete (no check-out)';
  if (s.punctuality === 'EXTREMELY_LATE') return 'Attended, very late';
  if (s.punctuality === 'LATE') return 'Attended, late';
  return 'Attended';
}

export function checkInTypeLabel(t: string | null): string {
  return t ? formatCheckInTypeShort(t) : '';
}

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '';
export const fmtDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtRate = (r: number | null) => (r == null ? '—' : `${r}%`);

export interface FilterLabel { year: string; course: string; grouping: string }

/** CSV: a short summary block, the per-course and per-period rollups, then every filtered record. */
export function buildStudentAttendanceCsv(opts: {
  studentName: string;
  studentId: string | null;
  filter: FilterLabel;
  summary: Rollup;
  courses: CourseRow[];
  periods: PeriodRow[];
  records: StudentSession[];
  ratesKnown: boolean;
}): string {
  const line = (cells: (string | number | null | undefined)[]) => cells.map(csvField).join(',');
  const rate = (r: Rollup) => (opts.ratesKnown ? fmtRate(r.rate) : 'n/a');
  const out: string[] = [];
  out.push(line(['Student attendance report']));
  out.push(line(['Student', opts.studentName]));
  if (opts.studentId) out.push(line(['Student ID', opts.studentId]));
  out.push(line(['Year', opts.filter.year]));
  out.push(line(['Course', opts.filter.course]));
  out.push(line(['Grouped by', opts.filter.grouping]));
  out.push(line(['Generated', new Date().toISOString()]));
  if (!opts.ratesKnown) out.push(line(['Note', 'Expected sessions were not available from the server; only check-ins are listed.']));
  out.push('');
  out.push(line(['Summary', 'Expected sessions', 'Attended', 'Incomplete', 'Absent', 'Late arrivals', 'Checked out', 'Missing check-out', 'Attendance rate']));
  const s = opts.summary;
  out.push(line(['Selection', s.expected, s.attended, s.incomplete, s.absent, s.late, s.checkedOut, s.missingCheckOut, rate(s)]));
  out.push('');
  out.push(line(['Course', 'Code', 'Expected sessions', 'Attended', 'Incomplete', 'Absent', 'Late arrivals', 'Attendance rate']));
  for (const c of opts.courses) out.push(line([c.courseName, c.courseCode, c.expected, c.attended, c.incomplete, c.absent, c.late, rate(c)]));
  out.push('');
  out.push(line([opts.filter.grouping === 'By week' ? 'Week' : 'Month', 'Expected sessions', 'Attended', 'Incomplete', 'Absent', 'Late arrivals', 'Attendance rate']));
  for (const p of opts.periods) out.push(line([p.label, p.expected, p.attended, p.incomplete, p.absent, p.late, rate(p)]));
  out.push('');
  out.push(line(['#', 'Date', 'Term', 'Course', 'Code', 'Class', 'Room', 'Check-in', 'Check-in type', 'Check-out', 'Status']));
  opts.records.forEach((r, i) => out.push(line([
    i + 1, r.date, r.termName ?? '', r.courseName, r.courseCode, r.title, r.room ?? '',
    r.checkInAt ?? '', checkInTypeLabel(r.checkInType), r.checkOutAt ?? '', sessionStatus(r),
  ])));
  return '﻿' + out.join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
