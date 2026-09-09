export default function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size={40} className="text-brand-600" />
    </div>
  );
}

export function ButtonSpinner({ label = 'Saving…' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size={14} /> {label}
    </span>
  );
}