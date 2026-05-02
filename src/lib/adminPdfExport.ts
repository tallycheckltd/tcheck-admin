import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import type {
  CampusAnalytics,
  ClassAttendanceDetail,
  ClassAttendanceStat,
  CourseAttendanceExportRow,
  DashboardStats,
} from '../types';

/** Roster / at-risk rows from `GET /attendance/roster` (same shape as Reports page). */
export type HodRosterPdfRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  overallAttendancePct: number;
  riskLevel: string;
};

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

/** Semester roster or at-risk list (HOD / admin reports). */
export async function exportHodRosterPdf(
  rows: HodRosterPdfRow[],
  variant: 'semester-roster' | 'at-risk',
  dateFrom: string,
  dateTo: string,
  fileBase?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const label = variant === 'at-risk' ? 'At-risk roster (< 75%)' : 'Semester roster';
  const startY = await addTcheckHeader(
    doc,
    `TCheck — ${label}`,
    `Date range ${dateFrom} → ${dateTo} · Generated ${format(new Date(), 'PPpp')}`,
  );

  autoTable(doc, {
    startY,
    head: [['Student ID', 'First name', 'Last name', 'Email', 'Attendance %', 'Risk']],
    body: rows.map((r) => [
      r.studentId,
      r.firstName,
      r.lastName,
      r.email,
      `${r.overallAttendancePct}%`,
      r.riskLevel,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${fileBase ?? `tcheck-${variant}`}.pdf`);
}

/** API returns `classDate` as full ISO (`toISOString()`); date-only `YYYY-MM-DD` is also supported. */
function formatExportClassDate(classDate: string): string {
  if (!classDate) return '';
  if (classDate.length >= 10 && classDate[4] === '-' && classDate[10] === 'T') {
    const d = parseISO(classDate);
    return Number.isNaN(d.getTime()) ? classDate.slice(0, 10) : format(d, 'yyyy-MM-dd');
  }
  const d = parseISO(`${classDate}T12:00:00`);
  return Number.isNaN(d.getTime()) ? classDate : format(d, 'yyyy-MM-dd');
}

/** Course-level attendance records (line items). */
export async function exportCourseRecordsPdf(
  rows: CourseAttendanceExportRow[],
  courseLabel: string,
  dateFrom: string,
  dateTo: string,
  fileBase?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const startY = await addTcheckHeader(
    doc,
    'TCheck — Course attendance records',
    `${courseLabel} · ${dateFrom} → ${dateTo} · Generated ${format(new Date(), 'PPpp')}`,
  );

  autoTable(doc, {
    startY,
    head: [['Class', 'Date', 'Room', 'Student ID', 'Name', 'Check-in', 'Check-out', 'Method', 'Punctuality']],
    body: rows.map((r) => [
      r.classTitle,
      formatExportClassDate(r.classDate),
      r.room ?? '',
      r.studentId ?? '',
      `${r.firstName} ${r.lastName}`.trim(),
      format(parseISO(r.checkInAt), 'yyyy-MM-dd HH:mm'),
      r.checkOutAt ? format(parseISO(r.checkOutAt), 'yyyy-MM-dd HH:mm') : '',
      String(r.checkInType),
      r.punctuality,
    ]),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 36, right: 36 },
  });

  doc.save(`${fileBase ?? 'tcheck-course-records'}.pdf`);
}

/** Lecturer: single session present roster (+ absent list). */
export async function exportLecturerSessionDetailPdf(detail: ClassAttendanceDetail, fileBase?: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const dateStr = format(parseISO(`${detail.classInfo.date}T12:00:00`), 'MMM d, yyyy');
  const startY = await addTcheckHeader(
    doc,
    'TCheck — Session attendance report',
    `${detail.classInfo.title} · ${detail.classInfo.courseCode} · ${dateStr}`,
  );

  let y = startY;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Enrolled: ${detail.totalEnrolled} · Present: ${detail.totalCheckedIn} · Absent: ${detail.absentStudents.length}`, 40, y);
  y += 28;

  autoTable(doc, {
    startY: y,
    head: [['Student ID', 'Name', 'Check-in', 'Check-out', 'Method', 'Status', 'Punctuality']],
    body: detail.attendances.map((r) => [
      r.user?.studentId ?? '—',
      `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
      format(parseISO(r.checkInAt), 'MMM d HH:mm'),
      r.checkOutAt ? format(parseISO(r.checkOutAt), 'MMM d HH:mm') : '—',
      String(r.checkInType),
      r.status,
      r.punctuality ?? '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    margin: { left: 40, right: 40 },
  });

  y = afterTableY(doc, y + 200) + 24;

  if (detail.absentStudents.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28);
    doc.text(`Absent students (${detail.absentStudents.length})`, 40, y);
    y += 18;
    autoTable(doc, {
      startY: y,
      head: [['Student ID', 'Name']],
      body: detail.absentStudents.map((s) => [s.studentId ?? '—', `${s.firstName} ${s.lastName}`]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [127, 29, 29], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
  }

  const safe =
    fileBase ??
    `tcheck-session-${detail.classInfo.title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'attendance'}`;
  doc.save(`${safe}.pdf`);
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
