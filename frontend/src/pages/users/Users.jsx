import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Plus, Pencil, Search, Ban, CircleCheck, Trash2, RotateCcw } from 'lucide-react';
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
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../stores/authStore';
import { ROLES as ROLE_LABELS } from '../../lib/constants';
import { formatDate } from '../../lib/format';

const schema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().min(2, 'Last name required'),
  email: z.string().email('Valid email required'),
  roleCode: z.enum(['super_admin', 'lab_manager', 'technician', 'lecturer', 'student']),
  departmentId: z.string().uuid().or(z.literal('')).optional(),
  studentId: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(8, 'At least 8 characters').optional().or(z.literal('')),
  status: z.enum(['active', 'suspended', 'pending']),
});

export default function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const { rows, loading, page, setPage, search, setSearch, pagination, reload } = useApiList('/users');
  const [departments, setDepartments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [activityFor, setActivityFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useModal();
  const isAdmin = me?.roleCode === 'super_admin';
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const role = watch('roleCode');

  useEffect(() => {
    api.get('/departments?limit=100').then((r) => setDepartments(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.isOpen) reset(editing
      ? { firstName: editing.first_name, lastName: editing.last_name, email: editing.email, roleCode: editing.role_code, departmentId: editing.department_id || '', studentId: editing.student_id || '', phone: editing.phone || '', status: editing.status, password: '' }
      : { roleCode: 'student', status: 'active' });
  }, [form.isOpen, editing]);

  const openCreate = () => { setEditing(null); form.openModal(); };
  const openEdit = (u) => { setEditing(u); form.openModal(); };

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const payload = { ...values, departmentId: values.departmentId || null, password: values.password || undefined };
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      toast.success(editing ? 'User updated.' : 'User created.');
      form.closeModal();
      reload();
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const toggleStatus = async (user) => {
    try {
      await api.patch(`/users/${user.id}/${user.status === 'suspended' ? 'activate' : 'suspend'}`);
      toast.success(user.status === 'suspended' ? 'User reactivated.' : 'User suspended.');
      reload();
    } catch (e) { toast.error(extractError(e)); }
  };

  const resetPassword = async (user) => {
    try {
      await api.patch(`/users/${user.id}`, { password: 'CLRMS@1234' });
      toast.success(`Password reset to CLRMS@1234 for ${user.email}.`);
    } catch (e) { toast.error(extractError(e)); }
  };

  const viewActivity = async (user) => {
    try {
      const res = await api.get(`/users/${user.id}/activity`);
      setActivityFor({ user, logs: res.data.data });
    } catch (e) { toast.error(extractError(e)); }
  };

  const onDelete = async () => {
    try { await api.delete(`/users/${confirmDelete.id}`); toast.success('User deleted.'); reload(); }
    catch (e) { toast.error(extractError(e)); }
  };

  const cols = [
    { key: 'name', label: 'User', render: (r) => (
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600 dark:text-brand-400">{`${r.first_name[0]}${r.last_name[0]}`}</span>
        <div><p className="font-semibold">{r.first_name} {r.last_name}</p><p className="text-xs text-slate-400">{r.email}</p></div>
      </div>
    ) },
    { key: 'role_code', label: 'Role', render: (r) => <StatusBadge role={r.role_code} /> },
    { key: 'department_name', label: 'Department', render: (r) => r.department_name || '—' },
    { key: 'student_id', label: 'Student ID', render: (r) => r.student_id || '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'last_login_at', label: 'Last login', render: (r) => formatDate(r.last_login_at) },
  ];

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${pagination?.total || 0} staff and students`} icon={<Users size={20} />}
        actions={isAdmin && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add user</button>} />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search users…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table
        loading={loading} columns={cols} rows={rows} empty="No users found."
        actions={(r) => isAdmin && (
          <>
            <button className="btn-ghost !px-2 !py-1" title="Activity log" onClick={() => viewActivity(r)}><RotateCcw size={15} /></button>
            <button className="btn-ghost !px-2 !py-1" title="Reset password" onClick={() => resetPassword(r)}><CircleCheck size={15} /></button>
            <button className="btn-ghost !px-2 !py-1" title={r.status === 'suspended' ? 'Activate' : 'Suspend'} onClick={() => toggleStatus(r)}>
              {r.status === 'suspended' ? <RotateCcw size={15} className="text-emerald-600" /> : <Ban size={15} className="text-amber-600" />}
            </button>
            <button className="btn-ghost !px-2 !py-1" title="Edit" onClick={() => openEdit(r)}><Pencil size={15} /></button>
            <button className="btn-ghost !px-2 !py-1 text-rose-500" title="Delete" onClick={() => setConfirmDelete(r)}><Trash2 size={15} /></button>
          </>
        )}
      />
      <Pagination page={page} pageCount={pagination?.pageCount} onPageChange={setPage} total={pagination?.total} />

      <Modal open={form.isOpen} onClose={form.closeModal} title={editing ? `Edit ${editing.first_name}` : 'Add user'} size="lg"
        footer={<><button className="btn-secondary" onClick={form.closeModal}>Cancel</button><button className="btn-primary" form="user-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Save'}</button></>}>
        <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={errors.firstName?.message}><Input name="firstName" register={register} error={!!errors.firstName} /></Field>
            <Field label="Last name" required error={errors.lastName?.message}><Input name="lastName" register={register} error={!!errors.lastName} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={errors.email?.message}><Input type="email" name="email" register={register} error={!!errors.email} /></Field>
            <Field label="Role" required>
              <Select name="roleCode" register={register}>
                {Object.entries(ROLE_LABELS).map(([code]) => <option key={code} value={code}>{ROLE_LABELS[code].label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Select name="departmentId" register={register}><option value="">— None —</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            </Field>
            {role === 'student' ? (
              <Field label="Student ID"><Input name="studentId" register={register} placeholder="e.g. STU2026001" /></Field>
            ) : (
              <Field label="Phone"><Input name="phone" register={register} placeholder="+1 555 000 0000" /></Field>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={editing ? 'New password (leave blank to keep)' : 'Temporary password'} required={!editing} error={errors.password?.message}>
              <Input type="password" name="password" register={register} error={!!errors.password} placeholder="At least 8 characters" />
            </Field>
            <Field label="Status">
              <Select name="status" register={register}>
                <option value="active">Active</option><option value="suspended">Suspended</option><option value="pending">Pending</option>
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      {/* Activity */}
      <Modal open={!!activityFor} onClose={() => setActivityFor(null)} title={`Activity — ${activityFor?.user.first_name} ${activityFor?.user.last_name}`} size="lg"
        footer={<button className="btn-secondary" onClick={() => setActivityFor(null)}>Close</button>}>
        {activityFor && (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {activityFor.logs.length === 0 && <p className="text-sm text-slate-400">No activity recorded.</p>}
            {activityFor.logs.map((l) => (
              <div key={l.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-surface-800">
                <p className="font-mono text-xs text-slate-500">{l.action}</p>
                <p className="text-xs text-slate-400">{formatDate(l.created_at, { hour: '2-digit', minute: '2-digit' })} · {l.ip_address || ''}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={onDelete}
        title="Delete user?" message={`Delete ${confirmDelete?.email}? The account will be soft-deleted.`} />
    </div>
  );
}