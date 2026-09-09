import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Cpu, Plus, Pencil, Trash2, Search, ArrowRightLeft } from 'lucide-react';
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
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge from '../../components/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { EQUIPMENT_TYPES } from '../../lib/constants';
import { toTitleCase } from '../../lib/format';

const schema = z.object({
  equipmentType: z.enum(EQUIPMENT_TYPES),
  name: z.string().min(2, 'Name required'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(['active', 'in_repair', 'retired']),
  laboratoryId: z.string().uuid().or(z.literal('')).optional(),
  notes: z.string().optional(),
});

export default function Equipment() {
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/equipment');
  const user = useAuthStore((s) => s.user);
  const canManage = ['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode);
  const [labs, setLabs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.isOpen) reset(editing || { status: 'active', equipmentType: 'printer' });
  }, [form.isOpen, editing]);

  const openCreate = () => { setEditing(null); form.openModal(); };
  const openEdit = (e) => { setEditing(e); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const payload = { ...values, laboratoryId: values.laboratoryId || null };
      if (editing) await api.patch(`/equipment/${editing.id}`, payload);
      else await api.post('/equipment', payload);
      toast.success(editing ? 'Equipment updated.' : 'Equipment registered.');
      form.closeModal();
      reload();
    } catch (err) {
      toast.error(extractError(err));
    } finally { setBusy(false); }
  };

  const doTransfer = async () => {
    try {
      await api.post(`/equipment/${transferTarget.id}/transfer`, { toLabId: transferTarget.lab, reason: transferTarget.reason });
      toast.success('Equipment transferred.');
      setTransferTarget(null);
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const onDelete = async () => {
    try { await api.delete(`/equipment/${confirmDelete.id}`); toast.success('Equipment deleted.'); reload(); }
    catch (e) { toast.error(extractError(e)); }
  };

  const columns = [
    { key: 'name', label: 'Equipment', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-400">{r.brand} {r.model}</p></div> },
    { key: 'equipment_type', label: 'Type', render: (r) => <span className="capitalize">{toTitleCase(r.equipment_type)}</span> },
    { key: 'serial_number', label: 'Serial', render: (r) => r.serial_number || '—' },
    { key: 'laboratory_name', label: 'Laboratory', render: (r) => r.laboratory_name || <span className="text-slate-400">Unassigned</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Equipment Inventory" subtitle={`${pagination?.total || 0} devices`} icon={<Cpu size={20} />}
        actions={canManage && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Register equipment</button>} />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search equipment…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table
        loading={loading} columns={columns} rows={rows}
        empty="No equipment records."
        actions={(r) => canManage && (
          <>
            <button className="btn-ghost !px-2 !py-1" title="Transfer" onClick={() => setTransferTarget({ id: r.id, name: r.name, lab: r.laboratory_id || '', reason: '' })}>
              <ArrowRightLeft size={15} />
            </button>
            <button className="btn-ghost !px-2 !py-1" title="Edit" onClick={() => openEdit(r)}><Pencil size={15} /></button>
            {user?.roleCode === 'super_admin' && (
              <button className="btn-ghost !px-2 !py-1 text-rose-500" onClick={() => setConfirmDelete(r)}><Trash2 size={15} /></button>
            )}
          </>
        )}
      />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      <Modal open={form.isOpen} onClose={form.closeModal} title={editing ? 'Edit equipment' : 'Register equipment'} size="lg"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="eq-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Save'}</button></>}>
        <form id="eq-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              <Select name="equipmentType" register={register}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{toTitleCase(t)}</option>)}
              </Select>
            </Field>
            <Field label="Name" required error={errors.name?.message}><Input placeholder="Laser Printer" name="name" register={register} error={!!errors.name} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Brand"><Input name="brand" register={register} placeholder="HP" /></Field>
            <Field label="Model"><Input name="model" register={register} placeholder="LaserJet Pro" /></Field>
            <Field label="Serial number"><Input name="serialNumber" register={register} placeholder="EQ-PR-001" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select name="status" register={register}>
                <option value="active">Active</option><option value="in_repair">In repair</option><option value="retired">Retired</option>
              </Select>
            </Field>
            <Field label="Location">
              <Select name="laboratoryId" register={register}>
                <option value="">— Unassigned —</option>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea name="notes" register={register} /></Field>
        </form>
      </Modal>

      {transferTarget && (
        <Modal open onClose={() => setTransferTarget(null)} title={`Transfer ${transferTarget.name}`} size="sm"
          footer={<><button className="btn-secondary" onClick={() => setTransferTarget(null)}>Cancel</button><button className="btn-primary" onClick={doTransfer}>Transfer</button></>}>
          <div className="space-y-4">
            <Field label="To laboratory">
              <select className="input" value={transferTarget.lab} onChange={(e) => setTransferTarget({ ...transferTarget, lab: e.target.value })}>
                <option value="">— Select —</option>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Reason">
              <textarea className="input min-h-[60px]" value={transferTarget.reason} onChange={(e) => setTransferTarget({ ...transferTarget, reason: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={onDelete}
        title="Delete equipment?" message={`Delete "${confirmDelete?.name}"?`} />
    </div>
  );
}