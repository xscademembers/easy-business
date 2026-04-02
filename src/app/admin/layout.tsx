'use client';

import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/AdminSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header
          className="h-16 border-b flex items-center justify-between px-6 sticky top-0 z-40 backdrop-blur-xl"
          style={{
            backgroundColor: 'var(--nav-bg)',
            borderColor: 'var(--border)',
          }}
        >
          <h2
            className="font-semibold capitalize"
            style={{ color: 'var(--text-primary)' }}
          >
            {pathname === '/admin'
              ? 'Dashboard'
              : pathname.split('/').pop()?.replace(/-/g, ' ') || 'Admin'}
          </h2>
          <ThemeToggle />
        </header>
        <main
          className="flex-1 p-6"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
