import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';

const icons = {
  success: <CheckCircle2 size={18} className="text-emerald-500" />,
  info: <Info size={18} className="text-sky-500" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  error: <XCircle size={18} className="text-rose-500" />,
};

const borders = {
  success: 'border-emerald-200 dark:border-emerald-500/30',
  info: 'border-sky-200 dark:border-sky-500/30',
  warning: 'border-amber-200 dark:border-amber-500/30',
  error: 'border-rose-200 dark:border-rose-500/30',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(22rem,90vw)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-white p-3 text-sm shadow-card-lg dark:bg-surface-800 ${borders[t.type]}`}
          >
            {icons[t.type] || icons.info}
            <span className="flex-1 text-slate-700 dark:text-slate-200">{t.message}</span>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}