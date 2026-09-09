import { motion } from 'framer-motion';

export default function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        {icon && <span className="rounded-xl bg-brand-500/10 p-2.5 text-brand-600 dark:text-brand-400">{icon}</span>}
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}