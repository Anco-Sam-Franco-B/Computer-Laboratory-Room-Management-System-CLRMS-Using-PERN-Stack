import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-surface-950">
      <div className="text-center">
        <p className="text-6xl font-black text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-slate-400">The page you are looking for doesn't exist.</p>
        <Link to="/app" className="btn-primary mt-5">Back to dashboard</Link>
      </div>
    </div>
  );
}