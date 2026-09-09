import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarRange, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../stores/authStore';
import { DAYS, SESSION_KINDS } from '../../lib/constants';
import { formatDate, toTitleCase } from '../../lib/format';

const semSchema = z.object({
  name: z.string().min(2, 'Name required'),
  season: z.enum(['spring', 'summer', 'fall', 'winter']),
  year: z.coerce.number().int().min(2000).max(2100),
  startDate: z.string().min(1, 'Start date required'),
  endDate: z.string().min(1, 'End date required'),
  isActive: z.coerce.boolean(),
});

const slotSchema = z.object({
  semesterId: z.string().uuid('Semester required'),
  laboratoryId: z.string().uuid('Laboratory required'),
  lecturerId: z.string().uuid('Lecturer required'),
  courseCode: z.string().min(1, 'Course code required'),
  courseName: z.string().min(2, 'Course name required'),
  day: z.enum(DAYS),
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
  sessionKind: z.enum(SESSION_KINDS),
}).refine((d) => d.endTime > d.startTime, { path: ['endTime'], message: 'End time must be after start' });

export default function Timetable() {
  const user = useAuthStore((s) => s.user);
  const canManage = ['super_admin', 'lab_manager'].includes(user?.roleCode);
  const [semesters, setSemesters] = useState([]);
  const [labs, setLabs] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSem, setActiveSem] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingSem, setEditingSem] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState(null);
  const semForm = useModal();
  const slotForm = useModal();

  const semR = useForm({ resolver: zodResolver(semSchema) });
  const slotR = useForm({ resolver: zodResolver(slotSchema) });

  const loadSemesters = async (pickActive = true) => {
    try {
      const { data } = await api.get('/timetable/semesters');
      const list = data.data;
      setSemesters(list);
      const active = list.find((s) => s.is_active);
      const selected = activeSem || (pickActive ? active?.id : list[0]?.id) || '';
      if (!activeSem) setActiveSem(selected);
      return selected;
    } catch { return ''; }
  };

  const loadSchedule = async (semId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/timetable/weekly`, { params: semId ? { semesterId: semId } : {} });
      setSchedule(data.data);
    } catch (e) { toast.error(extractError(e)); }
    finally { setLoading(false); }
  };

  const refresh = async () => {
    const sem = await loadSemesters(false);
    setLoading(true);
    if (sem) loadSchedule(sem);
    else setLoading(false);
  };

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
    refresh();
  }, []);

  useEffect(() => {
    if (!lecturers.length) {
      api.get('/users?limit=200').then((r) => setLecturers(r.data.data.filter((u) => u.role_code === 'lecturer'))).catch(() => {});
    }
  }, []);

  const selectSem = (semId) => { setActiveSem(semId); loadSchedule(semId); };

  const onSemSubmit = async (values) => {
    setBusy(true);
    try {
      values.isActive = !!values.isActive;
      if (editingSem) {
        const { isActive, ...rest } = values;
        await api.post('/timetable/semesters', { ...rest, isActive });
        toast.success('Semester updated. (Active flag applied; recreate if needed.)');
        semForm.closeModal();
        await refresh();
      } else {
        await api.post('/timetable/semesters', values);
        toast.success('Semester created.');
        semForm.closeModal();
        semR.reset({ season: 'fall', year: new Date().getFullYear(), isActive: false });
        await refresh();
      }
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const onSlotSubmit = async (values) => {
    setBusy(true);
    try {
      if (editingSlot) await api.patch(`/timetable/slots/${editingSlot.id}`, values);
      else await api.post('/timetable/slots', values);
      toast.success(editingSlot ? 'Slot updated.' : 'Slot added.');
      slotForm.closeModal();
      loadSchedule(values.semesterId || activeSem);
    } catch (e) { toast.error(extractError(e)); }
    finally { setBusy(false); }
  };

  const onDeleteSlot = async () => {
    try { await api.delete(`/timetable/slots/${confirmDeleteSlot.id}`); toast.success('Slot removed.'); loadSchedule(confirmDeleteSlot.semester_id); setConfirmDeleteSlot(null); }
    catch (e) { toast.error(extractError(e)); }
  };

  const openCreateSem = () => {
    setEditingSem(null);
    semR.reset({ season: 'fall', year: new Date().getFullYear(), isActive: false });
    semForm.openModal();
  };

  const openCreateSlot = () => {
    setEditingSlot(null);
    slotR.reset({ semesterId: activeSem, day: 'Monday', sessionKind: 'lab' });
    slotForm.openModal();
  };

  const openEditSlot = (s) => {
    setEditingSlot(s);
    slotR.reset({
      semesterId: s.semester_id, laboratoryId: s.laboratory_id, lecturerId: s.lecturer_id,
      courseCode: s.course_code, courseName: s.course_name, day: s.day,
      startTime: s.start_time?.slice(0, 5), endTime: s.end_time?.slice(0, 5), sessionKind: s.session_kind,
    });
    slotForm.openModal();
  };

  const days = schedule?.days || DAYS.map((d) => ({ day: d, slots: [] }));

  return (
    <div>
      <PageHeader title="Weekly Timetable" subtitle="Semester schedule of recurring laboratory sessions" icon={<CalendarRange size={20} />}
        actions={canManage && <>
          <button className="btn" onClick={openCreateSem}><Plus size={16} /> Add semester</button>
          <button className="btn-primary" onClick={openCreateSlot}><Plus size={16} /> Add slot</button>
        </>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {semesters.map((s) => (
          <button key={s.id} onClick={() => selectSem(s.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${activeSem === s.id ? 'bg-brand-600 text-white' : 'bg-surface-900/5 text-slate-600 dark:bg-surface-800 dark:text-slate-300'}`}>
            {s.name} {s.is_active && <span className="ml-1 rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-500">ACTIVE</span>}
          </button>
        ))}
        {schedule?.semester && (
          <span key={schedule.semester.id} className="ml-auto text-sm text-slate-400">
            {formatDate(schedule.semester.start_date)} – {formatDate(schedule.semester.end_date)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={30} className="text-brand-600" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {days.map(({ day, slots }) => (
            <div key={day} className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{day}</h3>
                <span className="text-xs text-slate-400">{slots.length} session{slots.length === 1 ? '' : 's'}</span>
              </div>
              {slots.length === 0 && <p className="text-xs text-slate-400">No sessions</p>}
              <div className="space-y-2">
                {slots.map((s) => (
                  <div key={s.id} className="group rounded-lg border border-slate-200 p-2 dark:border-surface-700">
                    <div className="flex items-center justify-between">
                      <Badge color={SESSION_KINDS.indexOf(s.session_kind) >= 0 ? 'slate' : 'slate'}>{toTitleCase(s.session_kind)}</Badge>
                      <span className="font-mono text-[10px] text-slate-400">{s.course_code}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{s.course_name}</p>
                    <p className="text-xs text-slate-400">{s.laboratory_name} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</p>
                    <p className="text-xs text-slate-400">Lecturer: {s.lecturer_name || '—'}</p>
                    {canManage && (
                      <div className="mt-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <button className="btn-ghost !px-1 !py-0.5" onClick={() => openEditSlot(s)}><Pencil size={13} /></button>
                        <button className="btn-ghost !px-1 !py-0.5 text-rose-500" onClick={() => setConfirmDeleteSlot(s)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Semester form */}
      <Modal open={semForm.isOpen} onClose={semForm.closeModal} title={editingSem ? 'Edit semester' : 'New semester'} size="md"
        footer={<><button className="btn-secondary" onClick={semForm.closeModal}>Cancel</button><button className="btn-primary" form="sem-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Save'}</button></>}>
        <form id="sem-form" onSubmit={semR.handleSubmit(onSemSubmit)} className="space-y-4">
          <Field label="Semester name" required error={semR.formState.errors.name?.message}>
            <Input placeholder="2026/2027 — Session 1" name="name" register={semR.register} error={!!semR.formState.errors.name} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Season">
              <Select name="season" register={semR.register}>
                <option value="fall">Fall</option><option value="spring">Spring</option><option value="summer">Summer</option><option value="winter">Winter</option>
              </Select>
            </Field>
            <Field label="Year" required error={semR.formState.errors.year?.message}>
              <Input type="number" name="year" register={semR.register} error={!!semR.formState.errors.year} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required error={semR.formState.errors.startDate?.message}>
              <Input type="date" name="startDate" register={semR.register} error={!!semR.formState.errors.startDate} />
            </Field>
            <Field label="End date" required error={semR.formState.errors.endDate?.message}>
              <Input type="date" name="endDate" register={semR.register} error={!!semR.formState.errors.endDate} />
            </Field>
          </div>
          <Field label="Active semester">
            <select className="input" {...semR.register('isActive')}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
        </form>
      </Modal>

      {/* Slot form */}
      <Modal open={slotForm.isOpen} onClose={slotForm.closeModal} title={editingSlot ? 'Edit slot' : 'Add timetable slot'} size="md"
        footer={<><button className="btn-secondary" onClick={slotForm.closeModal}>Cancel</button><button className="btn-primary" form="slot-form" disabled={busy}>{busy ? <Spinner size={14} /> : 'Save slot'}</button></>}>
        <form id="slot-form" onSubmit={slotR.handleSubmit(onSlotSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Semester" required error={slotR.formState.errors.semesterId?.message}>
              <Select name="semesterId" register={slotR.register}>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Laboratory" required error={slotR.formState.errors.laboratoryId?.message}>
              <Select name="laboratoryId" register={slotR.register}>
                <option value="">Select…</option>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lecturer" required error={slotR.formState.errors.lecturerId?.message}>
              <Select name="lecturerId" register={slotR.register}>
                <option value="">Select…</option>
                {lecturers.map((l) => <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>)}
              </Select>
            </Field>
            <Field label="Day" required>
              <Select name="day" register={slotR.register}>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course code" required error={slotR.formState.errors.courseCode?.message}>
              <Input placeholder="CS201" name="courseCode" register={slotR.register} error={!!slotR.formState.errors.courseCode} />
            </Field>
            <Field label="Course name" required error={slotR.formState.errors.courseName?.message}>
              <Input placeholder="Intro to Programming" name="courseName" register={slotR.register} error={!!slotR.formState.errors.courseName} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Start" required error={slotR.formState.errors.startTime?.message}>
              <Input type="time" name="startTime" register={slotR.register} error={!!slotR.formState.errors.startTime} />
            </Field>
            <Field label="End" required error={slotR.formState.errors.endTime?.message}>
              <Input type="time" name="endTime" register={slotR.register} error={!!slotR.formState.errors.endTime} />
            </Field>
            <Field label="Type">
              <Select name="sessionKind" register={slotR.register}>
                {SESSION_KINDS.map((k) => <option key={k} value={k}>{toTitleCase(k)}</option>)}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDeleteSlot} onClose={() => setConfirmDeleteSlot(null)} onConfirm={onDeleteSlot}
        title="Remove timetable slot?" message={`Remove "${confirmDeleteSlot?.course_name}"?`} />
    </div>
  );
}