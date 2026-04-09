'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Loader2,
  BarChart3,
} from 'lucide-react';

interface AnalyticsData {
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
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
          size={32}
          className="animate-spin motion-reduce:animate-none"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    );
  }

  const periods = [
    { label: 'Daily Sales', key: 'daily' as const, icon: TrendingUp },
    { label: 'Weekly Sales', key: 'weekly' as const, icon: ShoppingCart },
    { label: 'Monthly Sales', key: 'monthly' as const, icon: DollarSign },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Track your sales performance and revenue
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-light)' }}
            >
              <Package size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <span
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Total Products
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {data?.totalProducts || 0}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--success) 12%, transparent)',
              }}
            >
              <ShoppingCart
                size={20}
                style={{ color: 'var(--success)' }}
              />
            </div>
            <span
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Total Orders
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {data?.totalOrders || 0}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--warning) 12%, transparent)',
              }}
            >
              <DollarSign
                size={20}
                style={{ color: 'var(--warning)' }}
              />
            </div>
            <span
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Total Revenue
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--success)' }}
          >
            ${(data?.totalRevenue || 0).toFixed(2)}
          </p>
        </div>
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
        <h2
          className="font-semibold mb-2 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
          Period comparison (charts)
        </h2>
        <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
          Bar height is relative within each chart (not across charts).
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <MiniBars
            label="Revenue by period ($)"
            max={periodBars.revenueMax}
            values={[
              { key: 'Day', value: data?.daily.revenue || 0, colorVar: '--accent' },
              { key: 'Week', value: data?.weekly.revenue || 0, colorVar: '--success' },
              { key: 'Month', value: data?.monthly.revenue || 0, colorVar: '--warning' },
            ]}
          />
          <MiniBars
            label="Orders by period (count)"
            max={periodBars.orderMax}
            values={[
              { key: 'Day', value: data?.daily.orders || 0, colorVar: '--accent' },
              { key: 'Week', value: data?.weekly.orders || 0, colorVar: '--success' },
              { key: 'Month', value: data?.monthly.orders || 0, colorVar: '--warning' },
            ]}
          />
          <MiniBars
            label="Average order value by period ($)"
            max={periodBars.aovMax}
            values={periodBars.aov}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {periods.map(({ label, key, icon: Icon }) => {
          const period = data?.[key];
          return (
            <div key={key} className="card">
              <div className="flex items-center gap-2 mb-6">
                <Icon size={20} style={{ color: 'var(--accent)' }} />
                <h3
                  className="font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {label}
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Revenue
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: 'var(--success)' }}
                  >
                    ${(period?.revenue || 0).toFixed(2)}
                  </p>
                </div>
                <div
                  className="border-t pt-4 grid grid-cols-2 gap-4"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div>
                    <p
                      className="text-xs uppercase tracking-wider mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Orders
                    </p>
                    <p
                      className="text-xl font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {period?.orders || 0}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-xs uppercase tracking-wider mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Items Sold
                    </p>
                    <p
                      className="text-xl font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {period?.itemsSold || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
