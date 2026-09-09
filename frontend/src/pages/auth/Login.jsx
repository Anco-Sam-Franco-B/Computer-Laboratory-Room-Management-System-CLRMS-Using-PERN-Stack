import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Monitor, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { Input } from '../../components/ui/Input';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import AuthLayout from '../../components/layout/AuthLayout';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      await login(values);
      toast.success(`Welcome back!`);
      const from = location.state?.from || '/app';
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(extractError(err, 'Login failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to CLRMS"
      subtitle="Manage laboratories, bookings, attendance and maintenance in one place."
      footer={
        <p className="text-center text-sm text-slate-500">
          New to CLRMS?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email address" error={errors.email?.message}>
          <Input type="email" placeholder="you@school.edu" name="email" register={register} error={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              name="password"
              register={register}
              error={!!errors.password}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner size={16} /> : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}