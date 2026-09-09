import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { Input } from '../../components/ui/Input';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import AuthLayout from '../../components/layout/AuthLayout';

const schema = z
  .object({
    newPassword: z.string().min(8, 'At least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain upper, lower and number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ newPassword }) => {
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      toast.success('Password reset successfully. Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(extractError(err, 'Could not reset password.'));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link">
        <p className="text-sm text-slate-600 dark:text-slate-300">This reset link is missing or invalid. Please request a new one.</p>
        <Link to="/forgot-password" className="btn-primary mt-5 block w-full text-center">Request new link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password you do not use elsewhere.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="New password" error={errors.newPassword?.message}>
          <Input type="password" placeholder="Min 8 chars" name="newPassword" register={register} error={!!errors.newPassword} />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message}>
          <Input type="password" placeholder="Repeat password" name="confirmPassword" register={register} error={!!errors.confirmPassword} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner size={16} /> : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}