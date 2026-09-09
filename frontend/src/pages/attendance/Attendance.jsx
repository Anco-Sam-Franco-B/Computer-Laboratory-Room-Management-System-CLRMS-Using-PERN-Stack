import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardCheck, Plus, QrCode, Trash2, Search, UserCheck, UserX, Camera, CalendarDays } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { useApiList } from '../../hooks/useApiList';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../stores/authStore';
import { ATTENDANCE_STATUS_LABELS } from '../../lib/constants';
import { formatDate, formatTime, toTitleCase } from '../../lib/format';

const sessionSchema = z.object({
  laboratoryId: z.string().uuid('Laboratory required'),
  topic: z.string().min(2, 'Topic required'),
  sessionDate: z.string().min(1, 'Date required'),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export default function Attendance() {
  const user = useAuthStore((s) => s.user);
  const canManage = ['super_admin', 'lab_manager', 'lecturer'].includes(user?.roleCode);
  const [tab, setTab] = useState(canManage ? 'sessions' : 'mine');
  const [labs, setLabs] = useState([]);
  const [students, setStudents] = useState([]);
  const [detail, setDetail] = useState(null);
  const [records, setRecords] = useState([]);
  const [qr, setQr] = useState(null);
  const [checkIn, setCheckIn] = useState(null);
  const [bulk, setBulk] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mySummary, setMySummary] = useState(null);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(sessionSchema) });

  const sessions = useApiList('/attendance');
  const my = useApiList('/attendance/my', { searchable: false });

  const refreshAll = () => { sessions.reload(); if (tab === 'mine') my.reload(); };

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
    api.get('/attendance/my').then((r) => setMySummary(r.data.data.summary)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'mine' && !mySummary) api.get('/attendance/my').then((r) => setMySummary(r.data.data.summary)).catch(() => {});
  }, [tab]);

  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    reset({ laboratoryId: '', topic: '', sessionDate: today, startsAt: '', endsAt: '' });
    form.openModal();
  };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      await api.post('/attendance', { ...values, startsAt: values.startsAt || null, endsAt: values.endsAt || null });
      toast.success('Attendance session created. All active students are registered as absent.');
      form.closeModal();
      sessions.reload();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const openDetail = async (session) => {
    setDetail(session);
    setRecords([]);
    const res = await api.get(`/attendance/${session.id}/records`);
    setRecords(res.data.data);
    if (canManage) {
      const all = await api.get(`/attendance/${session.id}/all-students`);
      setStudents(all.data.data);
    }
  };

  const doMark = async (userId, status) => {
    try {
      await api.post(`/attendance/${detail.id}/mark`, { records: [{ userId, status }] });
      setRecords((prev) => prev.map((r) => (r.user_id === userId ? { ...r, status } : r)));
      toast.success(`${ATTENDANCE_STATUS_LABELS[status]} recorded.`);
    } catch (e) { toast.error(extractError(e)); }
  };

  const doMarkAll = async () => {
    try {
      await api.post(`/attendance/${bulk.id}/mark-all`, { status: bulk.status });
      toast.success(`All remaining marked ${bulk.status}.`);
      openDetail(bulk);
      setBulk(null);
    } catch (e) { toast.error(extractError(e)); }
  };

  const generateQR = async (session) => {
    setBusy(true);
    try {
      const res = await api.post(`/attendance/${session.id}/qr?minutes=60`);
      setQr(res.data.data);
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const doCheckIn = async () => {
    if (!checkIn?.token) { toast.error('Enter the QR token first.'); return; }
    setBusy(true);
    try {
      await api.post('/attendance/scan', { qrToken: checkIn.token });
      toast.success('Checked in successfully!');
      setCheckIn(null);
      my.reload();
      api.get('/attendance/my').then((r) => setMySummary(r.data.data.summary)).catch(() => {});
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    try { await api.delete(`/attendance/${confirmDelete.id}`); toast.success('Session deleted.'); sessions.reload(); setConfirmDelete(null); }
    catch (e) { toast.error(extractError(e)); }
  };

  const sessionCols = [
    { key: 'topic', label: 'Session', render: (r) => <div><p className="font-semibold">{r.topic}</p><p className="text-xs text-slate-400">{r.laboratory_name} · {formatTime(r.starts_at)}–{formatTime(r.ends_at)}</p></div> },
    { key: 'session_date', label: 'Date', render: (r) => formatDate(r.session_date) },
    { key: 'lecturer_name', label: 'Lecturer', render: (r) => r.lecturer_name || '—' },
    { key: 'present', label: 'Attendance', render: (r) => (
      <div className="flex gap-2 text-xs">
        <span className="text-emerald-500">{r.present} ✓</span><span className="text-amber-500">{r.late} late</span><span>{r.total_students} total</span>
      </div>
    ) },
  ];

  const myCols = [
    { key: 'topic', label: 'Session', render: (r) => <div><p className="font-semibold">{r.topic}</p><p className="text-xs text-slate-400">{r.laboratory_name}</p></div> },
    { key: 'session_date', label: 'Date', render: (r) => formatDate(r.session_date) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'check_in_time', label: 'Checked in', render: (r) => r.check_in_time ? formatDateTime(r.check_in_time) : '—' },
  ];

  const [detailRecords, setDetailRecords] = useState([]);

  useEffect(() => { setDetailRecords(records); }, [records]);

  return (
    <div>
      <PageHeader title="Attendance" subtitle="QR-based lab session check-in and records" icon={<ClipboardCheck size={20} />}
        actions={canManage && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Start session</button>} />

      {user?.roleCode === 'student' && mySummary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatMini label="Total sessions" value={mySummary.total} color="text-slate-600" />
          <StatMini label="Present" value={mySummary.present} color="text-emerald-500" />
          <StatMini label="Late" value={mySummary.late} color="text-amber-500" />
          <StatMini label="Absent" value={mySummary.absent} color="text-rose-500" />
          <StatMini label="Excused" value={mySummary.excused} color="text-blue-500" />
        </div>
      )}

      <div className="mb-4 flex gap-1">
        <button className={`btn ${tab === 'sessions' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('sessions')}><CalendarDays size={15} /> Sessions</button>
        <button className={`btn ${tab === 'mine' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('mine')}><UserCheck size={15} /> My attendance</button>
        {user?.roleCode === 'student' && <button className={`btn ${tab === 'checkin' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('checkin')}><QrCode size={15} /> QR check-in</button>}
      </div>

      {tab === 'checkin' && (
        <div className="card mx-auto max-w-md">
          <h3 className="mb-1 text-md font-semibold">Scan your session QR</h3>
          <p className="mb-4 text-sm text-slate-400">Ask your lecturer to open the session's QR code, then enter the token below.</p>
          <Field label="QR token" required>
            <Input placeholder="Paste token from the lecturer's QR…"
              value={checkIn?.token || ''} onChange={(e) => setCheckIn({ token: e.target.value })} />
          </Field>
          <button className="btn-primary mt-2" onClick={doCheckIn} disabled={busy}>
            {busy ? <Spinner size={15} /> : <><Camera size={15} /> Check in</>}
          </button>
        </div>
      )}

      {tab === 'sessions' && (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search sessions…" value={sessions.search} onChange={(e) => { sessions.setSearch(e.target.value); sessions.setPage(1); }} />
          </div>
          <Table
            loading={sessions.loading} columns={sessionCols} rows={sessions.rows}
            empty="No attendance sessions yet."
            onRowClick={openDetail}
            actions={(r) => canManage && (
              <>
                <button className="btn-ghost !px-2 !py-1" title="Generate QR" onClick={() => generateQR(r)}><QrCode size={15} /></button>
                {['super_admin', 'lab_manager'].includes(user?.roleCode) && (
                  <button className="btn-ghost !px-2 !py-1 text-rose-500" onClick={() => setConfirmDelete(r)}><Trash2 size={15} /></button>
                )}
              </>
            )}
          />
          <Pagination page={sessions.page} pageCount={sessions.pagination?.pageCount} onPageChange={sessions.setPage} total={sessions.pagination?.total} />
        </>
      )}

      {tab === 'mine' && (
        <>
          {!canManage && my.rows.length === 0 && <EmptyState title="No attendance yet" message="Sessions you check into will appear here." />}
          <Table loading={my.loading} columns={myCols} rows={my.rows} empty="No records." />
          <Pagination page={my.page} pageCount={my.pagination?.pageCount} onPageChange={my.setPage} total={my.pagination?.total} />
        </>
      )}

      {/* Create */}
      <Modal open={form.isOpen} onClose={form.closeModal} title="Start attendance session" size="md"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="att-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Create session'}</button></>}>
        <form id="att-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Laboratory" required error={errors.laboratoryId?.message}>
            <Select name="laboratoryId" register={register}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
          </Field>
          <Field label="Topic" required error={errors.topic?.message}><Input placeholder="CS201 Lab — Loops" name="topic" register={register} error={!!errors.topic} /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Date" required error={errors.sessionDate?.message}><Input type="date" name="sessionDate" register={register} error={!!errors.sessionDate} /></Field>
            <Field label="Starts" error={errors.startsAt?.message}><Input type="time" name="startsAt" register={register} error={!!errors.startsAt} /></Field>
            <Field label="Ends" error={errors.endsAt?.message}><Input type="time" name="endsAt" register={register} error={!!errors.endsAt} /></Field>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.topic || ''} size="lg"
        footer={<button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>}>
        {detail && (
          <div>
            <p className="mb-2 text-sm text-slate-400">{detail.laboratory_name} · {formatDate(detail.session_date)} · {formatTime(detail.starts_at)}–{formatTime(detail.ends_at)}</p>
            {canManage && (
              <div className="mb-3 flex gap-2">
                <button className="btn-primary" onClick={() => generateQR(detail)}><QrCode size={15} /> QR code</button>
                <button className="btn-secondary" onClick={() => setBulk({ id: detail.id, status: 'absent' })}><UserX size={15} /> Mark rest absent</button>
              </div>
            )}
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {detailRecords.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No students registered in this session.</p>}
              {detailRecords.map((r) => (
                <div key={r.user_id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-surface-700" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold dark:bg-surface-800">{`${r.first_name?.[0] || ''}${r.last_name?.[0] || ''}`}</span>
                    <div>
                      <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-slate-400">{r.student_id || r.email} · {r.department_name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {canManage && (
                      <select className="rounded-md border px-1.5 py-1 text-xs dark:bg-surface-800"
                        value={r.status} onChange={(e) => doMark(r.user_id, e.target.value)}>
                        {Object.keys(ATTENDANCE_STATUS_LABELS).map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* QR */}
      <Modal open={!!qr} onClose={() => setQr(null)} title="Session sign-in QR" size="sm"
        footer={<><button className="btn-secondary" onClick={() => setQr(null)}>Close</button><button className="btn" onClick={() => { navigator.clipboard?.writeText(qr.qrToken).then(() => toast.success('Token copied.')).catch(() => {}); }}>Copy token</button></>}>
        {qr && (
          <div className="flex flex-col items-center gap-3 py-2">
            <img src={qr.qrDataUrl} alt="QR code" className="w-48 rounded-xl" />
            <p className="text-center text-xs text-slate-400">Valid until {formatDateTime(qr.expiresAt)}<br />Students scan this in the Attendance page.</p>
          </div>
        )}
      </Modal>

      {/* Bulk dialog */}
      <Modal open={!!bulk} onClose={() => setBulk(null)} title="Mark all remaining students" size="sm"
        footer={<><button className="btn-secondary" onClick={() => setBulk(null)}>Cancel</button><button className="btn-danger" onClick={doMarkAll}>Apply</button></>}>
        <p className="text-sm">This marks everyone without a present/late record as <b>{bulk?.status}</b>. Continue?</p>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={onDelete}
        title="Delete attendance session?" message={`Delete "${confirmDelete?.topic}" and its records?`} />
    </div>
  );
}

function StatMini({ label, value, color }) {
  return <div className="card !p-3 text-center"><p className={`text-xl font-bold ${color}`}>{value ?? 0}</p><p className="text-xs text-slate-400">{label}</p></div>;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}