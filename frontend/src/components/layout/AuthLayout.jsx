import { Monitor } from 'lucide-react';

export default function AuthLayout({ title, subtitle, children, footer, logo = true }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-surface-950 to-brand-950 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {logo && (
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-card-lg">
              <Monitor size={22} />
            </span>
          )}
          <h1 className="text-2xl font-bold text-white">CLRMS</h1>
          <p className="mt-0.5 text-sm text-slate-400">Computer Laboratory Room Management System</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-card-lg dark:bg-surface-900/95 md:p-8">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </div>
  );
}