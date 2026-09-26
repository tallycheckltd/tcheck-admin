import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { downloadCsv } from './csv';
import { addTcheckHeader, afterTableY } from './adminPdfExport';
import type { OverviewReport, ProgrammeReport, ReportAttendance, ReportFeedback, ReportCampaigns } from '../types';

/**
 * SBS Phase 6 — report exports. Both formats are built from the exact payload on screen, so they
 * carry the same filters, the same scope (the server already limited it) and the same privacy:
 * feedback only ever as withheld-or-aggregate, never a respondent. No internal ids are exported.
 */

export const rate = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)}%`);
export const score = (v: number | null | undefined, of = 10) => (v == null ? '—' : `${v.toFixed(1)} / ${of}`);
export const dayLabel = (ymd: string) => format(new Date(`${ymd}T12:00:00`), 'd MMM yyyy');
export const periodLabel = (p: { from: string; to: string }) => `${dayLabel(p.from)} – ${dayLabel(p.to)}`;

const ATTENDANCE_HEADERS = ['Sessions', 'Expected', 'Present', 'Attendance %', 'On time', 'Late', 'Very late', 'Manual (no verdict)', 'On-time %', 'Checked out', 'Missing check-out', 'Check-out %', 'Rejected attempts'];
const attendanceCells = (a: ReportAttendance) => [
  a.sessions, a.expected, a.present, a.attendanceRate ?? '', a.onTime, a.late, a.extremelyLate, a.manual, a.onTimeRate ?? '',
  a.checkedOut, a.missingCheckOut, a.checkOutRate ?? '', a.rejected,
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function overviewCsv(r: OverviewReport, scopeLabel: string) {
  downloadCsv(
    `tcheck-executive-overview-${r.period.from}-to-${r.period.to}.csv`,
    ['Scope', 'Period from', 'Period to', 'Level', 'Programme', 'Year', ...ATTENDANCE_HEADERS],
    [
      [scopeLabel, r.period.from, r.period.to, 'Total', '', '', ...attendanceCells(r.attendance)],
      ...r.programmes.map((p) => [scopeLabel, r.period.from, r.period.to, 'Programme', p.name, p.year, ...attendanceCells(p)]),
    ],
  );
}

export function programmeCsv(r: ProgrammeReport) {
  const head = [r.programme.name, r.period.from, r.period.to];
  downloadCsv(
    `tcheck-programme-${slug(r.programme.name)}-${r.period.from}-to-${r.period.to}.csv`,
    ['Programme', 'Period from', 'Period to', 'Level', 'Course', 'Session', 'Session date', 'Facilitator', ...ATTENDANCE_HEADERS],
    [
      [...head, 'Programme', '', '', '', '', ...attendanceCells(r.attendance)],
      ...r.courses.map((c) => [...head, 'Course', `${c.code} ${c.name}`, '', '', c.facilitatorName ?? '', ...attendanceCells(c)]),
      ...r.sessions.map((s) => [...head, 'Session', `${s.courseCode} ${s.courseName}`, s.title, s.date, s.facilitatorName ?? '', ...attendanceCells(s)]),
    ],
  );
}

const METHODOLOGY = [
  'Sessions: classes in the period (by their own calendar day) whose check-in window has closed.',
  'Attendance: delegates recorded present ÷ delegates expected (enrolled by the session\'s end, plus anyone recorded present). Rejected check-in attempts are never counted as attendance.',
  'On time: on-time ÷ check-ins with a punctuality verdict, using each class\'s late thresholds (else the school\'s). Manual check-ins carry no verdict.',
  'Check-out: checked out ÷ delegates whose check-out window has closed.',
  'Feedback is anonymous: no respondent is identified, and figures resting on fewer than 3 responses are withheld.',
];

function metricRows(a: ReportAttendance, prev: ReportAttendance | null, f: ReportFeedback, c: ReportCampaigns) {
  const fc = f.current;
  return [
    ['Attendance', rate(a.attendanceRate), `${a.present} of ${a.expected} expected · ${a.sessions} sessions`, prev ? rate(prev.attendanceRate) : ''],
    ['On-time arrival', rate(a.onTimeRate), `${a.onTime} of ${a.onTime + a.late + a.extremelyLate} with a verdict`, prev ? rate(prev.onTimeRate) : ''],
    ['Check-out completion', rate(a.checkOutRate), `${a.checkedOut} of ${a.checkedOut + a.missingCheckOut} due`, prev ? rate(prev.checkOutRate) : ''],
    ['Session feedback', fc?.overall.average == null ? 'Withheld' : score(fc.overall.average), fc ? `${fc.responses} responses · ${rate(fc.responseRate)} response rate` : 'No sessions', f.previous?.overall.average != null ? score(f.previous.overall.average) : ''],
    ['Campaign response', rate(c.responseRate), `${c.responses} of ${c.recipients} delegates · ${c.campaigns} campaigns`, ''],
    ['Rejected check-in attempts', String(a.rejected), 'Not counted as attendance', prev ? String(prev.rejected) : ''],
  ];
}

async function briefingPdf(opts: {
  title: string; subtitle: string; scopeLabel: string; fileBase: string;
  attendance: ReportAttendance; previous: ReportAttendance | null; previousLabel?: string;
  feedback: ReportFeedback; campaigns: ReportCampaigns;
  tables: { heading: string; head: string[]; body: (string | number)[][] }[];
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = await addTcheckHeader(doc, opts.title, opts.subtitle);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${opts.scopeLabel} · Generated ${format(new Date(), 'd MMM yyyy, HH:mm')}`, margin, y);
  y += 18;

  const heading = (text: string) => {
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(text.toUpperCase(), margin, y); y += 8;
  };

  heading('Summary');
  autoTable(doc, {
    startY: y,
    head: [['Measure', 'Value', 'Basis', opts.previousLabel ?? 'Previous period']],
    body: metricRows(opts.attendance, opts.previous, opts.feedback, opts.campaigns),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 }, 1: { cellWidth: 70 } },
    margin: { left: margin, right: margin },
  });
  y = afterTableY(doc, y) + 22;

  for (const t of opts.tables) {
    if (!t.body.length) continue;
    heading(t.heading);
    autoTable(doc, {
      startY: y, head: [t.head], body: t.body,
      styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: margin, right: margin },
    });
    y = afterTableY(doc, y) + 22;
  }

  heading('Delegate voice');
  doc.setFontSize(9); doc.setTextColor(51, 65, 85);
  const comments = opts.feedback.comments;
  const voice = comments.withheld
    ? [`Comments are withheld until at least ${opts.feedback.minResponses} delegates have responded.`]
    : comments.items.length ? comments.items.slice(0, 12).map((c) => `“${c}”`) : ['No written comments in this period.'];
  y += 6;
  for (const line of voice) {
    const wrapped = doc.splitTextToSize(line, 515);
    if (y + wrapped.length * 12 > 790) { doc.addPage(); y = 50; }
    doc.text(wrapped, margin, y); y += wrapped.length * 12 + 6;
  }
  if (!comments.withheld && comments.items.length) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Unattributed, in alphabetical order · ${Math.min(12, comments.items.length)} of ${comments.total} comments shown.`, margin, y); y += 18;
  }

  heading('How these figures are calculated');
  doc.setFontSize(8); doc.setTextColor(71, 85, 105); y += 6;
  for (const m of METHODOLOGY) {
    const wrapped = doc.splitTextToSize(`• ${m}`, 515);
    if (y + wrapped.length * 11 > 800) { doc.addPage(); y = 50; }
    doc.text(wrapped, margin, y); y += wrapped.length * 11 + 3;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`${opts.title} · ${opts.subtitle} · Page ${i} of ${pages}`, margin, 820);
  }
  doc.save(`${opts.fileBase}.pdf`);
}

const attendanceRow = (label: string, a: ReportAttendance) => [label, a.sessions, `${a.present} / ${a.expected}`, rate(a.attendanceRate), rate(a.onTimeRate), rate(a.checkOutRate)];
const ATT_HEAD = ['', 'Sessions', 'Present / expected', 'Attendance', 'On time', 'Check-out'];

export function overviewPdf(r: OverviewReport, scopeLabel: string) {
  return briefingPdf({
    title: 'Executive Education briefing', subtitle: periodLabel(r.period), scopeLabel,
    fileBase: `tcheck-executive-briefing-${r.period.from}-to-${r.period.to}`,
    attendance: r.attendance, previous: r.previousAttendance, previousLabel: `Previous ${r.period.days} days`,
    feedback: r.feedback, campaigns: r.campaigns,
    tables: [
      { heading: 'Programmes', head: ['Programme', ...ATT_HEAD.slice(1)], body: r.programmes.map((p) => attendanceRow(`${p.name} (${p.year})`, p)) },
      {
        heading: `Sessions below the ${r.attention.threshold}% attendance threshold`,
        head: ['Session', 'Date', 'Present / expected', 'Attendance'],
        body: r.attention.sessionsBelowThreshold.map((s) => [`${s.courseCode} — ${s.title}`, dayLabel(s.date), `${s.present} / ${s.expected}`, rate(s.attendanceRate)]),
      },
      { heading: 'Week by week', head: ['Week of', 'Sessions', 'Present / expected', 'Attendance'], body: r.trend.map((w) => [dayLabel(w.weekStart), w.sessions, `${w.present} / ${w.expected}`, rate(w.attendanceRate)]) },
    ],
  });
}

export function programmePdf(r: ProgrammeReport, scopeLabel: string) {
  return briefingPdf({
    title: `${r.programme.name} (${r.programme.year})`, subtitle: periodLabel(r.period), scopeLabel,
    fileBase: `tcheck-programme-${slug(r.programme.name)}-${r.period.from}-to-${r.period.to}`,
    attendance: r.attendance, previous: null, feedback: r.feedback, campaigns: r.campaigns,
    tables: [
      { heading: 'Courses', head: ['Course', ...ATT_HEAD.slice(1)], body: r.courses.map((c) => attendanceRow(`${c.code} ${c.name}`, c)) },
      {
        heading: 'Sessions',
        head: ['Session', 'Date', 'Present / expected', 'Attendance', 'On time', 'Check-out'],
        body: r.sessions.map((s) => [`${s.courseCode} — ${s.title}`, dayLabel(s.date), `${s.present} / ${s.expected}`, rate(s.attendanceRate), rate(s.onTimeRate), rate(s.checkOutRate)]),
      },
    ],
  });
}
