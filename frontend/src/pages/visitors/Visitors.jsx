import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Plus, Search, LogIn, LogOut, Ban, UserCheck } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { useApiList } from '../../hooks/useApiList';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { formatDateTime } from '../../lib/format';

const schema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  purpose: z.string().min(2, 'Purpose required'),
});

export default function Visitors() {
  const user = useAuthStore((s) => s.user);
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/visitors');
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const canGate = ['super_admin', 'lab_manager', 'technician'].includes(user?.roleCode);

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      await api.post('/visitors', values);
      toast.success('Visitor registered.');
      form.closeModal();
      reset();
      reload();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const gate = async (id, action) => {
    try {
      await api.post(`/visitors/${id}/${action}`);
      toast.success(action === 'check-in' ? 'Checked in.' : action === 'check-out' ? 'Checked out.' : 'Visit denied.');
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const cols = [
    { key: 'full_name', label: 'Visitor', render: (r) => <div><p className="font-semibold">{r.full_name}</p><p className="text-xs text-slate-400">{r.purpose}</p></div> },
    { key: 'email', label: 'Contact', render: (r) => <div className="text-sm"><p>{r.email}</p><p className="text-xs text-slate-400">{r.phone}</p></div> },
    { key: 'id_number', label: 'ID' },
    { key: 'host_user_name', label: 'Authorized by', render: (r) => r.host_user_name || <span className="text-slate-400">—</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'checked_in_at', label: 'Times', render: (r) => <div className="text-xs"><p>In: {formatDateTime(r.checked_in_at)}</p><p>Out: {formatDateTime(r.checked_out_at)}</p></div> },
  ];

  return (
    <div>
      <PageHeader title="Visitor Log" subtitle="Track lab visitors, check-ins and approvals" icon={<Users size={20} />}
        actions={<button className="btn-primary" onClick={() => form.openModal()}><Plus size={16} /> Register visitor</button>} />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search visitors…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table
        loading={loading} columns={cols} rows={rows} empty="No visitors logged yet."
        actions={(r) => canGate && (
          <>
            {r.status === 'pending' && <button className="btn-ghost !px-2 !py-1 text-emerald-600" title="Check in" onClick={() => gate(r.id, 'check-in')}><LogIn size={15} /></button>}
            {r.status === 'checked_in' && <button className="btn-ghost !px-2 !py-1 text-blue-600" title="Check out" onClick={() => gate(r.id, 'check-out')}><LogOut size={15} /></button>}
            {r.status === 'pending' && <button className="btn-ghost !px-2 !py-1 text-rose-600" title="Deny" onClick={() => gate(r.id, 'deny')}><Ban size={15} /></button>}
          </>
        )}
      />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      <Modal open={form.isOpen} onClose={form.closeModal} title="Register visitor" size="md"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="vis-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Register'}</button></>}>
        <form id="vis-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.fullName?.message}><Input name="fullName" register={register} placeholder="Jane Doe" error={!!errors.fullName} /></Field>
            <Field label="ID number"><Input name="idNumber" register={register} placeholder="Passport / staff ID" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={errors.email?.message}><Input type="email" name="email" register={register} placeholder="jane@example.com" error={!!errors.email} /></Field>
            <Field label="Phone"><Input name="phone" register={register} placeholder="+1 555 000 0000" /></Field>
          </div>
          <Field label="Purpose of visit" required error={errors.purpose?.message}><Textarea name="purpose" register={register} placeholder="Visiting Network lab for vendor demo" error={!!errors.purpose} /></Field>
        </form>
      </Modal>
    </div>
  );
}