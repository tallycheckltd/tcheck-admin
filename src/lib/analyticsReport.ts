import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { addTcheckHeader, afterTableY } from './adminPdfExport';
import { FAILURE_REASON_LABEL, CHECKIN_CHANNEL_LABEL, DEVICE_EVENT_LABEL, type PilotAnalytics } from './pilotAnalytics';
import { shortReason, type Insight, type Trends } from './analyticsInsights';

/*
 * Analytics report downloads (2026-11-04): the whole page as one CSV (every section, one after the
 * other) or a PDF with the TCheck logo, the findings, the charts as they are on screen and the
 * detail tables. Built from the same response and the same derived numbers as the page.
 */

type Cell = string | number | null | undefined;
interface Section { title: string; head: string[]; rows: Cell[][] }

const pc = (r: number | null | undefined) => (r == null ? '' : `${Math.round(r * 100)}%`);
const when = (iso: string | null | undefined, pattern = 'yyyy-MM-dd HH:mm') => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, pattern);
};
const label = (map: Record<string, string>, code: string) => map[code] ?? code.replace(/_/g, ' ').toLowerCase();

export function reportSections(data: PilotAnalytics, t: Trends, insights: Insight[], kpis: { label: string; value: string }[]): Section[] {
  const k = data.kpis;
  return [
    { title: 'Headline numbers', head: ['Number', 'Value'], rows: kpis.map((x) => [x.label, x.value]) },
    { title: 'What is going wrong, and why', head: ['Severity', 'Finding', 'Detail'], rows: insights.map((i) => [i.severity === 'bad' ? 'Needs attention' : i.severity === 'warn' ? 'Watch' : 'Good', i.title, i.detail]) },
    {
      title: 'This period vs the one before', head: ['Metric', 'This period', 'Previous period', 'Change'],
      rows: t.compare.map((c) => {
        const fmt = (v: number | null) => (v == null ? '' : c.rate ? pc(v) : v.toLocaleString());
        const ch = c.now == null || c.before == null ? '' : c.rate ? `${Math.round((c.now - c.before) * 100)} pts` : c.before ? `${Math.round(((c.now - c.before) / c.before) * 100)}%` : '';
        return [c.metric, fmt(c.now), fmt(c.before), ch];
      }),
    },
    {
      title: 'Onboarding', head: ['Step', 'Students', 'Share'],
      rows: [
        ['On the list', k.students, '100%'], ['Signed in on a phone', k.signedIn, pc(k.students ? k.signedIn / k.students : null)],
        ['Accepted the terms', k.termsAccepted, pc(k.students ? k.termsAccepted / k.students : null)],
        ['Took the baseline photo', k.baselineCaptured, pc(k.students ? k.baselineCaptured / k.students : null)],
        ['PIN-locked now', k.pinLockedNow, ''], ['Pending phone changes', k.pendingDeviceChanges, ''], ['Closed accounts', k.closedAccounts, ''],
      ],
    },
    { title: 'Onboarding over time (running totals)', head: ['Day', 'Signed in', 'New that day', 'Accepted terms', 'Baseline photo'], rows: t.onboarding.map((d) => [d.day, d.signedIn, d.newSignedIn, d.terms, d.baseline]) },
    { title: 'Attendance by day', head: ['Day', 'Classes held', 'Seats expected', 'Check-ins', 'Attendance rate', 'Students who attended', 'Classes nobody attended'], rows: t.attendanceByDay.map((d) => [d.day, d.classes, d.expected, d.attended, pc(d.rate), d.students, d.emptyClasses]) },
    { title: 'Check-ins by day', head: ['Day', 'Present', 'Late', 'Other', 'Checked out', 'Check-out rate'], rows: t.checkoutByDay.map((d) => [d.day, d.present, d.late, d.other, d.withCheckout, d.checkoutRate == null ? '' : `${d.checkoutRate}%`]) },
    { title: 'Check-in outcomes by day', head: ['Day', 'First try', 'Retried, then in', 'Gave up', 'Failed attempts'], rows: data.checkInOutcomesByDay.map((d) => [d.day, d.firstTry, d.retriedThenIn, d.gaveUp, d.failedAttempts]) },
    { title: 'Check-in failures by day and cause', head: ['Day', ...t.failureTrend.keys], rows: t.failureTrend.rows.map((r) => [String(r.day), ...t.failureTrend.keys.map((key) => Number(r[key] ?? 0))]) },
    { title: 'Why check-ins failed', head: ['Reason', 'Cause', 'How', 'Attempts', 'Students affected'], rows: data.checkInFailureReasons.map((r) => [r.reason, shortReason(r.reason), CHECKIN_CHANNEL_LABEL[r.channel] ?? r.channel, r.count, r.students]) },
    {
      title: 'Courses', head: ['Code', 'Course', 'Lecturer', 'Enrolled', 'Classes held', 'Seats expected', 'Check-ins', 'Attendance', 'Late', 'Check-out rate', 'Failed attempts', 'Students failing', 'Gave up', 'Avg signal (dBm)'],
      rows: [...t.courses].sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2)).map((c) => [c.code, c.name, c.lecturer, c.enrolled, c.classesHeld, c.expected, c.checkins, pc(c.rate), c.late, pc(c.checkoutShare), c.failedAttempts, c.studentsFailing, c.gaveUp, c.avgRssi]),
    },
    {
      title: 'Students (lowest attendance first)', head: ['Student ID', 'Name', 'Expected', 'Attended', 'Attendance', 'Signed in', 'Baseline', 'PIN locked', 'Failed attempts', 'Last error', 'Last check-in', 'Phone'],
      rows: t.students.map((s) => [s.studentId, s.name, s.expected, s.attended, pc(s.rate), s.signedIn ? 'Yes' : 'No', s.baseline ? 'Yes' : 'No', s.pinLocked ? 'Yes' : 'No', s.failedAttempts, s.lastFailReason ?? '', when(s.lastCheckInAt), s.phone ?? '']),
    },
    { title: 'Students by attendance', head: ['Band', 'Students'], rows: t.distribution.map((d) => [d.band, d.count]) },
    { title: 'Time of day', head: ['Hour', 'Check-ins', 'Failed attempts'], rows: t.hours.map((h) => [h.label, h.checkins, h.failures]) },
    { title: 'How late students check in', head: ['Minutes after start', 'Check-ins'], rows: t.lateness.map((l) => [l.label, l.count]) },
    { title: 'Beacon signal at check-in', head: ['Signal (dBm)', 'Check-ins'], rows: [...data.rssiBuckets].sort((a, b) => a.rssi - b.rssi).map((b) => [`${b.rssi} to ${b.rssi + 4}`, b.count]) },
    { title: 'Beacon signal by day', head: ['Day', 'Average', 'Weakest', 'Strongest', 'Average on failed attempts'], rows: (data.rssiByDay ?? []).map((d) => [d.day, d.avg, d.min, d.max, d.failAvg]) },
    {
      title: 'Classes', head: ['Start', 'End', 'Course', 'Title', 'Room', 'Check-ins', 'Check-outs', 'Failed attempts', 'Gave up', 'Beacon threshold'],
      rows: data.classes.map((c) => [when(c.startTime), when(c.endTime, 'HH:mm'), c.course ?? '', c.title ?? '', c.room ?? '', c.checkins, c.checkouts, c.failedAttempts ?? 0, c.gaveUp ?? 0, c.rssiThreshold ?? '']),
    },
    { title: 'Sign-ins by day', head: ['Day', 'Signed in', 'Failed', 'Success', ...t.signInTrend.keys], rows: t.signInRateByDay.map((d) => [String(d.day), Number(d.ok), Number(d.failed), d.rate == null ? '' : `${d.rate}%`, ...t.signInTrend.keys.map((key) => Number(d[key] ?? 0))]) },
    { title: 'Why sign-ins failed', head: ['Reason', 'Attempts'], rows: data.failureReasons.map((f) => [label(FAILURE_REASON_LABEL, f.reason), f.count]) },
    { title: 'Locked out (wrong PIN)', head: ['Student ID', 'Name', 'Wrong PINs', 'Locked until'], rows: data.lockedStudents.map((s) => [s.studentId, s.name, s.failedAttempts, when(s.lockedUntil)]) },
    { title: 'Phone security events', head: ['Time', 'Event', 'Student ID', 'Name', 'Phone', 'Other student'], rows: data.deviceEvents.map((e) => [when(e.createdAt), label(DEVICE_EVENT_LABEL, e.type), e.studentId, e.name, e.deviceModel, e.otherStudentId]) },
    { title: 'Phone models', head: ['Model', 'Students'], rows: data.deviceModels.map((m) => [m.model, m.count]) },
    { title: 'Closed accounts', head: ['Student ID', 'Name', 'Status', 'When'], rows: data.closedAccounts.map((a) => [a.studentId, a.name, a.status, when(a.updatedAt)]) },
    { title: 'Open support tickets', head: ['Opened', 'Subject', 'Student ID', 'Name', 'Status'], rows: data.tickets.map((x) => [when(x.createdAt), x.subject, x.studentId, x.name, x.status]) },
    { title: 'Escalations', head: ['Reason', 'Status', 'Count'], rows: data.escalations.map((e) => [e.reason, e.status, e.count]) },
  ];
}

