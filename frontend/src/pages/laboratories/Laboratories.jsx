import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DoorOpen, Plus, Pencil, Trash2, Search, Users, Monitor, Cpu, X } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { useApiList } from '../../hooks/useApiList';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge from '../../components/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { formatTime } from '../../lib/format';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(2, 'Code required'),
  location: z.string().optional(),
  capacity: z.coerce.number().min(0).optional(),
  status: z.enum(['active', 'maintenance', 'closed']).default('active'),
  departmentId: z.string().uuid('Invalid department').or(z.literal('')).optional(),
  labManagerId: z.string().uuid('Invalid manager').or(z.literal('')).optional(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  notes: z.string().optional(),
});

export default function Laboratories() {
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/laboratories');
  const user = useAuthStore((s) => s.user);
  const canManage = ['super_admin', 'lab_manager'].includes(user?.roleCode);
  const [departments, setDepartments] = useState([]);
  const [labManagers, setLabManagers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    api.get('/departments?limit=100').then((r) => setDepartments(r.data.data)).catch(() => {});
    api.get('/users?limit=100').then((r) => setLabManagers(r.data.data.filter((u) => u.role_code === 'lab_manager' || u.role_code === 'super_admin'))).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.isOpen) reset(editing ? {
      name: editing.name, code: editing.code, location: editing.location || '', capacity: editing.capacity,
      status: editing.status, departmentId: editing.department_id || '', labManagerId: editing.lab_manager_id || '',
      opensAt: editing.opens_at || '', closesAt: editing.closes_at || '', notes: editing.notes || '',
    } : { status: 'active', capacity: 20 });
  }, [form.isOpen, editing]);

  const openCreate = () => { setEditing(null); form.openModal(); };
  const openEdit = (lab) => { setEditing(lab); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const payload = { ...values, departmentId: values.departmentId || null, labManagerId: values.labManagerId || null };
      if (editing) await api.patch(`/laboratories/${editing.id}`, payload);
      else await api.post('/laboratories', payload);
      toast.success(editing ? 'Laboratory updated.' : 'Laboratory created.');
      form.closeModal();
      reload();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (lab, status) => {
    try {
      await api.patch(`/laboratories/${lab.id}/status`, { status });
      toast.success(`Laboratory marked as ${status}.`);
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const onDelete = async () => {
    try {
      await api.delete(`/laboratories/${confirmDelete.id}`);
      toast.success('Laboratory deleted.');
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const filtered = useMemo(
    () => (search ? rows.filter((r) => `${r.name} ${r.code} ${r.location}`.toLowerCase().includes(search.toLowerCase())) : rows),
    [rows, search]
  );

  return (
    <div>
      <PageHeader
        title="Laboratories"
        subtitle={`${pagination?.total || 0} computer laboratories`}
        icon={<DoorOpen size={20} />}
        actions={canManage && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> New laboratory
          </button>
        )}
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search laboratories…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={30} className="text-brand-600" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lab) => (
            <div key={lab.id} className="card group cursor-pointer transition hover:shadow-card-lg" onClick={() => setDetail(lab)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <DoorOpen size={20} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{lab.name}</p>
                    <p className="text-xs text-slate-400">{lab.code} · {lab.location || 'No location set'}</p>
                  </div>
                </div>
                <StatusBadge status={lab.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat mini icon={<Users size={14} />} label="Capacity" value={lab.capacity} />
                <Stat mini icon={<Monitor size={14} />} label="Computers" value={lab.computer_count} />
                <Stat mini icon={<Cpu size={14} />} label="Equipment" value={lab.equipment_count} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-slate-400" onClick={(e) => e.stopPropagation()}>
                <span>{formatTime(lab.opens_at)} – {formatTime(lab.closes_at)}</span>
                {canManage && (
                  <div className="flex gap-1">
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) changeStatus(lab, e.target.value); }}
                      className="rounded-md border px-1.5 py-0.5 text-xs dark:bg-surface-800"
                    >
                      <option value="" disabled>Set status…</option>
                      {['active', 'maintenance', 'closed'].filter((s) => s !== lab.status).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button className="btn-ghost !px-1.5 !py-0.5" onClick={() => openEdit(lab)}><Pencil size={14} /></button>
                    {user?.roleCode === 'super_admin' && (
                      <button className="btn-ghost !px-1.5 !py-0.5 text-rose-500" onClick={() => setConfirmDelete(lab)}><Trash2 size={14} /></button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={form.isOpen || !!editing}
        onClose={form.closeModal}
        title={editing ? 'Edit laboratory' : 'New laboratory'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={form.closeModal}>Cancel</button>
            <button className="btn-primary" form="lab-form" disabled={busy}>
              {busy ? <Spinner size={14} /> : editing ? 'Save changes' : 'Create laboratory'}
            </button>
          </>
        }
      >
        <form id="lab-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name?.message}>
              <Input placeholder="Lab 1 — Programming" name="name" register={register} error={!!errors.name} />
            </Field>
            <Field label="Code" required error={errors.code?.message}>
              <Input placeholder="LAB-CS-01" name="code" register={register} error={!!errors.code} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Location" error={errors.location?.message}>
              <Input placeholder="Block A, Room 101" name="location" register={register} error={!!errors.location} />
            </Field>
            <Field label="Capacity" error={errors.capacity?.message}>
              <Input type="number" placeholder="40" name="capacity" register={register} error={!!errors.capacity} />
            </Field>
            <Field label="Status" error={errors.status?.message}>
              <Select name="status" register={register}>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Select name="departmentId" register={register}>
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Operating hours">
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" name="opensAt" register={register} />
                <Input type="time" name="closesAt" register={register} />
              </div>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" register={register} placeholder="Any notes about this laboratory…" />
          </Field>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || ''} size="lg"
        footer={<button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge color="slate">{detail.code}</Badge>
              <StatusBadge status={detail.status} />
              <Badge color="blue">{detail.location || 'No location'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-surface-800"><p className="text-lg font-bold">{detail.capacity}</p><p className="text-xs text-slate-400">Capacity</p></div>
              <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-surface-800"><p className="text-lg font-bold">{detail.computer_count}</p><p className="text-xs text-slate-400">Computers</p></div>
              <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-surface-800"><p className="text-lg font-bold">{detail.equipment_count}</p><p className="text-xs text-slate-400">Equipment</p></div>
              <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-surface-800"><p className="text-lg font-bold">{formatTime(detail.opens_at)}</p><p className="text-xs text-slate-400">Opens</p></div>
            </div>
            <p className="text-sm"><span className="font-medium">Department:</span> {detail.department_name || '—'}</p>
            <p className="text-sm"><span className="font-medium">Lab manager:</span> {detail.lab_manager_name || '—'}</p>
            {detail.notes && <p className="text-sm text-slate-500">{detail.notes}</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={onDelete}
        title="Delete laboratory?"
        message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
      />
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-surface-800">
      <div className="mx-auto mb-1 flex items-center justify-center gap-1 text-slate-400">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-base font-bold text-slate-700 dark:text-slate-200">{value ?? 0}</p>
    </div>
  );
}