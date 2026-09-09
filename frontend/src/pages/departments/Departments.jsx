import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Plus, Pencil, Trash2, Search, Users, DoorOpen } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { useApiList } from '../../hooks/useApiList';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../stores/authStore';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(2, 'Code required'),
  description: z.string().optional(),
  building: z.string().optional(),
});

export default function Departments() {
  const user = useAuthStore((s) => s.user);
  const { rows, loading, search, setSearch, reload } = useApiList('/departments', { defaultParams: { limit: 100 } });
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (form.isOpen) reset(editing || {});
  }, [form.isOpen, editing]);

  const openCreate = () => { setEditing(null); form.openModal(); };
  const openEdit = (d) => { setEditing(d); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      if (editing) await api.patch(`/departments/${editing.id}`, values);
      else await api.post('/departments', values);
      toast.success(editing ? 'Department updated.' : 'Department created.');
      form.closeModal();
      reload();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    try { await api.delete(`/departments/${confirmDelete.id}`); toast.success('Department deleted.'); reload(); }
    catch (e) { toast.error(extractError(e)); }
  };

  return (
    <div>
      <PageHeader title="Departments" subtitle="Academic departments and their laboratory responsibilities" icon={<Building2 size={20} />}
        actions={user?.roleCode === 'super_admin' && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New department</button>} />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search departments…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={30} className="text-brand-600" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400"><Building2 size={20} /></span>
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.code} · {d.building || '—'}</p>
                  </div>
                </div>
                {user?.roleCode === 'super_admin' && (
                  <div className="flex gap-1">
                    <button className="btn-ghost !px-2 !py-1" onClick={() => openEdit(d)}><Pencil size={15} /></button>
                    <button className="btn-ghost !px-2 !py-1 text-rose-500" onClick={() => setConfirmDelete(d)}><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{d.description || '—'}</p>
              <div className="mt-4 flex gap-4 border-t pt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Users size={14} /> {d.user_count ?? 0} members</span>
                <span className="flex items-center gap-1"><DoorOpen size={14} /> {d.lab_count ?? 0} labs</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={form.isOpen} onClose={form.closeModal} title={editing ? 'Edit department' : 'New department'} size="md"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="dept-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Save'}</button></>}>
        <form id="dept-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name?.message}><Input name="name" register={register} placeholder="Computer Science" error={!!errors.name} /></Field>
            <Field label="Code" required error={errors.code?.message}><Input name="code" register={register} placeholder="CS" error={!!errors.code} /></Field>
          </div>
          <Field label="Building"><Input name="building" register={register} placeholder="Block A" /></Field>
          <Field label="Description"><textarea className="input min-h-[80px]" {...register('description')} placeholder="Department responsibilities…" /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={onDelete}
        title="Delete department?" message={`Delete "${confirmDelete?.name}"? Members will be unlinked.`} />
    </div>
  );
}