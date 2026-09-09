import { motion } from 'framer-motion';

export default function Table({ columns, rows, loading = false, empty, onRowClick, keyField = 'id', actions }) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16 text-slate-400">Loading…</div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="card border border-dashed py-12 text-center text-sm text-slate-400">
        {empty || 'No records found.'}
      </div>
    );
  }
  return (
    <div className="card overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead className="bg-slate-50 dark:bg-surface-800/60">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="th" style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </th>
              ))}
              {actions && <th className="th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, idx) => (
              <motion.tr
                key={row[keyField] ?? idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-800/50' : ''} transition`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="td">
                    {typeof col.render === 'function' ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
                {actions && (
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}