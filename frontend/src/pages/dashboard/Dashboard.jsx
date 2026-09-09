import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DoorOpen, Monitor, Cpu, Users, CalendarClock, Wrench, ClipboardCheck, Laptop, CalendarCheck, GraduationCap, Timer, Inbox, Hourglass, AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import StatCard from '../../components/ui/StatCard';
import { PageLoader } from '../../components/ui/Spinner';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge, { HealthBadge } from '../../components/StatusBadge';
import { formatTime, formatDate, toTitleCase } from '../../lib/format';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/dashboard')
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  if (error) return <EmptyState title="Could not load your dashboard" message={error} />;
  if (!data) return <PageLoader />;

  const role = user?.roleCode;
  const roleTitle = {
    super_admin: 'Institution Overview',
    lab_manager: 'Your Laboratories',
    technician: 'Repair Queue',
    lecturer: 'My Teaching',
    student: 'My Studies',
  };

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ''}`}
        subtitle={`${roleTitle[role] || 'Dashboard'} · ${toTitleCase(role)}`}
      />
      {renderRole(role, data)}
    </div>
  );
}

// ─────────────────────────── Super Admin ───────────────────────────
function SuperAdminDashboard({ cards, charts }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Laboratories" value={cards.total_labs} icon={<DoorOpen size={20} />} color="brand" />
        <StatCard label="Computers" value={cards.total_computers} icon={<Monitor size={20} />} color="blue" />
        <StatCard label="Equipment" value={cards.total_equipment} icon={<Cpu size={20} />} color="purple" />
        <StatCard label="Users" value={cards.total_users} icon={<Users size={20} />} color="green" />
        <StatCard label="Pending bookings" value={cards.pending_bookings} icon={<CalendarClock size={20} />} color="amber" />
        <StatCard label="Open maintenance" value={cards.open_maintenance} icon={<Wrench size={20} />} color="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Laboratory usage">
          <UsageBarChart data={charts.laboratoryUsage} />
        </ChartCard>
        <ChartCard title="Attendance trend (6 months)">
          <AttendanceAreaChart data={charts.attendanceTrend} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Equipment health">
          <EquipmentPie data={charts.equipmentHealth} />
        </ChartCard>
        <ChartCard title="Monthly maintenance costs">
          <CostBarChart data={charts.maintenanceCosts} />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart, PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#94a3b8'];

function UsageBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="sessions" name="Sessions" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CostBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AttendanceAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <defs>
          <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" fill="url(#gPresent)" />
        <Area type="monotone" dataKey="absent" name="Absent" stroke="#f43f5e" fill="url(#gAbsent)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EquipmentPie({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs">
          <span style={{ color: p.color }}>●</span> {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────── Laboratory Manager ───────────────────────
function LabManagerDashboard({ cards, todaySessions, availableComputers, activeIssues, labs }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned labs" value={cards.assigned_labs} icon={<DoorOpen size={20} />} color="brand" />
        <StatCard label="Available computers" value={cards.available_computers} icon={<Laptop size={20} />} color="green" />
        <StatCard label="Today's sessions" value={cards.today_sessions} icon={<CalendarCheck size={20} />} color="blue" />
        <StatCard label="Active issues" value={cards.active_issues} icon={<AlertTriangle size={20} />} color="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">Today's sessions</h3>
          {todaySessions.length === 0 && <p className="text-sm text-slate-400">No approved sessions today.</p>}
          {todaySessions.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b py-2 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.title}</p>
                <p className="text-xs text-slate-400">{s.lab} · {formatDate(s.date)}</p>
              </div>
              <span className="text-xs font-semibold text-brand-600">{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">Latest available computers</h3>
          {availableComputers.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{c.computer_number}</p>
                <p className="text-xs text-slate-400">{c.lab}</p>
              </div>
              <HealthBadge score={c.health_score} />
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">Active issues</h3>
          {activeIssues.map((i) => (
            <div key={i.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{i.title}</p>
                <p className="text-xs text-slate-400">{i.incident_no}</p>
              </div>
              <StatusBadge status={i.priority} />
            </div>
          ))}
          <Link className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline" to="/app/incidents">
            View all incidents →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Technician ───────────────────────────
function TechnicianDashboard({ cards, queued }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned repairs" value={cards.assigned_repairs} icon={<Wrench size={20} />} color="brand" />
        <StatCard label="Completed repairs" value={cards.completed_repairs} icon={<ClipboardCheck size={20} />} color="green" />
        <StatCard label="Pending repairs" value={cards.pending_repairs} icon={<Inbox size={20} />} color="amber" />
        <StatCard label="Avg. resolution" value={`${cards.avg_resolution_minutes || 0}m`} icon={<Hourglass size={20} />} color="blue" />
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold">Your queue</h3>
        {queued.length === 0 && <p className="text-sm text-slate-400">No open tickets assigned to you. Great job!</p>}
        {queued.map((t) => (
          <Link to={`/app/maintenance/${t.id}`} key={t.id} className="flex items-center justify-between border-b py-2.5 last:border-0 hover:bg-slate-50 dark:hover:bg-surface-800/40">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.title}</p>
              <p className="text-xs text-slate-400">{t.ticket_no} · {formatDate(t.created_at)}</p>
            </div>
            <StatusBadge status={t.priority} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── Lecturer ───────────────────────────
function LecturerDashboard({ cards, upcoming }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Approved bookings" value={cards.approved_bookings} icon={<CalendarCheck size={20} />} color="green" />
        <StatCard label="Pending bookings" value={cards.pending_bookings} icon={<CalendarClock size={20} />} color="amber" />
        <StatCard label="Sessions held" value={cards.sessions_held} icon={<GraduationCap size={20} />} color="brand" />
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold">Upcoming sessions</h3>
        {upcoming.length === 0 && <p className="text-sm text-slate-400">No upcoming sessions.</p>}
        {upcoming.map((b) => (
          <Link to={`/app/bookings/${b.id}`} key={b.id} className="flex items-center justify-between border-b py-2.5 last:border-0 hover:bg-slate-50 dark:hover:bg-surface-800/40">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{b.title}</p>
              <p className="text-xs text-slate-400">{b.lab} · {formatDate(b.date)} · {formatTime(b.start_time)}–{formatTime(b.end_time)}</p>
            </div>
            <StatusBadge status={b.status} />
          </Link>
        ))}
      </div>

      <div className="card">
        <h3 className="mb-2 text-sm font-semibold">Quick actions</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/app/bookings?new=1" className="btn-secondary">Request a booking</Link>
          <Link to="/app/attendance" className="btn-secondary">Take attendance</Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Student ───────────────────────────
function StudentDashboard({ cards, nextSessions, attendanceDistribution }) {
  const dist = {};
  (attendanceDistribution || []).forEach((d) => (dist[d.status] = d.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present" value={dist.present || 0} icon={<ClipboardCheck size={20} />} color="green" />
        <StatCard label="Late" value={dist.late || 0} icon={<Timer size={20} />} color="amber" />
        <StatCard label="Absent" value={dist.absent || 0} icon={<GraduationCap size={20} />} color="rose" />
        <StatCard label="Attendance rate" value={cards.total ? `${Math.round(((dist.present || 0) + (dist.late || 0)) / cards.total * 100)}%` : '—'} icon={<ClipboardCheck size={20} />} color="brand" />
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold">Weekly schedule</h3>
        {nextSessions.length === 0 && <p className="text-sm text-slate-400">No scheduled sessions in the active semester.</p>}
        {nextSessions.map((s, i) => (
          <div key={i} className="flex items-center justify-between border-b py-2.5 last:border-0">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.course_code} — {s.course_name}</p>
              <p className="text-xs text-slate-400">{s.day} · {formatTime(s.start_time)}–{formatTime(s.end_time)} · {s.lab}</p>
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">{s.course_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderRole(role, data) {
  switch (role) {
    case 'super_admin': return <SuperAdminDashboard {...data} />;
    case 'lab_manager': return <LabManagerDashboard {...data} />;
    case 'technician': return <TechnicianDashboard {...data} />;
    case 'lecturer': return <LecturerDashboard {...data} />;
    case 'student': return <StudentDashboard {...data} />;
    default: return <EmptyState title="Unknown role" />;
  }
}