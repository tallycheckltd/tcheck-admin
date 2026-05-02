import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Download,
  FileText,
  Filter,
  Search,
  ClipboardList,
  GraduationCap,
  CalendarRange,
  Loader2,
  AlertCircle,
  RefreshCw,
  Table2,
  Building2,
  Sparkles,
} from 'lucide-react';
import type { Course, ClassSession, ClassAttendanceDetail, CourseAttendanceExportRow } from '../../types';
import { api } from '../../lib/api';
import { exportCourseRecordsPdf, exportHodRosterPdf, exportLecturerSessionDetailPdf } from '../../lib/adminPdfExport';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { formatClassCalendarDate } from '../../utils/classDateDisplay';

/* ---- HOD / admin exports (CSV) ---- */
interface RosterRow {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  overallAttendancePct: number;
  riskLevel: string;
}

type HodReportType = '' | 'semester-roster' | 'course-attendance' | 'at-risk';

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

const inputBase =
  'w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/35 ' +
  'bg-[var(--app-elevated-solid)] border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] ' +
  'dark:bg-white/5 dark:border-white/10';

const cardBase =
  'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] shadow-[var(--app-shadow)] dark:bg-white/[0.04] dark:border-white/10';

interface HodReportsViewProps {
  /** SUB_ADMIN-only roster export; SUPER_ADMIN uses course CSV only */
  canUseSemesterRoster: boolean;
  coursesFetchPath: string | null;
  title: string;
  subtitle: string;
}

