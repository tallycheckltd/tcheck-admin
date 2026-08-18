import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import {
  Smartphone, CheckCircle2, XCircle, RefreshCw,
  ShieldCheck, ShieldAlert, History, ShieldX, FileText, TrendingUp, Fingerprint
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { format } from 'date-fns';
import type { PendingDeviceBinding, DeviceSecurityEvent, DeviceChangeReason } from '../../types';

const REASON_LABEL: Record<DeviceChangeReason, string> = {
  LOST_PHONE: 'Lost phone',
  NEW_PHONE: 'Upgraded phone',
  DAMAGED: 'Phone damaged',
  STOLEN: 'Phone stolen',
  OTHER: 'Other',
};

const REASON_COLOR: Record<DeviceChangeReason, 'red' | 'blue' | 'yellow' | 'gray'> = {
  LOST_PHONE: 'red',
  NEW_PHONE: 'blue',
  DAMAGED: 'yellow',
  STOLEN: 'red',
  OTHER: 'gray',
};

const EVENT_COPY: Record<DeviceSecurityEvent['type'], { icon: typeof CheckCircle2; color: string; verb: string }> = {
  CONFLICT_BLOCKED: { icon: ShieldX, color: 'text-red-500', verb: 'blocked — device already claimed' },
  CHANGE_REQUESTED: { icon: ShieldAlert, color: 'text-yellow-500', verb: 'requested a device change' },
  APPROVED: { icon: CheckCircle2, color: 'text-green-500', verb: 'device approved' },
  DENIED: { icon: XCircle, color: 'text-gray-400', verb: 'device request denied/reset' },
  TAMPER_DEMOTION: { icon: Fingerprint, color: 'text-orange-500', verb: 'biometric tampering detected — demoted to camera verification' },
};

const timeAgo = (dateStr: string) => {
  // eslint-disable-next-line react-hooks/purity -- relative time uses wall clock at render
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const DEVICE_REFRESH_MS = 30_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function DeviceVerificationPage() {
  const apiOpts = { refetchIntervalMs: DEVICE_REFRESH_MS, refetchWhenVisible: true };
  const { data: pending, loading, refetch } = useApi<PendingDeviceBinding[]>('/devices/pending', apiOpts);
  const { data: bound, refetch: refetchBound } = useApi<PendingDeviceBinding[]>('/devices/bound', apiOpts);
  const { data: securityLog, refetch: refetchLog } = useApi<DeviceSecurityEvent[]>('/devices/security-log', apiOpts);
  const { mutate: verify } = useMutation('post');
  const { mutate: reset } = useMutation('delete');
  const [search, setSearch] = useState('');

  const filtered = pending?.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    p.studentId.toLowerCase().includes(search.toLowerCase()) ||
    p.deviceModel.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredBound = bound?.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    p.studentId.toLowerCase().includes(search.toLowerCase()) ||
    p.deviceModel.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const refreshAll = () => { refetch(); refetchBound(); refetchLog(); };

  const weekAgo = Date.now() - WEEK_MS;
  const conflictsThisWeek = securityLog?.filter((e) => e.type === 'CONFLICT_BLOCKED' && new Date(e.createdAt).getTime() >= weekAgo).length ?? 0;
  const changesThisWeek = securityLog?.filter((e) => e.type === 'CHANGE_REQUESTED' && new Date(e.createdAt).getTime() >= weekAgo).length ?? 0;

  const handleVerify = async (p: PendingDeviceBinding) => {
    const msg = p.currentDeviceModel
      ? `Approve the switch from ${p.currentDeviceModel} to ${p.deviceModel} for ${p.firstName} ${p.lastName}?`
      : `Approve ${p.deviceModel} as ${p.firstName} ${p.lastName}'s bound device?`;
    if (!confirm(msg)) return;
    try {
      await verify(`/devices/verify/${p.id}`);
      refreshAll();
    } catch {
      alert('Failed to verify device');
    }
  };

  const handleReset = async (userId: string, isBound: boolean) => {
    const msg = isBound
      ? "Warning: This will clear the student's device binding entirely. They'll need to register a new device on next login. Continue?"
      : 'Deny this device-change request? The student stays bound to their current device.';
    if (!confirm(msg)) return;
    try {
      await reset(`/devices/${userId}`);
      refreshAll();
    } catch {
      alert('Failed to reset device');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Device Verification</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and approve student device registrations to prevent fraud</p>
        </div>
        <SearchInput
          placeholder="Search students or devices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[280px]"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{bound?.length ?? 0}</p>
            <p className="text-[10px] text-gray-500 mt-1">Devices bound</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{pending?.length ?? 0}</p>
            <p className="text-[10px] text-gray-500 mt-1">Awaiting review</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
            <ShieldX size={18} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{conflictsThisWeek}</p>
            <p className="text-[10px] text-gray-500 mt-1">Conflicts blocked, 7d</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{changesThisWeek}</p>
            <p className="text-[10px] text-gray-500 mt-1">Change requests, 7d</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Enrollment List */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-yellow-500" />
              Pending Verifications
              <Badge color="yellow">{filtered.length}</Badge>
            </h3>
            <button onClick={refreshAll} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left py-3 px-6">Student</th>
                  <th className="text-left py-3 px-6">Device</th>
                  <th className="text-left py-3 px-6">Reason</th>
                  <th className="text-left py-3 px-6">Requested</th>
                  <th className="text-right py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors align-top">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                          {p.firstName[0]}{p.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{p.firstName} {p.lastName}</p>
                          <p className="text-[10px] text-gray-500">{p.studentId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5 font-medium">
                          <Smartphone size={14} className="text-gray-400" />
                          {p.deviceModel}
                        </span>
                        {p.currentDeviceModel && (
                          <span className="text-[10px] text-gray-400 mt-0.5">was: {p.currentDeviceModel}</span>
                        )}
                        <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/5 px-1 py-0.5 rounded mt-1 truncate max-w-[120px]">
                          {p.deviceId}
                        </code>
                      </div>
                    </td>
                    <td className="py-4 px-6 max-w-[220px]">
                      {p.reason ? (
                        <div className="space-y-1">
                          <Badge color={REASON_COLOR[p.reason]}>{REASON_LABEL[p.reason]}</Badge>
                          {p.note && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1" title={p.note}>
                              <FileText size={11} className="mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{p.note}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">First-time bind</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-gray-500 text-xs">
                      {format(new Date(p.createdAt), 'MMM d, h:mm a')}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleVerify(p)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleReset(p.id, false)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          title="Deny request"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={ShieldCheck} title="No pending device verifications." size="sm" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-6 bg-blue-500/5 border-blue-500/10">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-3">
              <ShieldCheck size={18} />
              About Device Binding
            </h3>
            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <p>Every student account is locked to a single device — enforced at login, not just check-in.</p>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500 text-[10px]">1</div>
                <p>A student's device auto-binds the first time they log in — no approval needed.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500 text-[10px]">2</div>
                <p>Switching devices requires the student to submit a reason in-app — it shows up here for you to approve or deny.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500 text-[10px]">3</div>
                <p>One device can't be bound to two accounts — blocked attempts show up in the Security Log too.</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History size={16} className="text-gray-400" />
                Security Log
              </h3>
              <button onClick={() => refetchLog()} className="p-1 text-gray-400 hover:text-blue-500 transition-colors">
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="space-y-4 max-h-[420px] overflow-y-auto">
              {securityLog?.map((e) => {
                // Falls back rather than crashing the page if the backend ever logs a type this
                // list doesn't know about yet — happened for real with TAMPER_DEMOTION.
                const copy = EVENT_COPY[e.type] ?? { icon: ShieldAlert, color: 'text-gray-400', verb: e.type };
                const Icon = copy.icon;
                return (
                  <div key={e.id} className="flex gap-3 items-start">
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 flex-shrink-0"><Icon size={12} className={copy.color} /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400">{timeAgo(e.createdAt)}</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        <span className="font-bold">{e.user.firstName} {e.user.lastName}</span> {copy.verb}
                        {e.conflictingUser && (
                          <> — device belongs to <span className="font-bold">{e.conflictingUser.firstName} {e.conflictingUser.lastName}</span></>
                        )}
                        {e.deviceModel && <span className="text-gray-500"> ({e.deviceModel})</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              {(!securityLog || securityLog.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-6">No device security events yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bound Devices — already-approved bindings; reset here when a student gets a new phone */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={16} className="text-green-500" />
            Bound Devices
            <Badge color="green">{filteredBound.length}</Badge>
          </h3>
          <button onClick={() => refetchBound()} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left py-3 px-6">Student</th>
                <th className="text-left py-3 px-6">Device</th>
                <th className="text-left py-3 px-6">Bound Since</th>
                <th className="text-right py-3 px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredBound.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-xs">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{p.firstName} {p.lastName}</p>
                        <p className="text-[10px] text-gray-500">{p.studentId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5 font-medium">
                        <Smartphone size={14} className="text-gray-400" />
                        {p.deviceModel}
                      </span>
                      <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/5 px-1 py-0.5 rounded mt-1 truncate max-w-[120px]">
                        {p.deviceId}
                      </code>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-500 text-xs">
                    {p.createdAt ? format(new Date(p.createdAt), 'MMM d, h:mm a') : '-'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleReset(p.id, true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all ml-auto"
                    >
                      <RefreshCw size={12} /> Reset Device
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBound.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon={Smartphone} title="No devices bound yet." size="sm" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
