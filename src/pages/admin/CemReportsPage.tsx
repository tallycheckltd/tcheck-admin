import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { exportCemReportPdf } from '../../lib/adminPdfExport';
import { Download, GraduationCap, ChevronDown, ChevronRight, Users } from 'lucide-react';

interface CemReportStudent {
  id: string; firstName: string; lastName: string; email: string;
  studentId: string | null; jobTitle: string | null; company: string | null;
}
interface CemReportCohort {
  id: string; name: string; studentCount: number; startDate: string | null; endDate: string | null;
  pendingWelcomeCount: number; attendanceRate: number; openTickets: number; resolvedTickets: number;
  students: CemReportStudent[];
}
interface CemReportCem {
  id: string; firstName: string; lastName: string; email: string; totalStudents: number; cohorts: CemReportCohort[];
}

const dateRange = (start: string | null, end: string | null) => {
  if (!start || !end) return 'Not scheduled';
  const f = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return f(start) === f(end) ? f(start) : `${f(start)} – ${f(end)}`;
};

/**
 * Cross-CEM oversight report for Dean/School Admin/executive-tier roles (server-side gate is the
 * source of truth — see cem.routes.ts's GET /cem/report) — "how are my CEMs and programmes doing,
 * with enough detail to actually track them and export it." One card per CEM: their programmes'
 * headline numbers, an expandable full student roster, and a branded PDF export (adminPdfExport.ts's
 * exportCemReportPdf, same TCheck-logo header every other admin PDF uses here).
 */
export function CemReportsPage() {
  const { data, loading } = useApi<{ cems: CemReportCem[] }>('/cem/report');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const cems = data?.cems ?? [];

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCemReportPdf(cems);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CEM & Programmes Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every Client Experience Manager, their programmes, students, and attendance/tickets at a glance.
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || !cems.length}>
          <Download size={16} className="mr-1.5" /> {exporting ? 'Exporting…' : 'Export PDF'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : cems.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No CEMs yet" description="Once a Client Experience Manager is assigned to a programme, their data will appear here." size="md" />
      ) : (
        <div className="space-y-4">
          {cems.map((cem) => (
            <GlassCard key={cem.id} className="p-0 overflow-hidden">
              <div className="p-5 flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-white/5">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">{cem.firstName} {cem.lastName}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cem.email}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Users size={14} className="text-blue-500" />
                  {cem.totalStudents} student{cem.totalStudents === 1 ? '' : 's'} across {cem.cohorts.length} programme{cem.cohorts.length === 1 ? '' : 's'}
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {cem.cohorts.map((c) => {
                  const isOpen = !!expanded[c.id];
                  return (
                    <div key={c.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((exp) => ({ ...exp, [c.id]: !exp[c.id] })); }}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{dateRange(c.startDate, c.endDate)}</p>
                          <Link
                            to={`/admin/programs/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
                          >
                            View full programme analytics <ChevronRight size={11} />
                          </Link>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">{c.studentCount} students</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{c.attendanceRate}% attendance</span>
                          {c.openTickets > 0 && <Badge color="yellow">{c.openTickets} open ticket{c.openTickets === 1 ? '' : 's'}</Badge>}
                          <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          {!c.students.length ? (
                            <p className="text-xs text-gray-400 py-2">No students enrolled yet.</p>
                          ) : (
                            <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5">
                                  <tr>
                                    <th className="text-left py-2 px-3">Name</th>
                                    <th className="text-left py-2 px-3">Role / Company</th>
                                    <th className="text-left py-2 px-3">Email</th>
                                    <th className="text-left py-2 px-3">ID</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                  {c.students.map((s) => (
                                    <tr key={s.id}>
                                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{s.firstName} {s.lastName}</td>
                                      <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{s.jobTitle ? `${s.jobTitle}${s.company ? ` · ${s.company}` : ''}` : '—'}</td>
                                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{s.email}</td>
                                      <td className="py-2 px-3 text-gray-400 font-mono">{s.studentId ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
