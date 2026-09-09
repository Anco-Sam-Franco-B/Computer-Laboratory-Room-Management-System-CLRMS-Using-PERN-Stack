import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Plus, Search, Pencil, Trash2 } from 'lucide-react';
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
import StatusBadge, { PriorityBadge } from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../stores/authStore';
import { INCIDENT_TYPES, toTitleCase } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';

const schema = z.object({
  incidentType: z.enum(INCIDENT_TYPES),
  title: z.string().min(2, 'Title required'),
  description: z.string().min(5, 'Description required'),
  laboratoryId: z.string().uuid().or(z.literal('')).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']),
  resolutionNotes: z.string().optional(),
});

export default function Incidents() {
  const user = useAuthStore((s) => s.user);
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/incidents');
  const [labs, setLabs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const canManage = ['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode);

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.isOpen) reset(editing
      ? { incidentType: editing.incident_type, title: editing.title, description: editing.description || '', laboratoryId: editing.laboratory_id || '', severity: editing.severity, status: editing.status, resolutionNotes: editing.resolution_notes || '' }
      : { incidentType: 'hardware', severity: 'medium', status: 'open' });
  }, [form.isOpen, editing]);

  const openCreate = () => { setEditing(null); form.openModal(); };
  const openEdit = (i) => { setEditing(i); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const payload = { ...values, laboratoryId: values.laboratoryId || null };
      if (editing) await api.patch(`/incidents/${editing.id}`, payload);
      else {
        const { status, resolutionNotes, ...rest } = payload;
        await api.post('/incidents', rest);
      }
      toast.success(editing ? 'Incident updated.' : 'Incident reported.');
      form.closeModal();
      reload();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    try { await api.delete(`/incidents/${confirmDelete.id}`); toast.success('Incident deleted.'); reload(); }
    catch (e) { toast.error(extractError(e)); }
  };

  const cols = [
    { key: 'title', label: 'Incident', render: (r) => <div><p className="font-semibold">{r.title}</p><p className="text-xs text-slate-400">{r.laboratory_name || 'General'}</p></div> },
    { key: 'incident_type', label: 'Type', render: (r) => <span className="capitalize">{toTitleCase(r.incident_type)}</span> },
    { key: 'reported_by_name', label: 'Reported by' },
    { key: 'severity', label: 'Severity', render: (r) => <PriorityBadge priority={r.severity} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created_at', label: 'Reported', render: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Incident Reports" subtitle="Lab incidents, security issues and outages" icon={<AlertTriangle size={20} />}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Report incident</button>} />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search incidents…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table
        loading={loading} columns={cols} rows={rows} empty="No incidents reported."
        onRowClick={(r) => canManage && openEdit(r)}
        actions={(r) => canManage && (
          <>
            <button className="btn-ghost !px-2 !py-1" title="Edit" onClick={() => openEdit(r)}><Pencil size={15} /></button>
            {user?.roleCode === 'super_admin' && <button className="btn-ghost !px-2 !py-1 text-rose-500" onClick={() => setConfirmDelete(r)}><Trash2 size={15} /></button>}
          </>
        )}
      />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      <Modal open={form.isOpen} onClose={form.closeModal} title={editing ? 'Edit incident' : 'Report an incident'} size="lg"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="inc-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Save'}</button></>}>
        <form id="inc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              <Select name="incidentType" register={register}>{INCIDENT_TYPES.map((t) => <option key={t} value={t}>{toTitleCase(t)}</option>)}</Select>
            </Field>
            <Field label="Severity" required>
              <Select name="severity" register={register}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </Select>
            </Field>
          </div>
          <Field label="Title" required error={errors.title?.message}><Input placeholder="Projector not turning on" name="title" register={register} error={!!errors.title} /></Field>
          <Field label="Description" required error={errors.description?.message}><Textarea name="description" register={register} placeholder="Describe what happened…" error={!!errors.description} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Laboratory">
              <Select name="laboratoryId" register={register}><option value="">— None —</option>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            </Field>
            {editing && (
              <Field label="Status" required>
                <Select name="status" register={register}>
                  <option value="open">Open</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                </Select>
              </Field>
            )}
          </div>
          {editing && (
            <Field label="Resolution notes">
              <Textarea name="resolutionNotes" register={register} placeholder="How was this resolved?" />
            </Field>
          )}
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={onDelete}
        title="Delete incident?" message={`Delete "${confirmDelete?.title}"?`} />
    </div>
  );
}