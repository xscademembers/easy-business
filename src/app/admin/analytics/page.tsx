'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Loader2,
} from 'lucide-react';

interface AnalyticsData {
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  daily: { orders: number; revenue: number; itemsSold: number };
  weekly: { orders: number; revenue: number; itemsSold: number };
  monthly: { orders: number; revenue: number; itemsSold: number };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2
          size={32}
          className="animate-spin"
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

      <div className="grid sm:grid-cols-3 gap-4">
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
