import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { Input } from '../../components/ui/Input';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import AuthLayout from '../../components/layout/AuthLayout';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function ForgotPassword() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(extractError(err, 'Could not send reset link.'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Reset link sent" subtitle="If an account exists for that email, a reset link is on its way.">
        <Link to="/login" className="btn-primary w-full block text-center">Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a secure reset link (valid 15 minutes)."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email address" error={errors.email?.message}>
          <Input type="email" placeholder="you@school.edu" name="email" register={register} error={!!errors.email} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner size={16} /> : 'Send reset link'}
        </button>
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}