const fileBase = (data: PilotAnalytics) => `tcheck-analytics-${(data.school?.code ?? 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${data.days}d-${format(new Date(), 'yyyy-MM-dd-HHmm')}`;
const periodText = (days: number) => ({ 1: 'Today', 90: 'Last 3 months', 182: 'Last 6 months', 365: 'Last 12 months' } as Record<number, string>)[days] ?? `Last ${days} days`;

/** The whole report as one CSV: each section's title, its header row, its rows, then a blank line. */
export function downloadReportCsv(data: PilotAnalytics, sections: Section[]) {
  const cell = (v: Cell) => {
    const s = v == null ? '' : String(v);
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const lines: string[] = [
    cell('TCheck Analytics report'),
    [cell('School'), cell(data.school ? `${data.school.name} (${data.school.code})` : '')].join(','),
    [cell('Period'), cell(periodText(data.days))].join(','),
    [cell('Generated'), cell(when(data.generatedAt, 'yyyy-MM-dd HH:mm:ss'))].join(','),
    '',
  ];
  for (const s of sections) {
    lines.push(cell(s.title), s.head.map(cell).join(','));
    if (!s.rows.length) lines.push(cell('(nothing in this period)'));
    for (const r of s.rows) lines.push(r.map(cell).join(','));
    lines.push('');
  }
  // BOM so Excel opens it as UTF-8 (names, en dashes).
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase(data)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Snapshot every chart on the page (white background, so it prints in dark mode too). */
async function captureCharts(): Promise<{ title: string; img: string; w: number; h: number }[]> {
  const { default: html2canvas } = await import('html2canvas');
  const out: { title: string; img: string; w: number; h: number }[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-chart]'))) {
    if (!el.offsetWidth || !el.querySelector('svg')) continue;
    try {
      // JPEG at 1.6x keeps a 20-chart report to a few MB (PNG at 2x was ~35 MB).
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 1.6, logging: false });
      out.push({ title: el.dataset.chart ?? '', img: canvas.toDataURL('image/jpeg', 0.82), w: canvas.width, h: canvas.height });
    } catch { /* a chart that can't be drawn is left out; its table is still in the report */ }
  }
  return out;
}

