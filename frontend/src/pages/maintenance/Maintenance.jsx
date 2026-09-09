import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wrench, Plus, Search, UserCog, MessageSquare, DollarSign, CheckCircle2, Cpu } from 'lucide-react';
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
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PRIORITY_COLORS } from '../../lib/constants';

const createSchema = z.object({
  title: z.string().min(2, 'Title required'),
  description: z.string().min(5, 'Description required'),
  targetType: z.enum(['computer', 'equipment', 'lab', 'other']),
  computerId: z.string().uuid().or(z.literal('')).optional(),
  equipmentId: z.string().uuid().or(z.literal('')).optional(),
  laboratoryId: z.string().uuid().or(z.literal('')).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

export default function Maintenance() {
  const user = useAuthStore((s) => s.user);
  const canCreate = ['super_admin', 'lab_manager', 'technician', 'lecturer'].includes(user?.roleCode);
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/maintenance');
  const [computers, setComputers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [labs, setLabs] = useState([]);
  const [techs, setTechs] = useState([]);
  const [detail, setDetail] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [note, setNote] = useState('');
  const [costAddition, setCostAddition] = useState('');
  const [newPart, setNewPart] = useState({ partName: '', quantity: 1, unitCost: '' });
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(createSchema) });
  const watchTarget = watch('targetType', 'computer');

  useEffect(() => {
    api.get('/computers?limit=100').then((r) => setComputers(r.data.data)).catch(() => {});
    api.get('/equipment?limit=100').then((r) => setEquipment(r.data.data)).catch(() => {});
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
    api.get('/users?limit=200').then((r) => setTechs(r.data.data.filter((u) => u.role_code === 'technician'))).catch(() => {});
  }, []);

  const openCreate = () => { reset({ targetType: 'computer', priority: 'medium' }); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      await api.post('/maintenance', { ...values, computerId: values.computerId || null, equipmentId: values.equipmentId || null, laboratoryId: values.laboratoryId || null });
      toast.success('Ticket created.');
      form.closeModal();
      reload();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const openDetail = async (ticket) => {
    setDetail(ticket);
    const [u, d] = await Promise.all([
      api.get(`/maintenance/${ticket.id}/updates`).catch(() => ({ data: { data: [] } })),
      api.get(`/maintenance/${ticket.id}`).then((r) => r.data.data).catch(() => ticket),
    ]);
    setUpdates(u.data.data);
    setDetail(d);
    setNote(''); setCostAddition(''); setNewPart({ partName: '', quantity: 1, unitCost: '' });
  };

  const doProgress = async (status) => {
    try {
      await api.patch(`/maintenance/${detail.id}/progress`, { status, note: note || undefined, costAddition: costAddition ? Number(costAddition) : undefined });
      toast.success('Ticket updated.');
      openDetail(detail);
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const doAssign = async () => {
    try {
      await api.post(`/maintenance/${detail.id}/assign`, { technicianId: assignee });
      toast.success('Assigned.');
      openDetail(detail); reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const doAddPart = async () => {
    try {
      await api.post(`/maintenance/${detail.id}/parts`, newPart);
      toast.success('Part added.');
      openDetail(detail);
    } catch (e) { toast.error(extractError(e)); }
  };

  const doClose = async () => {
    try { await api.post(`/maintenance/${detail.id}/close`); toast.success('Ticket closed.'); openDetail(detail); reload(); }
    catch (e) { toast.error(extractError(e)); }
  };

  const cols = [
    { key: 'ticket_no', label: 'Ticket', render: (r) => <span className="font-semibold text-slate-700 dark:text-slate-200">{r.ticket_no}</span> },
    { key: 'title', label: 'Issue', render: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-slate-400">{r.laboratory_name || r.computer_number || '—'}</p></div> },
    { key: 'assigned_to_name', label: 'Technician', render: (r) => r.assigned_to_name || <span className="text-slate-400">Unassigned</span> },
    { key: 'priority', label: 'Priority', render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'total_cost', label: 'Cost', render: (r) => formatCurrency(Number(r.cost || 0) + Number(r.parts_cost || 0)) },
  ];

  return (
    <div>
      <PageHeader title="Maintenance Tickets" subtitle="Track repairs, assignments, parts and costs" icon={<Wrench size={20} />}
        actions={canCreate && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New ticket</button>} />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search tickets…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table loading={loading} columns={cols} rows={rows} empty="No maintenance tickets."
        onRowClick={openDetail}
        actions={(r) => ['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode)
          ? <button className="btn-ghost !px-2 !py-1" onClick={() => openDetail(r)}><UserCog size={15} /></button> : null} />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      {/* Create */}
      <Modal open={form.isOpen} onClose={form.closeModal} title="Open maintenance ticket" size="lg"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="mt-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Create ticket'}</button></>}>
        <form id="mt-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required error={errors.title?.message}><Input placeholder="Broken monitor" name="title" register={register} error={!!errors.title} /></Field>
            <Field label="Priority" required>
              <Select name="priority" register={register}>
                {Object.keys(PRIORITY_COLORS).map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Description" required error={errors.description?.message}><Textarea name="description" register={register} placeholder="Describe the problem…" error={!!errors.description} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target type">
              <Select name="targetType" register={register}>
                <option value="computer">Computer</option><option value="equipment">Equipment</option><option value="lab">Laboratory</option><option value="other">Other</option>
              </Select>
            </Field>
            <div>
              {watchTarget === 'computer' && <Field label="Computer"><Select name="computerId" register={register}><option value="">— Select —</option>{computers.map((c) => <option key={c.id} value={c.id}>{c.computer_number}</option>)}</Select></Field>}
              {watchTarget === 'equipment' && <Field label="Equipment"><Select name="equipmentId" register={register}><option value="">— Select —</option>{equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>}
              {watchTarget === 'lab' && <Field label="Laboratory"><Select name="laboratoryId" register={register}><option value="">— Select —</option>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>}
            </div>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.ticket_no || ''} size="lg"
        footer={<button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>}>
        {detail && (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{detail.title}</h3>
                <StatusBadge status={detail.status} />
                <PriorityBadge priority={detail.priority} />
              </div>
              <p className="mt-1 text-sm text-slate-400">{detail.laboratory_name || detail.computer_number || 'General'} · Reported by {detail.reported_by_name || '—'} · {formatDateTime(detail.created_at)}</p>
              <p className="mt-2 text-sm">{detail.description}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="font-medium">Assigned: <span className="text-slate-600 dark:text-slate-300">{detail.assigned_to_name || '—'}</span></span>
                <span className="font-medium">Total cost: <span className="text-slate-600 dark:text-slate-300">{formatCurrency(Number(detail.cost || 0) + Number(detail.parts_cost || 0))}</span></span>
              </div>
            </div>

            {['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode) && !['resolved', 'closed'].includes(detail.status) && (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-surface-700">
                <div className="flex flex-wrap items-end gap-2">
                  {(!detail.assigned_to || detail.assigned_to === null) ? (
                    <>
                      <Field label="Assign to"><select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">— Technician —</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}</select></Field>
                      <button className="btn-primary" onClick={doAssign} disabled={!assignee}><UserCog size={15} /> Assign</button>
                    </>
                  ) : (
                    <>
                      <Field label="Progress note"><Input placeholder="Note…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                      <Field label="Cost addition ($)"><Input type="number" value={costAddition} onChange={(e) => setCostAddition(e.target.value)} /></Field>
                    </>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.status === 'open' && <button className="btn-secondary" onClick={() => doProgress('in_progress')}>Start</button>}
                  <button className="btn-secondary" onClick={() => doProgress(detail.assigned_to ? 'in_progress' : detail.status)}>Update note</button>
                  <button className="btn-emerald" onClick={() => doProgress('resolved')}><CheckCircle2 size={15} /> Resolve</button>
                  <button className="btn-secondary" onClick={doClose}>Close</button>
                </div>
              </div>
            )}

            {['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode) && (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-surface-700">
                <p className="mb-2 text-sm font-semibold"><Cpu size={14} className="mr-1 inline" /> Add part / material</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Part name"><Input placeholder="e.g. RAM stick 8GB" value={newPart.partName} onChange={(e) => setNewPart({ ...newPart, partName: e.target.value })} /></Field>
                  <Field label="Qty"><Input type="number" min={1} value={newPart.quantity} onChange={(e) => setNewPart({ ...newPart, quantity: Number(e.target.value) })} /></Field>
                  <Field label="Unit cost ($)"><Input type="number" min={0} value={newPart.unitCost} onChange={(e) => setNewPart({ ...newPart, unitCost: e.target.value })} /></Field>
                  <button className="btn-secondary" onClick={doAddPart} disabled={!newPart.partName}><Plus size={15} /> Add</button>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold"><MessageSquare size={14} className="mr-1 inline" /> Activity log</p>
              {updates.length === 0 && <p className="text-sm text-slate-400">No updates yet.</p>}
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {updates.map((u) => (
                  <div key={u.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-surface-800">
                    <div className="flex justify-between text-xs text-slate-400"><span>{u.author_name}</span><span>{formatDateTime(u.created_at)}</span></div>
                    <p className="text-slate-700 dark:text-slate-200">{u.note || `${u.status_from || '—'} → ${u.status_to || '—'}`}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}