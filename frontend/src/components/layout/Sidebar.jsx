import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, BookOpen, CalendarDays, ClipboardCheck, Wrench,
  ShieldAlert, DoorOpen, Users, Building2, BarChart3, Settings, UserPlus, UsersRound, ClipboardList,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const ALL_LINKS = [
  { to: '/app', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['super_admin', 'lab_manager', 'technician', 'lecturer', 'student'], end: true },
  { to: '/app/laboratories', label: 'Laboratories', icon: <DoorOpen size={18} />, roles: ['super_admin', 'lab_manager', 'lecturer', 'student'] },
  { to: '/app/computers', label: 'Computers', icon: <Monitor size={18} />, roles: ['super_admin', 'lab_manager', 'technician'] },
  { to: '/app/equipment', label: 'Equipment', icon: <ClipboardList size={18} />, roles: ['super_admin', 'lab_manager', 'technician'] },
  { to: '/app/bookings', label: 'Bookings', icon: <CalendarDays size={18} />, roles: ['super_admin', 'lab_manager', 'lecturer', 'student'] },
  { to: '/app/timetable', label: 'Timetable', icon: <BookOpen size={18} />, roles: ['super_admin', 'lab_manager', 'lecturer', 'student'] },
  { to: '/app/attendance', label: 'Attendance', icon: <ClipboardCheck size={18} />, roles: ['super_admin', 'lab_manager', 'lecturer', 'student'] },
  { to: '/app/maintenance', label: 'Maintenance', icon: <Wrench size={18} />, roles: ['super_admin', 'lab_manager', 'technician', 'lecturer', 'student'] },
  { to: '/app/incidents', label: 'Incidents', icon: <ShieldAlert size={18} />, roles: ['super_admin', 'lab_manager', 'technician', 'lecturer', 'student'] },
  { to: '/app/visitors', label: 'Visitors', icon: <UsersRound size={18} />, roles: ['super_admin', 'lab_manager', 'technician'] },
  { to: '/app/users', label: 'Users', icon: <Users size={18} />, roles: ['super_admin', 'lab_manager'] },
  { to: '/app/departments', label: 'Departments', icon: <Building2 size={18} />, roles: ['super_admin', 'lab_manager'] },
  { to: '/app/reports', label: 'Reports', icon: <BarChart3 size={18} />, roles: ['super_admin', 'lab_manager', 'technician', 'lecturer'] },
  { to: '/app/settings', label: 'Settings', icon: <Settings size={18} />, roles: ['super_admin'] },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const user = useAuthStore((s) => s.user);

  const links = ALL_LINKS.filter((l) => !l.roles || l.roles.includes(user?.roleCode));

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-white transition-transform dark:bg-surface-900 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <Monitor size={18} />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">CLRMS</p>
            <p className="text-[11px] leading-tight text-slate-400">Laboratory Management</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-800'
                }`
              }
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-4 text-[11px] leading-relaxed text-slate-400">
          CLRMS v1.0 · Enterprise Laboratory Management
        </div>
      </aside>
    </>
  );
}