import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, Moon, Sun, ChevronDown, Monitor } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { connectSocket } from '../../lib/socket';
import { formatDateTime, initials } from '../../lib/format';
import { disconnectSocket } from '../../lib/socket';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { unread, notifications, init, markRead, markAllRead } = useNotificationStore();
  const navigate = useNavigate();
  const [showBell, setShowBell] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (user) {
      init().catch(() => {});
      connectSocket();
    }
    return () => disconnectSocket();
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const dropdownCls =
    'absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border bg-white shadow-card-lg dark:bg-surface-800';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-white/80 px-4 backdrop-blur dark:bg-surface-900/80">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !px-2 !py-1 lg:hidden" onClick={onMenuClick} aria-label="Menu">
          <Menu size={20} />
        </button>
        <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> System online
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="btn-ghost !px-2 !py-2" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            className="btn-ghost relative !px-2 !py-2"
            onClick={() => setShowBell((v) => !v)}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
          {showBell && (
            <div className={dropdownCls}>
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notifications</p>
                <button className="text-xs text-brand-600 hover:underline" onClick={() => markAllRead()}>
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
                )}
                {notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    className={`block w-full px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-surface-800/60 ${!n.read_at ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''}`}
                    onClick={() => {
                      markRead(n.id);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.created_at)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-surface-800"
            onClick={() => setShowMenu((v) => !v)}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {initials(user?.firstName, user?.lastName)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-slate-700 dark:text-slate-200">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="block text-[11px] leading-tight capitalize text-slate-400">
                {user?.roleName}
              </span>
            </span>
            <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
          </button>
          {showMenu && (
            <div className={dropdownCls}>
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <Link to="/app/profile" onClick={() => setShowMenu(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-800">
                  My Profile
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}