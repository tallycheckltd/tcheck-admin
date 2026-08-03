import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { 
  Smartphone, Search, CheckCircle2, XCircle, RefreshCw, 
  ShieldCheck, ShieldAlert, History
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';

interface PendingBinding {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
  deviceId: string;
  deviceModel: string;
  createdAt: string;
}

export function DeviceVerificationPage() {
  const { data: pending, loading, refetch } = useApi<PendingBinding[]>('/devices/pending');
  const { data: bound, refetch: refetchBound } = useApi<PendingBinding[]>('/devices/bound');
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

  const handleVerify = async (userId: string) => {
    if (!confirm('Approve this device for this student?')) return;
    try {
      await verify(`/devices/verify/${userId}`);
      refetch();
    } catch {
      alert('Failed to verify device');
    }
  };

  const handleReset = async (userId: string) => {
    if (!confirm('Warning: This will clear the student\'s device binding. They will need to register a new device. Continue?')) return;
    try {
      await reset(`/devices/${userId}`);
      refetch();
      refetchBound();
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
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search students or devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[280px]"
          />
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
            <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left py-3 px-6">Student</th>
                  <th className="text-left py-3 px-6">Device</th>
                  <th className="text-left py-3 px-6">Request Date</th>
                  <th className="text-right py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors">
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
                        <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/5 px-1 py-0.5 rounded mt-1 truncate max-w-[120px]">
                          {p.deviceId}
                        </code>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-500 text-xs">
                      {format(new Date(p.createdAt), 'MMM d, h:mm a')}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleVerify(p.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button 
                          onClick={() => handleReset(p.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          title="Reject/Reset"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <ShieldCheck size={40} className="mx-auto text-green-500/20 mb-3" />
                      <p className="text-sm text-gray-500">No pending device verifications.</p>
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
                <p>Logging in from a different device is blocked and shows up here as pending — an admin must approve the switch before that device can be used.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500 text-[10px]">3</div>
                <p>One device can't be bound to two accounts — blocks a shared phone from checking in for multiple students.</p>
              </div>
            </div>
            <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 h-auto">
              Policy Settings
            </Button>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <History size={16} className="text-gray-400" />
              Security Log
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3 items-start opacity-70">
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5"><CheckCircle2 size={12} className="text-green-500" /></div>
                <div>
                  <p className="text-[10px] text-gray-400">2 mins ago</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Device <span className="font-bold">iPhone 15</span> verified for student <span className="font-bold">John Doe</span>.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start opacity-70">
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5"><XCircle size={12} className="text-red-500" /></div>
                <div>
                  <p className="text-[10px] text-gray-400">1 hour ago</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Binding reset for <span className="font-bold">Mary Smith</span> by Admin.</p>
                </div>
              </div>
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
                      onClick={() => handleReset(p.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all ml-auto"
                    >
                      <RefreshCw size={12} /> Reset Device
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBound.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <Smartphone size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500">No devices bound yet.</p>
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
