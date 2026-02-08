import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Дашборд', end: true },
  { to: '/admin/users', icon: Users, label: 'Пользователи', end: false },
];

export function Layout() {
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-[var(--gray-4)] bg-[var(--gray-2)]">
        <div className="p-4 border-b border-[var(--gray-4)]">
          <h2 className="text-lg font-bold text-[var(--brand-11)]">Wordy Admin</h2>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--brand-3)] text-[var(--brand-11)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--gray-3)] hover:text-[var(--foreground)]',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--gray-4)] p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{admin?.firstName ?? 'Admin'}</p>
              {admin?.username && (
                <p className="text-xs text-[var(--muted-foreground)] truncate">@{admin.username}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Выйти">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
