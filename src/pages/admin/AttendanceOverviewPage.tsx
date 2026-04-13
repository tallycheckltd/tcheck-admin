import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { createSocket } from '../../lib/socket';
import { ClipboardList, Users, Clock, UserX, RefreshCw } from 'lucide-react';
import type { ClassSession } from '../../types';

const TODAY = new Date().toISOString().split('T')[0];

// Status pill configuration
type ClassStatus = 'On Track' | 'Low Turnout' | 'Critical' | 'Not Started';

function getClassStatus(checked: number, expected: number, isActive: boolean): ClassStatus {
  if (!isActive) return 'Not Started';
  const rate = expected > 0 ? (checked / expected) * 100 : 0;
  if (rate >= 75) return 'On Track';
  if (rate >= 50) return 'Low Turnout';
  return 'Critical';
}

function StatusPill({ status }: { status: ClassStatus }) {
  const map: Record<ClassStatus, string> = {
    'On Track':    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    'Low Turnout': 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    'Critical':    'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    'Not Started': 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
  };
  const emoji: Record<ClassStatus, string> = {
    'On Track': '🟢', 'Low Turnout': '🟡', 'Critical': '🔴', 'Not Started': '⬜',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${map[status]}`}>
      {emoji[status]} {status}
    </span>
  );
}

// Dummy enriched class data (simulates backend aggregation)
interface EnrichedClass extends ClassSession {
  checkedIn: number;
  expectedHeadcount: number;
  lecturerName: string;
}

function enrichClasses(classes: ClassSession[]): EnrichedClass[] {
  const lecturers = ['Dr. J. Mwangi', 'Prof. A. Omondi', 'Mr. K. Njoroge', 'Dr. F. Hassan', 'Ms. G. Wambua'];
  return classes.map((c, i) => {
    const hash = c.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const expected = 20 + (hash % 40);
    const checkedIn = c.isActive ? Math.floor(expected * (0.4 + ((hash + i) % 6) / 10)) : 0;
    return {
      ...c,
      checkedIn,
      expectedHeadcount: expected,
      lecturerName: lecturers[(hash + i) % lecturers.length],
    };
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceOverviewPage() {
  const { data: rawClasses, refetch } = useApi<ClassSession[]>(`/classes?date=${TODAY}`);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Real-time updates via WebSocket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    s.on('attendance:update', () => { refetch(); setLastUpdated(new Date()); });
    return () => { s.disconnect(); };
  }, [refetch]);

  const classes = enrichClasses(rawClasses || []);

  // KPI computations
  const activeClasses = classes.filter((c) => c.isActive).length;

  const totalExpected = classes.filter((c) => c.isActive).reduce((a, c) => a + c.expectedHeadcount, 0);
  const totalChecked  = classes.filter((c) => c.isActive).reduce((a, c) => a + c.checkedIn, 0);
  const punctualityPct = totalExpected > 0 ? Math.round((totalChecked / totalExpected) * 100) : 0;

  // Dummy lecturer absences: classes where lecturer marked as No Show
  const lecturerAbsences = classes.filter((c) => {
    if (!c.isActive) return false;
    const hash = c.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return hash % 7 === 0; // ~14% chance of no-show flag
  }).length;

  const kpis = [
    {
      label: 'Active Classes Today',
      value: activeClasses,
      icon: <ClipboardList size={22} className="text-blue-500" />,
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'Department Punctuality',
      value: `${punctualityPct}%`,
      icon: <Users size={22} className="text-emerald-500" />,
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      sub: `${totalChecked} / ${totalExpected} students`,
    },
    {
      label: 'Lecturer Absences',
      value: lecturerAbsences,
      icon: <UserX size={22} className="text-red-500" />,
      bg: 'bg-red-50 dark:bg-red-500/10',
      sub: lecturerAbsences > 0 ? 'No Show flagged' : 'All present',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Today's command center —&nbsp;
            {new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw size={12} />
          Updated {lastUpdated.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* KPI Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{k.label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{k.value}</p>
                {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
              </div>
              <div className={`w-12 h-12 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                {k.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Classes Grid */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Today's Classes ({classes.length})
          </h2>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        {classes.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No classes scheduled for today.</p>
          </div>
        ) : (
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Time Slot</th>
                <th>Course</th>
                <th>Lecturer</th>
                <th className="text-center">Expected</th>
                <th className="text-center">Checked In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {classes.map((cls) => {
                const status = getClassStatus(cls.checkedIn, cls.expectedHeadcount, cls.isActive);
                const rate = cls.expectedHeadcount > 0
                  ? Math.round((cls.checkedIn / cls.expectedHeadcount) * 100)
                  : 0;

                return (
                  <tr key={cls.id}>
                    <td className="font-mono text-xs whitespace-nowrap">
                      {formatTime(cls.startTime)} – {formatTime(cls.endTime)}
                    </td>
                    <td>
                      <p className="font-medium text-gray-900 dark:text-white">{cls.course?.name || cls.title}</p>
                      <p className="text-xs text-gray-400">{cls.room || cls.course?.room || '—'}</p>
                    </td>
                    <td className="text-xs">{cls.lecturerName}</td>
                    <td className="text-center font-medium">{cls.expectedHeadcount}</td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-bold ${cls.isActive ? (rate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500') : 'text-gray-400'}`}>
                          {cls.isActive ? cls.checkedIn : '—'}
                        </span>
                        {cls.isActive && (
                          <span className="text-[10px] text-gray-400">{rate}%</span>
                        )}
                      </div>
                    </td>
                    <td><StatusPill status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
