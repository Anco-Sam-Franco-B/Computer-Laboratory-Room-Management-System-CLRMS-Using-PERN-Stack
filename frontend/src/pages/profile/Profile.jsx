import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, Lock, Save } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { ROLES } from '../../lib/constants';

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().min(2, 'Last name required'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'At least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Needs upper, lower and a number'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPw, setBusyPw] = useState(false);

  const profileForm = useForm({ resolver: zodResolver(profileSchema), defaultValues: { firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '' } });
  const pwForm = useForm({ resolver: zodResolver(passwordSchema) });

  const saveProfile = async (values) => {
    setBusyProfile(true);
    try {
      const res = await api.put('/profile', values);
      const updated = { ...user, ...res.data.data };
      setUser(updated);
      toast.success('Profile updated.');
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusyProfile(false); }
  };

  const changePassword = async (values) => {
    setBusyPw(true);
    try {
      await api.post('/profile/change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success('Password changed. Sign in again.');
      pwForm.reset();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusyPw(false); }
  };

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your account details and security" icon={<UserRound size={20} />} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-500/10 text-lg font-bold text-brand-600 dark:text-brand-400">
              {`${(user?.firstName || '?')[0]}${(user?.lastName || '?')[0]}`}
            </span>
            <div>
              <p className="text-lg font-semibold">{user?.firstName} {user?.lastName}</p>
              <div className="flex items-center gap-2">
                <StatusBadge role={user?.roleCode} />
                <StatusBadge status={user?.status} />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400">{user?.email}</p>

          <form className="mt-5 space-y-4" onSubmit={profileForm.handleSubmit(saveProfile)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={profileForm.formState.errors.firstName?.message}>
                <Input name="firstName" register={profileForm.register} error={!!profileForm.formState.errors.firstName} />
              </Field>
              <Field label="Last name" error={profileForm.formState.errors.lastName?.message}>
                <Input name="lastName" register={profileForm.register} error={!!profileForm.formState.errors.lastName} />
              </Field>
            </div>
            <Field label="Phone"><Input name="phone" register={profileForm.register} placeholder="+1 555 000 0000" /></Field>
            <div className="flex justify-end">
              <button className="btn-primary" disabled={busyProfile}>{busyProfile ? <Spinner size={15} /> : <><Save size={15} /> Save profile</>}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Lock size={15} /> Change password</h3>
          <p className="mb-4 text-xs text-slate-400">You will be signed out after a successful change.</p>
          <form className="space-y-4" onSubmit={pwForm.handleSubmit(changePassword)}>
            <Field label="Current password" error={pwForm.formState.errors.currentPassword?.message}>
              <Input type="password" name="currentPassword" register={pwForm.register} error={!!pwForm.formState.errors.currentPassword} />
            </Field>
            <Field label="New password" error={pwForm.formState.errors.newPassword?.message}>
              <Input type="password" name="newPassword" register={pwForm.register} error={!!pwForm.formState.errors.newPassword} placeholder="8+ chars, upper, lower, number" />
            </Field>
            <Field label="Confirm new password" error={pwForm.formState.errors.confirmPassword?.message}>
              <Input type="password" name="confirmPassword" register={pwForm.register} error={!!pwForm.formState.errors.confirmPassword} />
            </Field>
            <div className="flex justify-end">
              <button className="btn-primary" disabled={busyPw}>{busyPw ? <Spinner size={15} /> : 'Change password'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}