import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import type { CampusAnalytics, ClassAttendanceStat, DashboardStats } from '../types';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function afterTableY(doc: jsPDF, fallback: number) {
  const d = doc as JsPdfWithAutoTable;
  return d.lastAutoTable?.finalY ?? fallback;
}

/** Rasterize `/logo.svg` for jsPDF (PNG data URL). */
export async function loadTcheckLogoPngDataUrl(width = 160, height = 160): Promise<string | undefined> {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${base}/logo.svg`);
    if (!res.ok) return undefined;
    const svgText = await res.text();
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image'));
      };
      img.src = url;
    });
  } catch {
    return undefined;
  }
}

function addTcheckHeader(doc: jsPDF, title: string, subtitle?: string) {
  const margin = 40;
  return loadTcheckLogoPngDataUrl(112, 112).then((logo) => {
    let yTitle = 52;
    if (logo) {
      doc.addImage(logo, 'PNG', margin, 28, 44, 44);
      yTitle = 58;
    }
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.text(title, logo ? margin + 56 : margin, yTitle);
    if (subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(subtitle, logo ? margin + 56 : margin, yTitle + 16);
    }
    doc.setTextColor(0, 0, 0);
    return 88;
  });
}

function formatSessionDate(d: ClassAttendanceStat) {
  try {
    const raw = typeof d.date === 'string' ? parseISO(d.date) : new Date(d.date);
    return format(Number.isNaN(raw.getTime()) ? new Date(d.date) : raw, 'MMM d, yyyy');
  } catch {
    return String(d.date);
  }
}

/** PDF of session rows (admin / lecturer attendance list). */
export async function exportSessionLedgerPdf(rows: ClassAttendanceStat[], fileBase = 'tcheck-sessions') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const startY = await addTcheckHeader(doc, 'TCheck — Session attendance', `Generated ${format(new Date(), 'PPpp')}`);

  const body = rows.map((s) => [
    s.title,
    s.course.code,
    s.course.name,
    formatSessionDate(s),
    `${s.course.lecturer.firstName} ${s.course.lecturer.lastName}`,
    `${s.totalCheckedIn} / ${s.totalEnrolled}`,
    `${s.attendanceRate}%`,
    `${s.checkInBreakdown.BLE} / ${s.checkInBreakdown.QR} / ${s.checkInBreakdown.MANUAL}`,
  ]);

  autoTable(doc, {
    startY,
    head: [['Session', 'Code', 'Course', 'Date', 'Lecturer', 'Present / enrolled', 'Rate', 'BLE / QR / Manual']],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${fileBase}.pdf`);
}

/** PDF bundle for campus analytics (KPIs + tables). */
export async function exportCampusAnalyticsPdf(campus: CampusAnalytics, sessions: ClassAttendanceStat[], fileBase = 'tcheck-campus-analytics') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  let y = await addTcheckHeader(
    doc,
    'TCheck — Campus analytics',
    `Scope · ${campus.scopedSchoolId == null ? 'all schools' : campus.scopedSchoolId} · ${format(parseISO(campus.fetchedAtIso), 'PPpp')}`,
  );

  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  const kpiLines = [
    `Overall campus attendance: ${campus.overallAttendancePct}%`,
    `Automated gate blocks (90d): BLE ${campus.blockedGateAttemptsBle} · QR ${campus.blockedGateAttemptsQr}`,
    `Students under 75%: ${campus.atRiskStudentCount}`,
    `Sessions in aggregate: ${campus.sessionCount}`,
  ];
  kpiLines.forEach((line, i) => {
    doc.text(line, 40, y + i * 16);
  });
  let cursorY = y + kpiLines.length * 16 + 24;

  autoTable(doc, {
    startY: cursorY,
    head: [['Student', 'ID', 'Attendance %']],
    body: campus.atRiskStudents.map((s) => [s.displayName, s.studentId, `${s.attendancePct}%`]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [71, 85, 105] },
    margin: { left: 40, right: 40 },
    tableWidth: 'wrap',
  });

  cursorY = afterTableY(doc, cursorY + 120) + 28;

  autoTable(doc, {
    startY: cursorY,
    head: [['Session', 'Course', 'Date', 'Lecturer', 'Present / enrolled', 'Rate']],
    body: sessions.slice(0, 80).map((s) => [
      s.title,
      s.course.code,
      formatSessionDate(s),
      `${s.course.lecturer.firstName} ${s.course.lecturer.lastName}`,
      `${s.totalCheckedIn} / ${s.totalEnrolled}`,
      `${s.attendanceRate}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${fileBase}.pdf`);
}

/** Overview dashboard snapshot PDF. */
export async function exportAttendanceOverviewPdf(stats: DashboardStats, classStats: ClassAttendanceStat[], fileBase = 'tcheck-overview') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const startY = await addTcheckHeader(doc, 'TCheck — Attendance overview', `Generated ${format(new Date(), 'PPpp')}`);

  const summaryBody = [
    ['Total students', String(stats.totalStudents)],
    ['Total lecturers', String(stats.totalLecturers)],
    ['Courses', String(stats.totalCourses)],
    ['Scheduled classes', String(stats.totalClasses)],
    ['Check-ins today', String(stats.todayAttendances)],
    ['Pending approvals', String(stats.pendingApprovals)],
  ];

  autoTable(doc, {
    startY,
    head: [['Metric', 'Value']],
    body: summaryBody,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [51, 65, 85] },
    margin: { left: 40, right: 40 },
  });

  const nextY = afterTableY(doc, startY + 200) + 28;

  autoTable(doc, {
    startY: nextY,
    head: [['Session', 'Course', 'Rate', 'Present / enrolled']],
    body: classStats.slice(0, 60).map((s) => [
      s.title,
      s.course.code,
      `${s.attendanceRate}%`,
      `${s.totalCheckedIn} / ${s.totalEnrolled}`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${fileBase}.pdf`);
}
