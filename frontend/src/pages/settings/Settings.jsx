import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, ScrollText, Search, RotateCcw } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../stores/authStore';
import { formatDateTime } from '../../lib/format';

const DESCRIPTIONS = {
  institution_name: 'Name of the institution',
  institution_short_name: 'Short name / acronym',
  smtp_from_email: 'Sender email for system notifications',
  'security.max_login_attempts': 'Failed login attempts before lockout',
  'security.lockout_minutes': 'Minutes an account stays locked',
  'attendance.late_after_minutes': 'Minutes after start before check-in counts as late',
  'booking.conflict_margin_minutes': 'Minimum gap (min) between bookings',
  'notifications.weekly_summary': 'Send weekly summary emails',
};

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState('settings');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logPagination, setLogPagination] = useState(null);
  const [logSearch, setLogSearch] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const isAdmin = user?.roleCode === 'super_admin';

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data || {});
    } catch (e) { toast.error(extractError(e)); }
    finally { setLoading(false); }
  };

  const loadLogs = async (page = 1) => {
    setLogLoading(true);
    try {
      const query = new URLSearchParams({ page, limit: 20 });
      if (logSearch) query.set('search', logSearch);
      const res = await api.get(`/settings/audit-logs?${query.toString()}`);
      setLogs(res.data.data);
      setLogPagination(res.data.pagination);
    } catch (e) { toast.error(extractError(e)); }
    finally { setLogLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { if (tab === 'audit' && isAdmin) loadLogs(logPage); }, [tab, logPage, logSearch]);

  const setValue = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved.');
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const logCols = [
    { key: 'created_at', label: 'When', render: (r) => formatDateTime(r.created_at) },
    { key: 'actor_email', label: 'Actor', render: (r) => r.actor_email || 'system' },
    { key: 'action', label: 'Action', render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-surface-800">{r.action}</code> },
    { key: 'category', label: 'Category', render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'ip_address', label: 'IP', render: (r) => r.ip_address || '—' },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="System configuration and audit trail" icon={<SettingsIcon size={20} />} />

      <div className="mb-4 flex gap-1">
        <button className={`btn ${tab === 'settings' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('settings')}><SettingsIcon size={15} /> System settings</button>
        {isAdmin && <button className={`btn ${tab === 'audit' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setTab('audit'); }}><ScrollText size={15} /> Audit logs</button>}
      </div>

      {tab === 'settings' && (
        <div className="card max-w-2xl">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : (
            <div className="space-y-4">
              {Object.keys(settings).sort().map((key) => (
                <Field key={key} label={key} hint={DESCRIPTIONS[key]}>
                  <div className="flex items-start gap-2">
                    <Input
                      value={typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : String(settings[key])}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^(true|false)$/i.test(v)) setValue(key, v.toLowerCase() === 'true');
                        else if (/^\d+(\.\d+)?$/.test(v)) setValue(key, Number(v));
                        else setValue(key, v);
                      }}
                    />
                    <button className="btn-ghost !px-2 !py-2" title="Reset hint" onClick={() => setValue(key, settings[key])}><RotateCcw size={14} /></button>
                  </div>
                </Field>
              ))}
              <div className="flex justify-end border-t pt-4">
                <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner size={15} /> : <><Save size={15} /> Save all</>}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && isAdmin && (
        <div>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search actions or actors…" value={logSearch} onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }} />
          </div>
          <Table loading={logLoading} columns={logCols} rows={logs} empty="No audit log entries." />
          <Pagination page={logPage} pageCount={logPagination?.pageCount} onPageChange={setLogPage} total={logPagination?.total} />
        </div>
      )}
    </div>
  );
}