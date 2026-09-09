export default function StatCard({ label, value, icon, color = 'brand', hint, onClick }) {
  const colorMap = {
    brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  };
  return (
    <button
      onClick={onClick}
      className={`card flex items-start justify-between text-left transition hover:shadow-card-lg ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      {icon && (
        <span className={`rounded-lg p-2.5 ${colorMap[color] || colorMap.brand}`}>{icon}</span>
      )}
    </button>
  );
}