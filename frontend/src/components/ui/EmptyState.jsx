import { motion } from 'framer-motion';

export default function EmptyState({ icon, title, message, action, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center ${className}`}
    >
      {icon && <span className="mb-3 rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800">{icon}</span>}
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}