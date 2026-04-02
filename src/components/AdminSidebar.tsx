'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Users,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/contacts', label: 'Messages', icon: MessageSquare },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <aside
      className="h-screen sticky top-0 border-r flex flex-col transition-all duration-200"
      style={{
        width: collapsed ? '72px' : '256px',
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              EB
            </div>
            <span
              className="font-bold text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              Admin
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1" aria-label="Admin navigation">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: active ? 'var(--accent-light)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 w-full"
          style={{ color: 'var(--danger)' }}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
