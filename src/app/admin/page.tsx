'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  Loader2,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

interface Analytics {
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  avgItemsPerOrder: number;
  avgOrderValue: number;
  daily: { orders: number; revenue: number; itemsSold: number };
  weekly: { orders: number; revenue: number; itemsSold: number };
  monthly: { orders: number; revenue: number; itemsSold: number };
}

function MiniBars({
  label,
  values,
  max,
}: {
  label: string;
  values: { key: string; value: number; colorVar: string }[];
  max: number;
}) {
  const safeMax = max > 0 ? max : 1;
  return (
    <figure
      className="mt-4"
      aria-label={label}
      style={{ color: 'var(--text-secondary)' }}
    >
      <figcaption className="text-xs font-medium mb-3">{label}</figcaption>
      <div className="flex items-end gap-3 h-32">
        {values.map((v) => (
          <div
            key={v.key}
            className="flex-1 flex flex-col items-center gap-2 min-w-0"
          >
            <div
              className="w-full rounded-t-lg motion-safe:transition-[height] motion-reduce:transition-none duration-300"
              style={{
                height: `${Math.max(8, (v.value / safeMax) * 100)}%`,
                minHeight: '8px',
                backgroundColor: `var(${v.colorVar})`,
              }}
              role="presentation"
            />
            <span className="text-[10px] uppercase tracking-wide truncate w-full text-center">
              {v.key}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const periodBars = useMemo(() => {
    if (!data) {
      return {
        revenueMax: 1,
        orderMax: 1,
        aov: [] as { key: string; value: number; colorVar: string }[],
        aovMax: 1,
      };
    }
    const revs = [
      data.daily.revenue,
      data.weekly.revenue,
      data.monthly.revenue,
    ];
    const ords = [
      data.daily.orders,
      data.weekly.orders,
      data.monthly.orders,
    ];
    const revenueMax = Math.max(...revs, 1);
    const orderMax = Math.max(...ords, 1);
    const aov = [
      {
        key: 'Daily AOV',
        value:
          data.daily.orders > 0
            ? data.daily.revenue / data.daily.orders
            : 0,
        colorVar: '--accent',
      },
      {
        key: 'Weekly AOV',
        value:
          data.weekly.orders > 0
            ? data.weekly.revenue / data.weekly.orders
            : 0,
        colorVar: '--success',
      },
      {
        key: 'Monthly AOV',
        value:
          data.monthly.orders > 0
            ? data.monthly.revenue / data.monthly.orders
            : 0,
        colorVar: '--warning',
      },
    ];
    const aovMax = Math.max(...aov.map((x) => x.value), 1);
    return { revenueMax, orderMax, aov, aovMax };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2
          size={40}
          className="animate-spin motion-reduce:animate-none"
          style={{ color: 'var(--accent)' }}
        />
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
      href: '/admin#sales-insights',
    },
    {
      label: 'Total Revenue',
      value: `$${(data?.totalRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'var(--success)',
      bg: 'color-mix(in srgb, var(--success) 12%, transparent)',
      href: '/admin#sales-insights',
    },
  ];

  const periods = [
    { label: 'Today', data: data?.daily },
    { label: 'This Week', data: data?.weekly },
    { label: 'This Month', data: data?.monthly },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Business overview and sales performance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card hover:shadow-lg transition-shadow motion-reduce:transition-none"
          >
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
        {periods.map(({ label, data: period }) => (
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

      <section
        id="sales-insights"
        className="space-y-6 scroll-mt-24"
        aria-label="Sales insights"
      >
        <h2
          className="text-lg font-semibold flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
          Sales insights
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <span
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Avg items / order
              </span>
            </div>
            <p
              className="text-3xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {(data?.avgItemsPerOrder || 0).toFixed(2)}
            </p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <DollarSign size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <span
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Avg order value
              </span>
            </div>
            <p
              className="text-3xl font-bold"
              style={{ color: 'var(--accent)' }}
            >
              ${(data?.avgOrderValue || 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="card">
          <h3
            className="font-semibold mb-2 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
            Period comparison
          </h3>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            Bar height is relative within each chart (not across charts).
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <MiniBars
              label="Revenue by period ($)"
              max={periodBars.revenueMax}
              values={[
                {
                  key: 'Day',
                  value: data?.daily.revenue || 0,
                  colorVar: '--accent',
                },
                {
                  key: 'Week',
                  value: data?.weekly.revenue || 0,
                  colorVar: '--success',
                },
                {
                  key: 'Month',
                  value: data?.monthly.revenue || 0,
                  colorVar: '--warning',
                },
              ]}
            />
            <MiniBars
              label="Orders by period (count)"
              max={periodBars.orderMax}
              values={[
                {
                  key: 'Day',
                  value: data?.daily.orders || 0,
                  colorVar: '--accent',
                },
                {
                  key: 'Week',
                  value: data?.weekly.orders || 0,
                  colorVar: '--success',
                },
                {
                  key: 'Month',
                  value: data?.monthly.orders || 0,
                  colorVar: '--warning',
                },
              ]}
            />
            <MiniBars
              label="Average order value by period ($)"
              max={periodBars.aovMax}
              values={periodBars.aov}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
