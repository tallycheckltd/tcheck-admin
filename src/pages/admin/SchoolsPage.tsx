import { useState } from 'react';
import type { ElementType } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Slider } from '../../components/ui/Slider';
import { ColorPickerField } from '../../components/ui/ColorPickerField';
import {
  Plus, Pencil, Trash2, School as SchoolIcon, Hash, UserCheck, MessageSquareOff,
  ShieldCheck, Megaphone, ScanFace, Timer, Mail, Lock, User as UserIcon, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, UserPlus, X
} from 'lucide-react';
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

interface SchoolSettingsValue {
  allowManualLecturerOverride: boolean;
  features: Required<SchoolFeatures>;
  lateThresholdMinutes: number;
  extremelyLateThresholdMinutes: number;
}

const defaultSettings: SchoolSettingsValue = {
  allowManualLecturerOverride: true,
  features: defaultFeatures,
  lateThresholdMinutes: 10,
  extremelyLateThresholdMinutes: 20,
};

interface ExtraAdminRow {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'SUB_ADMIN' | 'LECTURER';
  submitted?: boolean;
}
const emptyExtraAdminRow = (): ExtraAdminRow => ({ firstName: '', lastName: '', email: '', password: '', role: 'SUB_ADMIN' });

// Shared toggle-switch row — used by every feature/override toggle in SchoolSettingsFields below.
function ToggleRow({ icon: Icon, title, description, checked, onChange }: {
  icon: ElementType; title: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span className="flex items-start gap-2">
        <Icon size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-white">{title}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</span>
        </span>
      </span>
      <span
        onClick={() => onChange(!checked)}
        className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </label>
  );
}

/** Shared between the Edit-School modal and the create wizard's Step 3 — one source of truth so
 * the two surfaces can't drift apart. */
function SchoolSettingsFields({ value, onChange }: { value: SchoolSettingsValue; onChange: (v: SchoolSettingsValue) => void }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5">
        <ToggleRow
          icon={UserCheck}
          title="Manual check-in override"
          description="Lets lecturers mark students present by hand (dead battery, hardware exceptions) from the live session dashboard."
          checked={value.allowManualLecturerOverride}
          onChange={(v) => onChange({ ...value, allowManualLecturerOverride: v })}
        />
      </div>

      <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Attendance Thresholds</h3>
        <Slider
          label="Late Threshold"
          min={0} max={60} step={1} unit=" min"
          value={value.lateThresholdMinutes}
          onChange={(v) => onChange({ ...value, lateThresholdMinutes: v })}
        />
        <Slider
          label="Extremely Late Threshold"
          min={0} max={90} step={1} unit=" min"
          value={value.extremelyLateThresholdMinutes}
          onChange={(v) => onChange({ ...value, extremelyLateThresholdMinutes: v })}
        />
      </div>

      <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Features Configuration</h3>
        <ToggleRow
          icon={MessageSquareOff}
          title="Anonymous Chat"
          description="Lets students post anonymously in Campus/Session Chat rooms."
          checked={value.features.anonymousChat}
          onChange={(v) => onChange({ ...value, features: { ...value.features, anonymousChat: v } })}
        />
        <ToggleRow
          icon={ShieldCheck}
          title="Biometric Strict Mode"
          description="Blocks the selfie fallback — students without biometric hardware can't check in."
          checked={value.features.biometricStrictMode}
          onChange={(v) => onChange({ ...value, features: { ...value.features, biometricStrictMode: v } })}
        />
        <ToggleRow
          icon={Megaphone}
          title="Broadcasts"
          description="Lets admins send announcements to this school's students and lecturers."
          checked={value.features.broadcasts}
          onChange={(v) => onChange({ ...value, features: { ...value.features, broadcasts: v } })}
        />
        <ToggleRow
          icon={ScanFace}
          title="Face ID Check-In"
          description="Requires identity verification (Face ID, selfie, or device binding) to check in. Off falls back to a plain tap-to-check-in/out."
          checked={value.features.faceIdCheckIn}
          onChange={(v) => onChange({ ...value, features: { ...value.features, faceIdCheckIn: v } })}
        />
        <ToggleRow
          icon={Timer}
          title="Dwell Time Tracking"
          description="Requires ~10s of sustained beacon presence before a BLE check-in is accepted. Off allows an instant tap the moment the beacon is detected."
          checked={value.features.dwellTimeTracking}
          onChange={(v) => onChange({ ...value, features: { ...value.features, dwellTimeTracking: v } })}
        />
      </div>
    </div>
  );
}

