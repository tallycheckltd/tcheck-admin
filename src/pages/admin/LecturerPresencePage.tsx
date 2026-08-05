import { useApi } from '../../hooks/useApi';
import {
  PlayCircle, Loader2, Info, Clock, MapPin, Calendar, QrCode, X, Timer
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { format, isToday } from 'date-fns';
import { getClassTimeStatus } from '../../utils/classTimeStatus';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ClassSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  isActive: boolean;
  course: {
    name: string;
    code: string;
    lecturer: { firstName: string; lastName: string; email: string };
  };
  _count: { attendances: number };
}

interface LecturerPunctualityRow {
  lecturerId: string;
  name: string;
  sessions: number;
  avgLatenessMinutes: number;
  lateCount: number;
  unloggedCount: number;
}

export function LecturerPresencePage() {
  const { data: classes, loading } = useApi<ClassSession[]>('/classes');
  const { data: punctuality, loading: punctualityLoading } = useApi<LecturerPunctualityRow[]>('/attendance/lecturer-punctuality');
  const [selectedQRClass, setSelectedQRClass] = useState<ClassSession | null>(null);

  // Use session start in local time so "today" matches the class schedule, not only the date column.
  const todayClasses = classes?.filter((c: ClassSession) => isToday(new Date(c.startTime))) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lecturer Presence</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time monitoring of class delivery and lecturer activity</p>
        </div>
        <div className="flex gap-2">
          <Badge color="green">
            Live Monitoring
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Status Breakdown Side */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Today's Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Scheduled Sessions</span>
                <span className="font-bold">{todayClasses.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Live Sessions</span>
                <span className="font-bold text-green-600 underline decoration-green-500/30 underline-offset-4">
                  {todayClasses.filter((c: ClassSession) => getClassTimeStatus(c.startTime, c.endTime) === 'live').length}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Completed</span>
                <span className="font-bold text-blue-600">
                  {todayClasses.filter((c: ClassSession) => getClassTimeStatus(c.startTime, c.endTime) === 'completed').length}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 bg-blue-600/5 border-blue-600/10">
            <div className="flex gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <Info size={16} />
              <h3 className="text-xs font-bold uppercase tracking-wider">Note</h3>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-gray-400 leading-relaxed">
              Lecturer presence is currently determined by active class sessions and initiated check-in proximity.
            </p>
          </div>
        </div>

        {/* Live Timeline */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white px-2">Live & Upcoming Sessions</h2>
          
          <div className="space-y-3">
            {todayClasses.length > 0 ? todayClasses.map((c) => {
              const st = getClassTimeStatus(c.startTime, c.endTime);
              const live = st === 'live';
              return (
              <div key={c.id} className={`glass-card p-5 border-l-4 transition-all ${
                live ? 'border-l-green-500 bg-green-500/[0.02]' : 'border-l-gray-300 dark:border-l-white/10'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-2xl ${live ? 'bg-green-600/10 text-green-600' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                      <PlayCircle size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">{c.title}</h3>
                        <Badge color={live ? 'green' : st === 'completed' || st === 'invalid' ? 'gray' : 'blue'}>
                          {live ? 'LIVE' : st === 'completed' ? 'COMPLETED' : st === 'invalid' ? 'INVALID' : 'UPCOMING'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1.2"><Clock size={12} /> {format(new Date(c.startTime), 'h:mm a')} - {format(new Date(c.endTime), 'h:mm a')}</span>
                        <span className="flex items-center gap-1.2"><MapPin size={12} /> {c.room || 'TBD'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900 dark:text-white italic">
                        {c.course.lecturer.firstName} {c.course.lecturer.lastName}
                      </p>
                      <p className="text-[10px] text-gray-400">{c.course.name}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100 dark:bg-white/5 hidden md:block" />
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400">{c._count.attendances}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Attended</p>
                    </div>
                    {live && (
                      <button 
                        onClick={() => setSelectedQRClass(c)}
                        className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2 group"
                        title="Show Attendance QR"
                      >
                        <QrCode size={18} />
                        <span className="text-xs font-bold hidden lg:inline">QR Fallback</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
            }) : (
              <div className="glass-card p-12 text-center text-slate-400">
                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                <p>No classes scheduled for today.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase 3: Dean/HOD lecturer punctuality rollup */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Timer size={18} className="text-blue-500" /> Lecturer Punctuality (last 30 days)
          </h2>
          <p className="text-[11px] text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">
            A proxy metric, not a direct measurement — this app has no dedicated lecturer clock-in.
            "Activated at" is the earliest recorded classroom activity for a session (QR code generated,
            a Ping Class spot check, or the first student TB/QR check-in), compared to the scheduled start time.
          </p>
        </div>
        {punctualityLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm gradient-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Lecturer</th>
                  <th>Sessions</th>
                  <th>Avg. Lateness</th>
                  <th>Late Sessions</th>
                  <th>No Activity Recorded</th>
                </tr>
              </thead>
              <tbody>
                {punctuality?.map((row) => (
                  <tr key={row.lecturerId}>
                    <td className="font-medium text-gray-900 dark:text-white">{row.name}</td>
                    <td>{row.sessions}</td>
                    <td>
                      <Badge color={row.avgLatenessMinutes > 10 ? 'yellow' : 'green'}>
                        {row.avgLatenessMinutes} min
                      </Badge>
                    </td>
                    <td>{row.lateCount}</td>
                    <td>{row.unloggedCount}</td>
                  </tr>
                ))}
                {(!punctuality || punctuality.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">No session activity in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {selectedQRClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/10 relative">
            <button 
              onClick={() => setSelectedQRClass(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="text-center">
              <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                <QrCode size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Attendance QR</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{selectedQRClass.course.name}</p>
              
              <div className="bg-white p-6 rounded-3xl inline-block shadow-inner mb-6">
                <QRCodeSVG 
                  value={selectedQRClass.id}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              
              <div className="flex gap-2 p-3 bg-yellow-500/10 rounded-2xl text-left border border-yellow-500/10">
                <Info size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-yellow-700 dark:text-yellow-500/80 leading-snug">
                  Students can scan this QR code from their mobile app if they are unable to connect to the beacon.
                </p>
              </div>
              
              <button 
                onClick={() => setSelectedQRClass(null)}
                className="w-full mt-6 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                Close Display
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
