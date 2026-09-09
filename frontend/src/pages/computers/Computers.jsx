import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Monitor, Plus, Pencil, Trash2, Search, ArrowRightLeft } from 'lucide-react';
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
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge, { HealthBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../lib/format';

const schema = z.object({
  computerNumber: z.string().min(2, 'Computer number required'),
  serialNumber: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  processor: z.string().optional(),
  ramGb: z.coerce.number().int().min(1).optional(),
  storageGb: z.coerce.number().int().min(8).optional(),
  storageType: z.enum(['HDD', 'SSD', 'NVMe']),
  os: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'broken', 'retired']),
  laboratoryId: z.string().uuid().or(z.literal('')).optional(),
});

export default function Computers() {
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/computers');
  const user = useAuthStore((s) => s.user);
  const canManage = ['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode);
  const [labs, setLabs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.isOpen) reset(editing || { status: 'active', storageType: 'SSD', os: 'Windows 11' });
  }, [form.isOpen, editing]);

  const openCreate = () => { setEditing(null); form.openModal(); };
  const openEdit = (c) => { setEditing(c); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const payload = { ...values, laboratoryId: values.laboratoryId || null };
      if (editing) await api.patch(`/computers/${editing.id}`, payload);
      else await api.post('/computers', payload);
      toast.success(editing ? 'Computer updated.' : 'Computer registered.');
      form.closeModal();
      reload();
    } catch (err) {
      toast.error(extractError(err));
    } finally { setBusy(false); }
  };

  const doAssign = async () => {
    try {
      await api.patch(`/computers/${assignTarget.id}/assign`, { laboratoryId: assignTarget.lab });
      toast.success('Computer assigned.');
      setAssignTarget(null);
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const onDelete = async () => {
    try { await api.delete(`/computers/${confirmDelete.id}`); toast.success('Computer deleted.'); reload(); }
    catch (e) { toast.error(extractError(e)); }
  };

  const columns = [
    { key: 'computer_number', label: 'Number', render: (r) => <span className="font-semibold text-brand-600 dark:text-brand-400">{r.computer_number}</span> },
    { key: 'model', label: 'Machine', render: (r) => <span>{r.brand} {r.model} <span className="text-slate-400">· {r.processor || ''}</span></span> },
    { key: 'specs', label: 'Specs', render: (r) => `${r.ram_gb || '—'} GB RAM · ${r.storage_gb || '—'} GB ${r.storage_type || ''}` },
    { key: 'laboratory_name', label: 'Laboratory', render: (r) => r.laboratory_name || <span className="text-slate-400">Unassigned</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'health_score', label: 'Health', render: (r) => <HealthBadge score={r.health_score} /> },
    { key: 'warranty_until', label: 'Warranty', render: (r) => formatDate(r.warranty_until) },
  ];

  return (
    <div>
      <PageHeader
        title="Computer Inventory"
        subtitle={`${pagination?.total || 0} computers registered`}
        icon={<Monitor size={20} />}
        actions={canManage && (
          <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Register computer</button>
        )}
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search number, serial, model…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table
        loading={loading}
        columns={columns}
        rows={rows}
        empty="No computers match your search."
        actions={(r) => canManage && (
          <>
            <button className="btn-ghost !px-2 !py-1" title="Assign to lab" onClick={() => setAssignTarget({ id: r.id, computer_number: r.computer_number, lab: r.laboratory_id || '' })}>
              <ArrowRightLeft size={15} />
            </button>
            <button className="btn-ghost !px-2 !py-1" title="Edit" onClick={() => openEdit(r)}><Pencil size={15} /></button>
            {user?.roleCode === 'super_admin' && (
              <button className="btn-ghost !px-2 !py-1 text-rose-500" title="Delete" onClick={() => setConfirmDelete(r)}><Trash2 size={15} /></button>
            )}
          </>
        )}
      />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      {/* Form */}
      <Modal
        open={form.isOpen} onClose={form.closeModal}
        title={editing ? 'Edit computer' : 'Register computer'} size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={form.closeModal}>Cancel</button>
            <button className="btn-primary" form="pc-form" disabled={busy}>{busy ? <Spinner size={14} /> : editing ? 'Save' : 'Register'}</button>
          </>
        }
      >
        <form id="pc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Computer number" required error={errors.computerNumber?.message}>
              <Input placeholder="CS1-042" name="computerNumber" register={register} error={!!errors.computerNumber} />
            </Field>
            <Field label="Serial number" error={errors.serialNumber?.message}>
              <Input placeholder="SN-XXXX" name="serialNumber" register={register} error={!!errors.serialNumber} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand" error={errors.brand?.message}><Input placeholder="Dell" name="brand" register={register} /></Field>
            <Field label="Model" error={errors.model?.message}><Input placeholder="OptiPlex 7010" name="model" register={register} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Processor" error={errors.processor?.message}><Input placeholder="Intel Core i5-13500" name="processor" register={register} /></Field>
            <Field label="RAM (GB)" error={errors.ramGb?.message}><Input type="number" placeholder="16" name="ramGb" register={register} /></Field>
            <Field label="Storage (GB)" error={errors.storageGb?.message}><Input type="number" placeholder="512" name="storageGb" register={register} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Storage type">
              <Select name="storageType" register={register}>
                <option value="SSD">SSD</option><option value="NVMe">NVMe</option><option value="HDD">HDD</option>
              </Select>
            </Field>
            <Field label="OS" error={errors.os?.message}><Input placeholder="Windows 11" name="os" register={register} /></Field>
            <Field label="Status">
              <Select name="status" register={register}>
                <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="broken">Broken</option><option value="retired">Retired</option>
              </Select>
            </Field>
          </div>
          <Field label="Assign to laboratory">
            <Select name="laboratoryId" register={register}>
              <option value="">— Unassigned —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>

      {/* Assign dialog */}
      {assignTarget && (
        <Modal open onClose={() => setAssignTarget(null)} title={`Assign ${assignTarget.computer_number}`} size="sm"
          footer={<><button className="btn-secondary" onClick={() => setAssignTarget(null)}>Cancel</button><button className="btn-primary" onClick={doAssign}>Assign</button></>}
        >
          <Field label="Laboratory">
            <select className="input" value={assignTarget.lab} onChange={(e) => setAssignTarget({ ...assignTarget, lab: e.target.value })}>
              <option value="">— Unassigned —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </Modal>
      )}

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={onDelete}
        title="Delete computer?" message={`Delete ${confirmDelete?.computer_number}? This cannot be undone.`} />
    </div>
  );
}