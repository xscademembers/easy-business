'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/AdminSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Menu } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 sm:h-16 border-b flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40 backdrop-blur-xl gap-3"
          style={{
            backgroundColor: 'var(--nav-bg)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h2
              className="font-semibold capitalize truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {pathname === '/admin'
                ? 'Dashboard'
                : pathname.split('/').pop()?.replace(/-/g, ' ') || 'Admin'}
            </h2>
          </div>
          <ThemeToggle />
        </header>
        <main
          className="flex-1 p-3 sm:p-6"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
