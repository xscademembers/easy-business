'use client';

import { useEffect, useState } from 'react';
import { Users, Loader2, ShoppingBag } from 'lucide-react';

export default function CustomersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
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

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Customers & Orders
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          View customer checkout details and order history
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center py-12">
          <Users
            size={48}
            className="mx-auto mb-3"
            style={{ color: 'var(--text-muted)' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>
            No orders yet. Customer data will appear here after purchases.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <article key={order._id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--accent-light)' }}
                  >
                    <Users size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p
                      className="font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {order.customer?.name || 'Unknown'}
                    </p>
                    <p
                      className="text-sm break-all"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {order.customer?.email} | {order.customer?.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full"
                    style={{
                      backgroundColor:
                        order.paymentStatus === 'completed'
                          ? 'color-mix(in srgb, var(--success) 12%, transparent)'
                          : 'color-mix(in srgb, var(--warning) 12%, transparent)',
                      color:
                        order.paymentStatus === 'completed'
                          ? 'var(--success)'
                          : 'var(--warning)',
                    }}
                  >
                    {order.paymentStatus}
                  </span>
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full capitalize"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {order.paymentType}
                  </span>
                </div>
              </div>

              <div
                className="border-t pt-4 space-y-2"
                style={{ borderColor: 'var(--border)' }}
              >
                {order.items?.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag
                        size={14}
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <span style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        x{item.quantity}
                      </span>
                    </div>
                    <span
                      className="font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div
                  className="flex justify-between pt-2 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Total
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    ${order.totalAmount?.toFixed(2)}
                  </span>
                </div>
              </div>

              <p
                className="text-xs mt-3"
                style={{ color: 'var(--text-muted)' }}
              >
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
