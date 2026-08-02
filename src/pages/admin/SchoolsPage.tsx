import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, School as SchoolIcon, Palette, Hash, UserCheck, MessageSquareOff, ShieldCheck, Megaphone, ScanFace, Timer, Mail, Lock, User as UserIcon, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { School, SchoolFeatures, User } from '../../types';

const emptySchoolForm = { name: '', code: '', color: '#3B82F6' };
const emptyAdminForm = { email: '', password: '', firstName: '', lastName: '' };

const defaultFeatures: Required<SchoolFeatures> = {
  anonymousChat: true,
  biometricStrictMode: false,
  broadcasts: true,
  faceIdCheckIn: true,
  dwellTimeTracking: true,
};

export function SchoolsPage() {
  const { data: schools, refetch } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation<School>('post');
  const { mutate: createAdmin } = useMutation<User>('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({ name: '', code: '', color: '#3B82F6', allowManualLecturerOverride: true, features: defaultFeatures });

  // New-school wizard: step 1 collects the institution, step 2 collects the admin who'll log in
  // and run it day-to-day. Nothing is created until "Create School & Admin" on step 2 — so
  // abandoning the wizard between steps leaves nothing behind. If admin creation fails after the
  // school was already created, createdSchoolId is kept so retrying doesn't create a duplicate school.
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [schoolForm, setSchoolForm] = useState(emptySchoolForm);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [createdSchoolId, setCreatedSchoolId] = useState<string | null>(null);
  const [wizardError, setWizardError] = useState('');
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setWizardStep(1);
    setSchoolForm(emptySchoolForm);
    setAdminForm(emptyAdminForm);
    setCreatedSchoolId(null);
    setWizardError('');
    setModal(true);
  };
  const openEdit = (s: School) => {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code,
      color: s.color,
      allowManualLecturerOverride: s.allowManualLecturerOverride ?? true,
      features: { ...defaultFeatures, ...s.features },
    });
    setModal(true);
  };

  const handleSubmit = async () => {
    await update(`/schools/${editing!.id}`, form);
    setModal(false);
    refetch();
  };

  const handleWizardNext = () => {
    if (!schoolForm.name.trim() || !schoolForm.code.trim()) {
      setWizardError('Institution name and code are required.');
      return;
    }
    setWizardError('');
    setWizardStep(2);
  };

  const handleCreateWizard = async () => {
    if (!adminForm.email.trim() || !adminForm.password || !adminForm.firstName.trim() || !adminForm.lastName.trim()) {
      setWizardError('All admin fields are required.');
      return;
    }
    setWizardError('');
    setWizardSubmitting(true);
    try {
      let schoolId = createdSchoolId;
      if (!schoolId) {
        const school = await create('/schools', schoolForm);
        schoolId = school!.id;
        setCreatedSchoolId(schoolId);
      }
      await createAdmin('/users/admin', { ...adminForm, schoolId });
      setModal(false);
      refetch();
    } catch (e) {
      setWizardError(e instanceof Error ? e.message : 'Failed to create school/admin');
    } finally {
      setWizardSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this school?')) return;
    await remove(`/schools/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schools</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage institutional entities across the organization</p>
        </div>
        <Button onClick={openCreate} className="shadow-lg shadow-blue-500/20">
          <Plus size={18} className="mr-2" /> Add School
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-white/10">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Institution</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Brand Color</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {schools?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-gray-500 border border-gray-100 dark:border-white/10">
                        <SchoolIcon size={20} />
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded text-xs font-mono font-medium border border-gray-200 dark:border-white/10">
                      {s.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-mono text-gray-500 uppercase">{s.color}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(s)} className="p-2 rounded-xl hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-blue-500 transition-all border border-transparent hover:border-blue-100" title="Edit School">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100" title="Delete School">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!schools || schools.length === 0) && (
                <tr>
                  <td colSpan={4} className="text-center py-16">
                    <SchoolIcon className="mx-auto text-gray-200 dark:text-gray-700 mb-4" size={48} />
                    <p className="text-gray-500 dark:text-gray-400">No schools registered yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit School' : `Add School — Step ${wizardStep} of 2`}
      >
        {!editing && (
          <div className="flex items-center gap-2 mb-5">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    wizardStep === step
                      ? 'bg-blue-500 text-white'
                      : wizardStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {wizardStep > step ? <CheckCircle2 size={16} /> : step}
                </div>
                <span className={`text-xs font-medium ${wizardStep === step ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                  {step === 1 ? 'Institution' : 'Admin Account'}
                </span>
                {step === 1 && <div className={`flex-1 h-0.5 ${wizardStep > 1 ? 'bg-green-500' : 'bg-gray-200 dark:bg-white/10'}`} />}
              </div>
            ))}
          </div>
        )}

        {editing ? (
        <div className="space-y-5">
          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
            <Input 
              label="Institution Name" 
              icon={SchoolIcon}
              placeholder="e.g. Science & Technology Institute"
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
            />
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="School Code" 
                icon={Hash}
                placeholder="STI"
                value={form.code} 
                onChange={(e) => setForm({ ...form, code: e.target.value })} 
              />
              <Input 
                label="Brand Color" 
                icon={Palette}
                type="color" 
                value={form.color} 
                onChange={(e) => setForm({ ...form, color: e.target.value })} 
              />
            </div>
          </div>
          {editing && (
            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="flex items-start gap-2">
                  <UserCheck size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Manual check-in override</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Lets lecturers mark students present by hand (dead battery, hardware exceptions) from the live session dashboard.
                    </span>
                  </span>
                </span>
                <span className="shrink-0 pt-0.5">
                  <input
                    type="checkbox"
                    checked={form.allowManualLecturerOverride}
                    onChange={(e) => setForm({ ...form, allowManualLecturerOverride: e.target.checked })}
                    className="sr-only peer"
                  />
                  <span
                    onClick={() => setForm({ ...form, allowManualLecturerOverride: !form.allowManualLecturerOverride })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      form.allowManualLecturerOverride ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.allowManualLecturerOverride ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </span>
              </label>
            </div>
          )}
          {editing && (
            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Features Configuration</h3>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="flex items-start gap-2">
                  <MessageSquareOff size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Anonymous Chat</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Lets students post anonymously in Campus/Session Chat rooms.
                    </span>
                  </span>
                </span>
                <span
                  onClick={() => setForm({ ...form, features: { ...form.features, anonymousChat: !form.features.anonymousChat } })}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.features.anonymousChat ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.features.anonymousChat ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
              </label>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="flex items-start gap-2">
                  <ShieldCheck size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Biometric Strict Mode</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Blocks the selfie fallback — students without biometric hardware can&apos;t check in.
                    </span>
                  </span>
                </span>
                <span
                  onClick={() => setForm({ ...form, features: { ...form.features, biometricStrictMode: !form.features.biometricStrictMode } })}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.features.biometricStrictMode ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.features.biometricStrictMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
              </label>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="flex items-start gap-2">
                  <Megaphone size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Broadcasts</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Lets admins send announcements to this school&apos;s students and lecturers.
                    </span>
                  </span>
                </span>
                <span
                  onClick={() => setForm({ ...form, features: { ...form.features, broadcasts: !form.features.broadcasts } })}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.features.broadcasts ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.features.broadcasts ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
              </label>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="flex items-start gap-2">
                  <ScanFace size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Face ID Check-In</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Requires identity verification (Face ID, selfie, or device binding) to check in. Off falls back to a plain tap-to-check-in/out.
                    </span>
                  </span>
                </span>
                <span
                  onClick={() => setForm({ ...form, features: { ...form.features, faceIdCheckIn: !form.features.faceIdCheckIn } })}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.features.faceIdCheckIn ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.features.faceIdCheckIn ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
              </label>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="flex items-start gap-2">
                  <Timer size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Dwell Time Tracking</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Requires ~10s of sustained beacon presence before a BLE check-in is accepted. Off allows an instant tap the moment the beacon is detected.
                    </span>
                  </span>
                </span>
                <span
                  onClick={() => setForm({ ...form, features: { ...form.features, dwellTimeTracking: !form.features.dwellTimeTracking } })}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.features.dwellTimeTracking ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.features.dwellTimeTracking ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
              </label>
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full py-4 shadow-lg shadow-blue-500/20">
            Update School Profile
          </Button>
        </div>
        ) : wizardStep === 1 ? (
        <div className="space-y-5">
          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
            <Input
              label="Institution Name"
              icon={SchoolIcon}
              placeholder="e.g. Science & Technology Institute"
              value={schoolForm.name}
              onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="School Code"
                icon={Hash}
                placeholder="STI"
                value={schoolForm.code}
                onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })}
              />
              <Input
                label="Brand Color"
                icon={Palette}
                type="color"
                value={schoolForm.color}
                onChange={(e) => setSchoolForm({ ...schoolForm, color: e.target.value })}
              />
            </div>
          </div>
          {wizardError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-2.5">
              <AlertCircle size={16} className="shrink-0" /> {wizardError}
            </div>
          )}
          <Button onClick={handleWizardNext} className="w-full py-4 shadow-lg shadow-blue-500/20">
            Next: Assign Admin <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        ) : (
        <div className="space-y-5">
          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This account logs in as this school&apos;s admin — they&apos;ll add lecturers, courses, and approve students from there.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                icon={UserIcon}
                value={adminForm.firstName}
                onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
              />
              <Input
                label="Last Name"
                icon={UserIcon}
                value={adminForm.lastName}
                onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
              />
            </div>
            <Input
              label="Email"
              type="email"
              icon={Mail}
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              icon={Lock}
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
            />
          </div>
          {wizardError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-2.5">
              <AlertCircle size={16} className="shrink-0" /> {wizardError}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setWizardStep(1)} disabled={wizardSubmitting} className="gap-2">
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={() => void handleCreateWizard()} disabled={wizardSubmitting} className="flex-1 py-4 shadow-lg shadow-blue-500/20">
              {wizardSubmitting ? 'Creating…' : 'Create School & Admin'}
            </Button>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
