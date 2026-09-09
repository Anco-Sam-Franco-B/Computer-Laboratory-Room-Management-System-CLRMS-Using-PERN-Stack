import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { Input, Select } from '../../components/ui/Input';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import AuthLayout from '../../components/layout/AuthLayout';

const schema = z
  .object({
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    email: z.string().email('Enter a valid email'),
    role: z.enum(['student', 'lecturer']),
    studentId: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(8, 'At least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain upper, lower and number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

const ROLES_SELECT = [
  { value: 'student', label: 'Student' },
  { value: 'lecturer', label: 'Lecturer' },
];

export default function Register() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const { register: reg, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'student', studentId: '', phone: '' },
  });

  const role = watch('role');

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      await register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        studentId: values.role === 'student' ? values.studentId : undefined,
        phone: values.phone || undefined,
      });
      setDone(true);
    } catch (err) {
      toast.error(extractError(err, 'Registration failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Check your inbox">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your account was created. We sent a verification link to your email — please confirm it to activate your account,
          then sign in.
        </p>
        <button className="btn-primary mt-5 w-full" onClick={() => navigate('/login')}>
          Go to sign in
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Register to request lab bookings and view schedules."
      footer={
        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}>
            <Input placeholder="Jane" name="firstName" register={reg} error={!!errors.firstName} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input placeholder="Doe" name="lastName" register={reg} error={!!errors.lastName} />
          </Field>
        </div>
        <Field label="Email address" error={errors.email?.message}>
          <Input type="email" placeholder="you@school.edu" name="email" register={reg} error={!!errors.email} />
        </Field>
        <Field label="I am a" error={errors.role?.message}>
          <Select name="role" register={reg}>
            {ROLES_SELECT.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
        {role === 'student' && (
          <Field label="Student ID" error={errors.studentId?.message}>
            <Input placeholder="STU-0001" name="studentId" register={reg} error={!!errors.studentId} />
          </Field>
        )}
        <Field label="Phone (optional)" error={errors.phone?.message}>
          <Input placeholder="+1 555 000 0000" name="phone" register={reg} error={!!errors.phone} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" error={errors.password?.message}>
            <Input type="password" placeholder="Min 8 chars" name="password" register={reg} error={!!errors.password} />
          </Field>
          <Field label="Confirm password" error={errors.confirmPassword?.message}>
            <Input type="password" placeholder="Repeat password" name="confirmPassword" register={reg} error={!!errors.confirmPassword} />
          </Field>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner size={16} /> : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}