function HodReportsView({ canUseSemesterRoster, coursesFetchPath, title, subtitle }: HodReportsViewProps) {
  const [reportType, setReportType] = useState<HodReportType>('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultFromDate);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [previewRows, setPreviewRows] = useState<RosterRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const { data: courses, loading: coursesLoading, error: coursesError } = useApi<Course[]>(coursesFetchPath);

  const rosterPreviewEligible =
    canUseSemesterRoster && (reportType === 'semester-roster' || reportType === 'at-risk');

  const loadPreview = useCallback(async () => {
    if (!rosterPreviewEligible) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const rows = await api.get<RosterRow[]>(`/attendance/roster?from=${dateFrom}&to=${dateTo}`);
      setPreviewRows(rows?.slice(0, 12) ?? []);
    } catch {
      setPreviewRows(null);
      setPreviewError('Could not load roster preview. Check dates and permissions.');
    } finally {
      setPreviewLoading(false);
    }
  }, [dateFrom, dateTo, rosterPreviewEligible]);

  useEffect(() => {
    if (rosterPreviewEligible) loadPreview();
    else {
      setPreviewRows(null);
      setPreviewError('');
    }
  }, [rosterPreviewEligible, loadPreview]);

  const handleExport = async () => {
    if (!reportType) {
      setExportError('Choose a report type.');
      return;
    }
    if (reportType === 'course-attendance' && !selectedCourse) {
      setExportError('Select a course for this export.');
      return;
    }
    if ((reportType === 'semester-roster' || reportType === 'at-risk') && !canUseSemesterRoster) {
      setExportError('Semester roster exports are limited to school administrators.');
      return;
    }

    setExporting(true);
    setExportError('');

    try {
      if (reportType === 'semester-roster' || reportType === 'at-risk') {
        const rows = await api.get<RosterRow[]>(`/attendance/roster?from=${dateFrom}&to=${dateTo}`);
        if (!rows || rows.length === 0) {
          setExportError('No roster rows for this date range.');
          return;
        }

        const filtered =
          reportType === 'at-risk'
            ? rows.filter((r) => r.overallAttendancePct < 75).sort((a, b) => a.overallAttendancePct - b.overallAttendancePct)
            : rows;

        if (filtered.length === 0) {
          setExportError('No rows match this export (try widening the date range).');
          return;
        }

        await exportHodRosterPdf(
          filtered,
          reportType === 'at-risk' ? 'at-risk' : 'semester-roster',
          dateFrom,
          dateTo,
          `tcheck-${reportType}-${dateTo}`,
        );
      } else if (reportType === 'course-attendance' && selectedCourse) {
        const rows = await api.get<CourseAttendanceExportRow[]>(
          `/attendance/course-records?courseId=${selectedCourse}&from=${dateFrom}&to=${dateTo}`,
        );
        if (!rows?.length) {
          setExportError('No attendance rows for this course and range.');
          return;
        }
        const courseMeta = courses?.find((c) => c.id === selectedCourse);
        const courseLabel = courseMeta ? `${courseMeta.code} — ${courseMeta.name}` : selectedCourse;
        await exportCourseRecordsPdf(rows, courseLabel, dateFrom, dateTo, `tcheck-course-${selectedCourse}-${dateTo}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(
        msg && msg !== 'Request failed'
          ? msg
          : 'Export failed. Verify role, course, and date range. Use Chrome or Edge if download is blocked.',
      );
    } finally {
      setExporting(false);
    }
  };

  const atRiskCount =
    previewRows?.filter((r) => r.overallAttendancePct < 75).length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 max-w-6xl">
      <div className="xl:col-span-5 space-y-4">
        <div className={clsx(cardBase, 'p-6 space-y-5')}>
          <div>
            <h2 className="text-sm font-bold text-[var(--app-text)] flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
              {title}
            </h2>
            <p className="text-xs text-[var(--app-text-muted)] mt-1 leading-relaxed">{subtitle}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-1.5">
              <Filter size={12} aria-hidden />
              Report type
            </label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as HodReportType);
                setExportError('');
              }}
              className={inputBase}
            >
              <option value="">Select type…</option>
              {canUseSemesterRoster && (
                <>
                  <option value="semester-roster">Semester master roster</option>
                  <option value="at-risk">At-risk students (&lt; 75%)</option>
                </>
              )}
              <option value="course-attendance">Course attendance (line-level)</option>
            </select>
            {!canUseSemesterRoster && (
              <p className="text-[11px] text-[var(--app-text-muted)] leading-snug">
                Global admins: use <strong>course attendance</strong> per course. School-wide roster CSV is available to school admins.
              </p>
            )}
          </div>

          {reportType === 'course-attendance' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-1.5">
                <GraduationCap size={12} aria-hidden />
                Course
              </label>
              {coursesLoading ? (
                <div className={clsx(inputBase, 'flex items-center gap-2 text-[var(--app-text-muted)]')}>
                  <Loader2 size={16} className="animate-spin" />
                  Loading courses…
                </div>
              ) : coursesError ? (
                <p className="text-xs text-red-600 dark:text-red-400">{coursesError}</p>
              ) : (
                <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className={inputBase}>
                  <option value="">Select course…</option>
                  {courses?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                      {(c as Course & { school?: { name?: string } }).school?.name
                        ? ` (${(c as Course & { school?: { name?: string } }).school!.name})`
                        : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-1.5">
              <CalendarRange size={12} aria-hidden />
              Date range
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputBase} aria-label="From date" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputBase} aria-label="To date" />
            </div>
          </div>

          <Button onClick={() => void handleExport()} disabled={!reportType || exporting} className="w-full justify-center gap-2 py-3">
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {exporting ? 'Building PDF…' : 'Download PDF'}
          </Button>
          {exportError && (
            <div className="flex gap-2 text-xs text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {exportError}
            </div>
          )}
        </div>
      </div>

      <div className="xl:col-span-7 space-y-4">
        <div className={clsx(cardBase, 'overflow-hidden')}>
          <div className="border-b border-[var(--app-border-soft)] dark:border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Table2 size={18} className="text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--app-text)]">Preview</h3>
                <p className="text-xs text-[var(--app-text-muted)]">
                  {rosterPreviewEligible
                    ? `First rows from roster (${dateFrom} → ${dateTo})`
                    : reportType === 'course-attendance'
                      ? 'PDF includes every check-in row for the course and date range.'
                      : 'Pick a report to see guidance here.'}
                </p>
              </div>
            </div>
            {rosterPreviewEligible && (
              <button
                type="button"
                onClick={() => loadPreview()}
                disabled={previewLoading}
                className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-[var(--app-border-soft)] hover:bg-[var(--nav-hover-bg)] disabled:opacity-50"
              >
                <RefreshCw size={14} className={previewLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            )}
          </div>

          <div className="p-5">
            {!rosterPreviewEligible && reportType !== 'course-attendance' && (
              <div className="flex flex-col items-center justify-center text-center py-14 px-4">
                <Sparkles className="text-amber-400 mb-3" size={36} />
                <p className="text-sm font-medium text-[var(--app-text)]">Exports are PDF with TCheck branding</p>
                <p className="text-xs text-[var(--app-text-muted)] mt-2 max-w-md leading-relaxed">
                  Roster and at-risk views pull from your school’s approved students. Course exports include class title, room,
                  punctuality, and check-in method for auditing.
                </p>
              </div>
            )}

            {reportType === 'course-attendance' && (
              <div className="rounded-xl border border-dashed border-[var(--app-border)] dark:border-white/15 p-6 text-center">
                <Building2 className="mx-auto text-[var(--app-text-muted)] mb-2" size={28} />
                <p className="text-sm text-[var(--app-text-secondary)]">
                  Select a course and range, then <strong>Download PDF</strong>. Opens in your browser viewer or Preview.
                </p>
              </div>
            )}

            {rosterPreviewEligible && (
              <>
                {previewLoading && (
                  <div className="flex items-center justify-center gap-2 py-16 text-[var(--app-text-muted)] text-sm">
                    <Loader2 className="animate-spin" size={18} />
                    Loading preview…
                  </div>
                )}
                {previewError && !previewLoading && (
                  <p className="text-sm text-red-600 dark:text-red-400 text-center py-8">{previewError}</p>
                )}
                {!previewLoading && !previewError && previewRows && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/10 px-2.5 py-1 font-medium text-[var(--app-text)]">
                        Sample rows: <strong>{previewRows.length}</strong>
                      </span>
                      {reportType === 'at-risk' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200 px-2.5 py-1 font-medium">
                          &lt; 75% in preview: <strong>{atRiskCount}</strong>
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[var(--app-border-soft)] dark:border-white/10">
                      <table className="w-full text-xs min-w-[520px]">
                        <thead>
                          <tr className="bg-slate-100/90 dark:bg-slate-900/80 text-left text-[var(--app-text-muted)] uppercase tracking-wide">
                            <th className="py-2.5 px-3 font-semibold">Student</th>
                            <th className="py-2.5 px-3 font-semibold">Attendance</th>
                            <th className="py-2.5 px-3 font-semibold">Risk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportType === 'at-risk' ? previewRows.filter((r) => r.overallAttendancePct < 75) : previewRows).map(
                            (r) => (
                              <tr key={`${r.studentId}-${r.email}`} className="border-t border-[var(--app-border-soft)] dark:border-white/10">
                                <td className="py-2.5 px-3 text-[var(--app-text)]">
                                  <div className="font-medium">{r.firstName} {r.lastName}</div>
                                  <div className="text-[var(--app-text-muted)] font-mono text-[10px]">{r.studentId}</div>
                                </td>
                                <td className="py-2.5 px-3 tabular-nums font-semibold">{r.overallAttendancePct}%</td>
                                <td className="py-2.5 px-3">
                                  <Badge color={r.overallAttendancePct < 75 ? 'red' : 'green'}>{r.riskLevel}</Badge>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    {reportType === 'at-risk' && previewRows.filter((r) => r.overallAttendancePct < 75).length === 0 && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 text-center py-2">No at-risk rows in preview window.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Lecturer: session picker + roster table ---- */

function LecturerReportsView() {
  const { user } = useAuth();
  const coursesPath = user?.id ? `/courses?lecturerId=${user.id}` : null;
  const { data: courses, loading: coursesLoading } = useApi<Course[]>(coursesPath);
  const { data: classes, loading: classesLoading } = useApi<ClassSession[]>('/classes');

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [detail, setDetail] = useState<ClassAttendanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);

  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    const courseIds = new Set(courses?.map((co) => co.id) ?? []);
    let filtered = classes.filter((c) => courseIds.has(c.courseId));
    if (sessionSearch.trim()) {
      const q = sessionSearch.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.course?.code?.toLowerCase().includes(q) ||
          c.course?.name?.toLowerCase().includes(q),
      );
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [classes, courses, sessionSearch]);

  const loadRecords = async (classId: string) => {
    setSelectedClassId(classId);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    try {
      const row = await api.get<ClassAttendanceDetail>(`/attendance/class/${classId}`);
      setDetail(row);
    } catch {
      setDetailError('Could not load this session. Refresh or pick another class.');
    } finally {
      setDetailLoading(false);
    }
  };

  const exportSessionPdf = async () => {
    if (!detail) return;
    setPdfExporting(true);
    try {
      const safeTitle = detail.classInfo.title.replace(/[^\w\s-]/g, '').slice(0, 60) || 'session';
      await exportLecturerSessionDetailPdf(detail, `tcheck-session-${safeTitle}`);
    } catch {
      window.alert('Could not generate PDF. Try Chrome or Edge on desktop.');
    } finally {
      setPdfExporting(false);
    }
  };

  const attendanceRate =
    detail && detail.totalEnrolled > 0 ? Math.round((detail.totalCheckedIn / detail.totalEnrolled) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 max-w-6xl">
      <aside className="lg:col-span-4 xl:col-span-3 space-y-3">
        <div className={clsx(cardBase, 'p-4')}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--app-text-muted)] mb-3">Sessions</h3>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none" />
            <input
              type="search"
              placeholder="Search sessions…"
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              className={clsx(inputBase, 'pl-9 text-xs')}
              aria-label="Search sessions"
            />
          </div>
          {(coursesLoading || classesLoading) && (
            <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)] py-6 justify-center">
              <Loader2 className="animate-spin" size={16} />
              Loading…
            </div>
          )}
          {!coursesLoading && !classesLoading && filteredClasses.length === 0 && (
            <p className="text-xs text-center text-[var(--app-text-muted)] py-10 px-2">No classes match filters.</p>
          )}
          <div className="max-h-[min(520px,55vh)] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {filteredClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => loadRecords(cls.id)}
                className={clsx(
                  'w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all border',
                  selectedClassId === cls.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/25'
                    : 'bg-[var(--app-surface-muted)] dark:bg-white/5 text-[var(--app-text-secondary)] border-[var(--app-border-soft)] hover:bg-[var(--nav-hover-bg)]',
                )}
              >
                <div className="font-semibold truncate text-[var(--app-text)] dark:text-white">
                  {cls.course?.code && <span className="opacity-90 mr-1">{cls.course.code}</span>}
                  {cls.title}
                </div>
                <div className={clsx('text-[10px] mt-1', selectedClassId === cls.id ? 'text-blue-100' : 'opacity-65')}>
                  {formatClassCalendarDate(cls.date)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="lg:col-span-8 xl:col-span-9 min-w-0">
        {detailLoading && (
          <div className={clsx(cardBase, 'flex flex-col items-center justify-center py-24 gap-3')}>
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-sm text-[var(--app-text-muted)]">Loading attendance…</p>
          </div>
        )}
        {!detailLoading && detailError && (
          <div className={clsx(cardBase, 'p-8 text-center')}>
            <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
            <p className="text-sm text-red-700 dark:text-red-300">{detailError}</p>
            <Button variant="secondary" className="mt-4" onClick={() => selectedClassId && loadRecords(selectedClassId)}>
              Try again
            </Button>
          </div>
        )}
        {!detailLoading && !detailError && detail && (
          <div className="space-y-5">
            <div
              className={clsx(
                cardBase,
                'p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4',
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">Session</p>
                <h2 className="text-lg sm:text-xl font-bold text-[var(--app-text)] mt-1 truncate">{detail.classInfo.title}</h2>
                <p className="text-xs text-[var(--app-text-muted)] mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  <Badge color="blue">{detail.classInfo.courseCode}</Badge>
                  <span>{detail.classInfo.courseName}</span>
                  <span aria-hidden>·</span>
                  <span>{format(parseISO(`${detail.classInfo.date}T12:00:00`), 'MMM d, yyyy')}</span>
                  {detail.classInfo.room && (
                    <>
                      <span aria-hidden>·</span>
                      <span>Room {detail.classInfo.room}</span>
                    </>
                  )}
                </p>
              </div>
              <Button
                onClick={() => void exportSessionPdf()}
                variant="secondary"
                size="sm"
                className="shrink-0 gap-2 self-start"
                disabled={pdfExporting}
              >
                <Download size={14} className={pdfExporting ? 'animate-pulse' : ''} />
                {pdfExporting ? 'PDF…' : 'Download PDF'}
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Enrolled', value: detail.totalEnrolled, tone: '' },
                { label: 'Present', value: detail.totalCheckedIn, tone: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Absent', value: detail.absentStudents.length, tone: 'text-red-600 dark:text-red-400' },
                { label: 'Rate', value: `${attendanceRate}%`, tone: 'text-blue-600 dark:text-blue-400' },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">{s.label}</p>
                  <p className={clsx('text-2xl font-bold mt-1 tabular-nums', s.tone || 'text-[var(--app-text)]')}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className={clsx(cardBase, 'overflow-hidden')}>
              <div className="border-b border-[var(--app-border-soft)] dark:border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--app-text)]">Present ({detail.attendances.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm gradient-table min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Check-in</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Punctuality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.attendances.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-xs">{r.user?.studentId ?? '—'}</td>
                        <td className="font-medium">
                          {r.user?.firstName} {r.user?.lastName}
                        </td>
                        <td className="text-xs whitespace-nowrap">{format(parseISO(r.checkInAt), 'MMM d HH:mm')}</td>
                        <td>
                          <Badge color={r.checkInType === 'QR' ? 'yellow' : r.checkInType === 'MANUAL' ? 'gray' : 'purple'}>
                            {r.checkInType}
                          </Badge>
                        </td>
                        <td>{r.status}</td>
                        <td>
                          {r.punctuality ? (
                            <Badge
                              color={
                                r.punctuality === 'ON_TIME' ? 'green' : r.punctuality === 'LATE' ? 'yellow' : 'red'
                              }
                            >
                              {r.punctuality.replace(/_/g, ' ')}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {detail.absentStudents.length > 0 && (
              <div className={clsx(cardBase, 'p-5 border-red-500/15 bg-red-500/[0.04] dark:bg-red-950/20')}>
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-3">
                  Absent ({detail.absentStudents.length})
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                  {detail.absentStudents.map((s) => (
                    <li key={s.id} className="rounded-lg border border-red-500/15 dark:border-red-900/35 px-3 py-2">
                      <span className="font-medium text-[var(--app-text)]">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--app-text-muted)] ml-2">{s.studentId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {!detailLoading && !detailError && !detail && (
          <div className={clsx(cardBase, 'py-24 text-center border-dashed')}>
            <FileText size={44} className="mx-auto text-[var(--app-text-muted)] mb-4 opacity-50" />
            <p className="text-sm font-medium text-[var(--app-text-secondary)]">Select a session</p>
            <p className="text-xs text-[var(--app-text-muted)] mt-2 max-w-sm mx-auto">
              Browse your upcoming and past sessions, then download a PDF report with the TCheck logo.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const isSubAdmin = role === 'SUB_ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  /** Course dropdown: Super Admin sees all courses; SUB_ADMIN only their school */
  let hodCoursesFetchPath: string | null = null;
  if (isSuperAdmin) hodCoursesFetchPath = '/courses';
  else if (isSubAdmin && user?.schoolId) hodCoursesFetchPath = `/courses?schoolId=${user.schoolId}`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--app-text)]">Reports</h1>
        <p className="text-sm text-[var(--app-text-muted)] max-w-2xl">
          {isSubAdmin || isSuperAdmin
            ? 'Download audited PDF reports for rosters or individual courses (TCheck logo on every export).'
            : 'Review attendance per teaching session and download PDF reports for your courses.'}
        </p>
      </header>

      {isSubAdmin && !user?.schoolId && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
          <AlertCircle className="shrink-0" size={18} />
          Your administrator account has no school assigned. Course CSV needs a school scope — contact platform support.
        </div>
      )}

      {isSubAdmin || isSuperAdmin ? (
        <HodReportsView
          canUseSemesterRoster={isSubAdmin}
          coursesFetchPath={hodCoursesFetchPath}
          title={isSuperAdmin ? 'Organization exports' : 'School exports'}
          subtitle={
            isSuperAdmin
              ? 'Pull course-level attendance across all linked schools.'
              : 'Scoped to your school. Roster CSV reflects approved students in your institution.'
          }
        />
      ) : (
        <LecturerReportsView />
      )}
    </div>
  );
}