const SEV_COLOR: Record<Insight['severity'], [number, number, number]> = { bad: [225, 29, 72], warn: [217, 119, 6], good: [5, 150, 105] };

export async function downloadReportPdf(data: PilotAnalytics, sections: Section[], insights: Insight[]) {
  const charts = await captureCharts();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = await addTcheckHeader(
    doc,
    `Analytics — ${data.school?.name ?? 'School'}`,
    `${periodText(data.days)} · generated ${when(data.generatedAt, 'd MMM yyyy, HH:mm')}`,
  );
  y += 18;
  const ensure = (need: number) => { if (y + need > H - 50) { doc.addPage(); y = 50; } };
  const heading = (text: string) => {
    ensure(40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
    doc.text(text, M, y);
    doc.setFont('helvetica', 'normal');
    y += 10;
  };

  // Headline numbers as a 3-column grid of tiles.
  const kpi = sections[0];
  heading(kpi.title);
  const cols = 3;
  const gap = 8;
  const tw = (W - 2 * M - gap * (cols - 1)) / cols;
  kpi.rows.forEach((r, i) => {
    if (i % cols === 0) { ensure(50); if (i) y += 50; }
    const x = M + (i % cols) * (tw + gap);
    doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y + 4, tw, 42, 6, 6, 'FD');
    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(String(r[0]), x + 8, y + 17);
    doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text(String(r[1]), x + 8, y + 37); doc.setFont('helvetica', 'normal');
  });
  y += 66;

  // Findings.
  heading('What is going wrong, and why');
  y += 6;
  for (const f of insights) {
    const lines = doc.setFontSize(9).splitTextToSize(f.detail, W - 2 * M - 16) as string[];
    const titleLines = doc.setFontSize(10.5).splitTextToSize(f.title, W - 2 * M - 16) as string[];
    const need = titleLines.length * 13 + lines.length * 11 + 12;
    ensure(need);
    doc.setFillColor(...SEV_COLOR[f.severity]);
    doc.rect(M, y - 8, 3, need - 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(15, 23, 42);
    doc.text(titleLines, M + 10, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    doc.text(lines, M + 10, y + 2 + titleLines.length * 13);
    y += need;
  }

  // Charts as they are on screen.
  if (charts.length) {
    doc.addPage(); y = 50;
    heading('Charts');
    y += 6;
    for (const c of charts) {
      const w = W - 2 * M;
      const h = Math.min(260, (c.h / c.w) * w);
      ensure(h + 28);
      doc.setFontSize(10); doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'bold');
      doc.text(c.title, M, y + 4); doc.setFont('helvetica', 'normal');
      doc.addImage(c.img, 'JPEG', M, y + 10, w, h);
      y += h + 26;
    }
  }

  // Detail tables (everything after the headline numbers and findings).
  doc.addPage(); y = 50;
  for (const s of sections.slice(2)) {
    heading(s.title);
    autoTable(doc, {
      startY: y + 4,
      head: [s.head],
      body: s.rows.length ? s.rows.map((r) => r.map((v) => (v == null ? '' : String(v)))) : [[{ content: 'Nothing in this period.', colSpan: s.head.length }]],
      styles: { fontSize: s.head.length > 9 ? 6.5 : 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: M, right: M, top: 50 },
    });
    y = afterTableY(doc, y + 40) + 26;
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`TCheck · ${data.school?.name ?? ''} · confidential`, M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: 'right' });
  }
  doc.save(`${fileBase(data)}.pdf`);
}
