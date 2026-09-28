import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '../hooks/useApi';
import { GlassCard } from '../components/ui/GlassCard';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { User as UserIcon, Mail, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import { ROLE_LABEL } from '../lib/rbac';

/** Every dashboard role's own account page — deliberately view-only for identity fields (name,
 * email). A school's admin account is provisioned by Tcheck/the school's own super admin, not
 * something the holder should be able to quietly rename or redirect to a different inbox, so the
 * only self-service action here is changing your own password. */
export function ProfilePage() {
  const { user } = useAuth();
  const { mutate, loading, error } = useMutation<{ success: boolean }>('patch');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');

  if (!user) return null;

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleChangePassword = async () => {
    setFormError('');
    setSaved(false);
    if (!canSubmit) return;
    try {
      await mutate('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error state below reads from the mutation hook's own `error`
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your account details and password.</p>
      </div>

      <GlassCard>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 flex items-center justify-center text-white font-bold text-xl shrink-0">
            {user.firstName[0]?.toUpperCase()}{user.lastName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABEL[user.role]}{user.school ? ` · ${user.school.name}` : ''}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
            <UserIcon size={16} className="text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Full Name</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.firstName} {user.lastName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
            <Mail size={16} className="text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
            <ShieldCheck size={16} className="text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Role</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Your name and email are managed by your administrator and can't be changed here.
        </p>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
        </div>
        <div className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {mismatch && <p className="text-xs text-red-500">Passwords don't match.</p>}
          {(error || formError) && <p className="text-xs text-red-500">{error || formError}</p>}
          {saved && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={14} /> Password updated.
            </p>
          )}
          <Button onClick={handleChangePassword} disabled={!canSubmit || loading} className="w-full">
            {loading ? 'Updating…' : 'Update Password'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