export function SchoolsPage() {
  const { data: schools, refetch } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation<School>('post');
  const { mutate: createUser } = useMutation<User>('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', color: '#3B82F6',
    allowManualLecturerOverride: true,
    features: defaultFeatures,
    lateThresholdMinutes: 10,
    extremelyLateThresholdMinutes: 20,
  });

  // New-school wizard: step 1 collects the institution, step 2 collects the admin who'll log in
  // and run it day-to-day, step 3 lets the same flow configure the tenant's settings and invite
  // additional staff. Nothing is created until "Finish" on step 3 — abandoning the wizard at any
  // point leaves nothing behind. createdSchoolId/adminCreated/extraAdmins[].submitted track what
  // already succeeded so a retry after a partial failure only replays the actual remainder.
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [schoolForm, setSchoolForm] = useState(emptySchoolForm);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [settingsForm, setSettingsForm] = useState<SchoolSettingsValue>(defaultSettings);
  const [extraAdmins, setExtraAdmins] = useState<ExtraAdminRow[]>([]);
  const [createdSchoolId, setCreatedSchoolId] = useState<string | null>(null);
  const [adminCreated, setAdminCreated] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setWizardStep(1);
    setSchoolForm(emptySchoolForm);
    setAdminForm(emptyAdminForm);
    setSettingsForm(defaultSettings);
    setExtraAdmins([]);
    setCreatedSchoolId(null);
    setAdminCreated(false);
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
      lateThresholdMinutes: s.lateThresholdMinutes ?? 10,
      extremelyLateThresholdMinutes: s.extremelyLateThresholdMinutes ?? 20,
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

  const handleWizardAdminNext = () => {
    if (!adminForm.email.trim() || !adminForm.password || !adminForm.firstName.trim() || !adminForm.lastName.trim()) {
      setWizardError('All admin fields are required.');
      return;
    }
    setWizardError('');
    setWizardStep(3);
  };

  const updateExtraAdmin = (index: number, patch: Partial<ExtraAdminRow>) => {
    setExtraAdmins(extraAdmins.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleCreateWizard = async () => {
    setWizardError('');
    setWizardSubmitting(true);
    try {
      let schoolId = createdSchoolId;
      if (!schoolId) {
        const school = await create('/schools', schoolForm);
        schoolId = school!.id;
        setCreatedSchoolId(schoolId);
      }

      if (!adminCreated) {
        await createUser('/users/admin', { ...adminForm, schoolId });
        setAdminCreated(true);
      }

      // Idempotent — updateSchool shallow-merges features, so resending on retry is harmless.
      await update(`/schools/${schoolId}`, settingsForm);

      // Blank rows (never filled in after clicking "+ Add another") are silently skipped rather
      // than blocking submission — no need to force the admin to delete an unused row.
      for (let i = 0; i < extraAdmins.length; i++) {
        const row = extraAdmins[i]!;
        if (row.submitted) continue;
        const filled = row.firstName.trim() && row.lastName.trim() && row.email.trim() && row.password;
        if (!filled) continue;
        const path = row.role === 'SUB_ADMIN' ? '/users/admin' : '/users/lecturer';
        await createUser(path, { firstName: row.firstName, lastName: row.lastName, email: row.email, password: row.password, schoolId });
        setExtraAdmins((prev) => prev.map((r, idx) => (idx === i ? { ...r, submitted: true } : r)));
      }

      setModal(false);
      refetch();
    } catch (e) {
      setWizardError(e instanceof Error ? e.message : 'Failed to create school');
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
        title={editing ? 'Edit School' : `Add School — Step ${wizardStep} of 3`}
      >
        {!editing && (
          <div className="flex items-center gap-2 mb-5">
            {[1, 2, 3].map((step) => (
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
                  {step === 1 ? 'Institution' : step === 2 ? 'Admin Account' : 'Settings & Team'}
                </span>
                {step < 3 && <div className={`flex-1 h-0.5 ${wizardStep > step ? 'bg-green-500' : 'bg-gray-200 dark:bg-white/10'}`} />}
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
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <ColorPickerField
                label="Brand Color"
                value={form.color}
                onChange={(color) => setForm({ ...form, color })}
              />
            </div>
          </div>
          <SchoolSettingsFields value={form} onChange={(v) => setForm({ ...form, ...v })} />
          <Button onClick={handleSubmit} className="w-full py-4 shadow-lg shadow-blue-500/20">
            Update School Profile
          </Button>
        </div>
        ) : wizardStep === 1 ? (
        <div className="space-y-5">
          {/* Live preview — makes the abstract "brand color" pick feel concrete immediately,
              and doubles as a friendly confirmation of what's about to be created. */}
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-gradient-to-br from-gray-50 to-white dark:from-slate-900/50 dark:to-slate-900/20">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm transition-colors"
              style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(schoolForm.color) ? schoolForm.color : '#3B82F6' }}
            >
              {schoolForm.name.trim() ? schoolForm.name.trim()[0].toUpperCase() : <SchoolIcon size={20} />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {schoolForm.name.trim() || 'Your institution name'}
              </p>
              <p className="text-xs text-gray-400 font-mono tracking-wide">
                {schoolForm.code.trim() || 'CODE'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
            <Input
              label="Institution Name"
              icon={SchoolIcon}
              placeholder="e.g. Science & Technology Institute"
              value={schoolForm.name}
              onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Input
                  label="School Code"
                  icon={Hash}
                  placeholder="STI"
                  value={schoolForm.code}
                  maxLength={8}
                  onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value.toUpperCase() })}
                />
                <p className="text-xs text-gray-400 pl-1">Short, unique — shown across the app</p>
              </div>
              <ColorPickerField
                label="Brand Color"
                value={schoolForm.color}
                onChange={(color) => setSchoolForm({ ...schoolForm, color })}
              />
            </div>
          </div>
          {wizardError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-2.5">
              <AlertCircle size={16} className="shrink-0" /> {wizardError}
            </div>
          )}
          <Button
            onClick={handleWizardNext}
            disabled={!schoolForm.name.trim() || !schoolForm.code.trim()}
            className="w-full py-4 shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            Next: Assign Admin <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        ) : wizardStep === 2 ? (
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
            <Button variant="secondary" onClick={() => setWizardStep(1)} className="gap-2">
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={handleWizardAdminNext} className="flex-1 py-4 shadow-lg shadow-blue-500/20">
              Next: Settings & Team <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
        ) : (
        <div className="space-y-5">
          <SchoolSettingsFields value={settingsForm} onChange={setSettingsForm} />

          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Invite Additional Staff (Optional)</h3>
            {extraAdmins.map((row, i) => (
              <div key={i} className="p-3 rounded-xl border border-gray-200 dark:border-white/10 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => setExtraAdmins(extraAdmins.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <X size={14} />
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateExtraAdmin(i, { role: 'SUB_ADMIN' })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      row.role === 'SUB_ADMIN' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Co-Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => updateExtraAdmin(i, { role: 'LECTURER' })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      row.role === 'LECTURER' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Lecturer
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="First Name" value={row.firstName} onChange={(e) => updateExtraAdmin(i, { firstName: e.target.value })} />
                  <Input placeholder="Last Name" value={row.lastName} onChange={(e) => updateExtraAdmin(i, { lastName: e.target.value })} />
                </div>
                <Input placeholder="Email" type="email" value={row.email} onChange={(e) => updateExtraAdmin(i, { email: e.target.value })} />
                <Input placeholder="Password" type="password" value={row.password} onChange={(e) => updateExtraAdmin(i, { password: e.target.value })} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setExtraAdmins([...extraAdmins, emptyExtraAdminRow()])}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-white/15 text-sm text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors cursor-pointer"
            >
              <UserPlus size={14} /> Add another
            </button>
          </div>

          {wizardError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-2.5">
              <AlertCircle size={16} className="shrink-0" /> {wizardError}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setWizardStep(2)} disabled={wizardSubmitting} className="gap-2">
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={() => void handleCreateWizard()} disabled={wizardSubmitting} className="flex-1 py-4 shadow-lg shadow-blue-500/20">
              {wizardSubmitting ? 'Creating…' : 'Finish & Create School'}
            </Button>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
