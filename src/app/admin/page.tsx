'use client';

import { useEffect, useState } from 'react';
import { Package, Users, ShoppingCart, DollarSign, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Analytics {
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  daily: { orders: number; revenue: number; itemsSold: number };
  weekly: { orders: number; revenue: number; itemsSold: number };
  monthly: { orders: number; revenue: number; itemsSold: number };
}

export default function AdminDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Products',
      value: data?.totalProducts || 0,
      icon: Package,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
      href: '/admin/products',
    },
    {
      label: 'Total Customers',
      value: data?.totalCustomers || 0,
      icon: Users,
      color: 'var(--success)',
      bg: 'color-mix(in srgb, var(--success) 12%, transparent)',
      href: '/admin/customers',
    },
    {
      label: 'Total Orders',
      value: data?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'var(--warning)',
      bg: 'color-mix(in srgb, var(--warning) 12%, transparent)',
      href: '/admin/analytics',
    },
    {
      label: 'Total Revenue',
      value: `$${(data?.totalRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'var(--success)',
      bg: 'color-mix(in srgb, var(--success) 12%, transparent)',
      href: '/admin/analytics',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Here&apos;s an overview of your business
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
              <div>
                <p
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {stat.value}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Today', data: data?.daily },
          { label: 'This Week', data: data?.weekly },
          { label: 'This Month', data: data?.monthly },
        ].map(({ label, data: period }) => (
          <div key={label} className="card">
            <h3
              className="font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {label}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Orders</span>
                <span
                  className="font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {period?.orders || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Revenue</span>
                <span
                  className="font-semibold"
                  style={{ color: 'var(--success)' }}
                >
                  ${(period?.revenue || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Items Sold
                </span>
                <span
                  className="font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {period?.itemsSold || 0}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
