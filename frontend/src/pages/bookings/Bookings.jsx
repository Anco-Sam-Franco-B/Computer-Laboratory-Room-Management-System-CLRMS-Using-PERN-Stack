import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Plus, Check, X, Search, CalendarX2, CalendarCheck, LogIn } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { useApiList } from '../../hooks/useApiList';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { formatDate, formatTime, toTitleCase } from '../../lib/format';
import { SESSION_KINDS, BOOKING_STATUS_LABELS } from '../../lib/constants';

const schema = z.object({
  laboratoryId: z.string().uuid('Laboratory is required'),
  title: z.string().min(2, 'Title required'),
  purpose: z.string().optional(),
  sessionKind: z.enum(SESSION_KINDS),
  date: z.string().min(1, 'Date required'),
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
  attendeeCount: z.coerce.number().int().min(0).optional(),
}).refine((d) => d.endTime > d.startTime, { path: ['endTime'], message: 'End time must be after start time' });

export default function Bookings() {
  const user = useAuthStore((s) => s.user);
  const { rows, loading, page, setPage, search, setSearch, pagination, reload, fetchData } = useApiList('/bookings');
  const [statusFilter, setStatusFilter] = useState('');
  const [labs, setLabs] = useState([]);
  const [errors2, setErrors2] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const form = useModal();
  const { register, handleSubmit, reset, watch, setError, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const canApprove = ['super_admin', 'lab_manager'].includes(user?.roleCode);
  const isStudent = user?.roleCode === 'student';

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData({ page, search, status: statusFilter || undefined });
  }, [page, search, statusFilter]);

  // Pre-select lab if navigated with ?lab=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new')) form.openModal();
  }, []);

  const onSubmit = async (values) => {
    setBusy(true);
    setErrors2(null);
    try {
      const res = await api.post('/bookings', { ...values, attendeeCount: values.attendeeCount || 0 });
      toast.success('Booking requested successfully.');
      form.closeModal();
      reset();
      reload();
    } catch (err) {
      const msg = extractError(err);
      if (err.response?.status === 409) {
        setErrors2(msg);
        setValue('endTime', undefined);
      } else {
        setError('root', { message: msg });
      }
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const act = async (id, action, note) => {
    try {
      await api.post(`/bookings/${id}/${action}`, note ? { note } : {});
      toast.success(BOOKING_STATUS_LABELS[action] || action);
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const columns = [
    { key: 'title', label: 'Booking', render: (r) => <div><p className="font-semibold">{r.title}</p><p className="text-xs text-slate-400">{r.laboratory_name}</p></div> },
    { key: 'requester_name', label: 'Requester' },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    { key: 'time', label: 'Time', render: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}` },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Request and manage laboratory bookings" icon={<CalendarDays size={20} />}
        actions={!isStudent && <button className="btn-primary" onClick={() => form.openModal()}><Plus size={16} /> Request booking</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search bookings…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-40" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.keys(BOOKING_STATUS_LABELS).map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <Table
        loading={loading} columns={columns} rows={rows}
        empty="No bookings found."
        onRowClick={(r) => setRejecting({ view: r })}
        actions={(r) => (
          <>
            {canApprove && r.status === 'pending' && (
              <>
                <button className="btn !px-2 !py-1 bg-emerald-600 text-white hover:bg-emerald-700" title="Approve" onClick={() => act(r.id, 'approve')}><Check size={15} /></button>
                <button className="btn !px-2 !py-1 bg-rose-600 text-white hover:bg-rose-700" title="Reject" onClick={() => setRejecting({ id: r.id, title: r.title })}><X size={15} /></button>
              </>
            )}
            {r.status === 'approved' && ['lab_manager', 'super_admin', 'lecturer'].includes(user?.roleCode) && (
              <>
                <button className="btn-ghost !px-2 !py-1" title="Complete" onClick={() => act(r.id, 'complete')}><CalendarCheck size={15} /></button>
                <button className="btn-ghost !px-2 !py-1" title="Check in" onClick={() => act(r.id, 'check-in')}><LogIn size={15} /></button>
              </>
            )}
            {(r.status === 'approved' || r.status === 'pending') && (r.requester_id === user?.id || canApprove) && (
              <button className="btn-ghost !px-2 !py-1 text-rose-500" title="Cancel" onClick={() => act(r.id, 'cancel')}><CalendarX2 size={15} /></button>
            )}
          </>
        )}
      />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      {/* Create booking */}
      <Modal open={form.isOpen} onClose={form.closeModal} title="Request laboratory booking" size="lg"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="booking-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Submit request'}</button></>}>
        <form id="booking-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors2 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              {errors2}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Laboratory" required error={errors.laboratoryId?.message}>
              <Select name="laboratoryId" register={register} error={!!errors.laboratoryId}>
                <option value="">Select laboratory…</option>
                {labs.filter((l) => l.status !== 'closed').map((l) => <option key={l.id} value={l.id}>{l.name} {l.status === 'maintenance' ? '(maintenance)' : ''}</option>)}
              </Select>
            </Field>
            <Field label="Session type" required>
              <Select name="sessionKind" register={register}>
                {SESSION_KINDS.map((k) => <option key={k} value={k}>{toTitleCase(k)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Title" required error={errors.title?.message}>
            <Input placeholder="e.g. CS201 Intro to Programming Lab" name="title" register={register} error={!!errors.title} />
          </Field>
          <Field label="Purpose">
            <Textarea name="purpose" register={register} placeholder="What is this session for?" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Date" required error={errors.date?.message}>
              <Input type="date" name="date" register={register} error={!!errors.date} />
            </Field>
            <Field label="Start" required error={errors.startTime?.message}>
              <Input type="time" name="startTime" register={register} error={!!errors.startTime} />
            </Field>
            <Field label="End" required error={errors.endTime?.message}>
              <Input type="time" name="endTime" register={register} error={!!errors.endTime} />
            </Field>
            <Field label="Attendees" error={errors.attendeeCount?.message}>
              <Input type="number" placeholder="0" name="attendeeCount" register={register} error={!!errors.attendeeCount} />
            </Field>
          </div>
          <p className="text-xs text-slate-400">Tip: pick a laboratory with green status — conflicts are detected automatically.</p>
        </form>
      </Modal>

      {/* Reject dialog */}
      {rejecting?.id && (
        <Modal open onClose={() => setRejecting(null)} title={`Reject "${rejecting.title}"`} size="sm"
          footer={<><button className="btn-secondary" onClick={() => setRejecting(null)}>Cancel</button><button className="btn-danger" onClick={() => { act(rejecting.id, 'reject', rejecting.reason); setRejecting(null); }}>Reject</button></>}>
          <Field label="Reason (optional)">
            <textarea className="input min-h-[70px]" placeholder="Why is this booking rejected?"
              value={rejecting.reason || ''}
              onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} />
          </Field>
        </Modal>
      )}

      {/* View dialog */}
      {rejecting?.view && (
        <Modal open onClose={() => setRejecting(null)} title={rejecting.view.title} size="md"
          footer={<button className="btn-secondary" onClick={() => setRejecting(null)}>Close</button>}>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Laboratory:</span> {rejecting.view.laboratory_name}</p>
            <p><span className="font-medium">Requester:</span> {rejecting.view.requester_name}</p>
            <p><span className="font-medium">Date:</span> {formatDate(rejecting.view.date)} · {formatTime(rejecting.view.start_time)}–{formatTime(rejecting.view.end_time)}</p>
            <p><span className="font-medium">Status:</span> <StatusBadge status={rejecting.view.status} /></p>
            <p><span className="font-medium">Type:</span> {toTitleCase(rejecting.view.session_kind)}</p>
            {rejecting.view.purpose && <p><span className="font-medium">Purpose:</span> {rejecting.view.purpose}</p>}
            {rejecting.view.approver_name && <p><span className="font-medium">Approved by:</span> {rejecting.view.approver_name}</p>}
            {rejecting.view.approval_note && <p><span className="font-medium">Decision note:</span> {rejecting.view.approval_note}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}