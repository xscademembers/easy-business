'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, ShoppingBag, Search, SlidersHorizontal } from 'lucide-react';

type OrderRow = {
  _id: string;
  createdAt: string;
  totalAmount?: number;
  customerMessage?: string;
  items?: Array<{ name?: string; quantity?: number; price?: number }>;
  customer?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  paymentStatus?: string;
  paymentType?: string;
};

type CustomerAgg = {
  key: string;
  name: string;
  email: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

export default function CustomersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'name' | 'phone' | 'orders'>(
    'all'
  );

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerAgg>();
    for (const order of orders) {
      const c = order.customer;
      const key =
        (c && (c.phone || c.email || String(c._id))) ||
        `${order._id}-guest`;
      const name = c?.name || 'Unknown';
      const email = c?.email || '—';
      const phone = c?.phone || '—';
      const prev = map.get(key);
      const amount = order.totalAmount || 0;
      const created = order.createdAt;
      if (!prev) {
        map.set(key, {
          key,
          name,
          email,
          phone,
          orderCount: 1,
          totalSpent: amount,
          lastOrderAt: created,
        });
      } else {
        prev.orderCount += 1;
        prev.totalSpent += amount;
        if (new Date(created) > new Date(prev.lastOrderAt)) {
          prev.lastOrderAt = created;
        }
        map.set(key, prev);
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
    );
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (!q) return true;
      if (filter === 'name') return c.name.toLowerCase().includes(q);
      if (filter === 'phone') return c.phone.toLowerCase().includes(q);
      if (filter === 'orders') {
        const n = parseInt(q, 10);
        if (Number.isNaN(n)) return String(c.orderCount).includes(q);
        return c.orderCount >= n;
      }
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email !== '—' && c.email.toLowerCase().includes(q)) ||
        c.phone.toLowerCase().includes(q) ||
        String(c.orderCount).includes(q)
      );
    });
  }, [customers, search, filter]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (!q) return true;
      const c = order.customer;
      if (filter === 'name')
        return (c?.name || '').toLowerCase().includes(q);
      if (filter === 'phone')
        return (c?.phone || '').toLowerCase().includes(q);
      if (filter === 'orders') return true;
      return (
        (c?.name || '').toLowerCase().includes(q) ||
        (c?.email || '').toLowerCase().includes(q) ||
        (c?.phone || '').toLowerCase().includes(q)
      );
    });
  }, [orders, search, filter]);

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
          Search and filter checkout history
        </p>
      </div>

      <div className="card flex flex-col lg:flex-row gap-4 lg:items-end">
        <div className="flex-1 relative min-w-0">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, or min orders…"
            className="input-field pl-10 w-full"
            aria-label="Search customers and orders"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal
            size={18}
            className="shrink-0"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden
          />
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as typeof filter)
            }
            className="input-field min-w-[160px]"
            aria-label="Filter type"
          >
            <option value="all">All fields</option>
            <option value="name">Name only</option>
            <option value="phone">Phone only</option>
            <option value="orders">Orders (count)</option>
          </select>
        </div>
      </div>

      {customers.length > 0 && (
        <section aria-label="Customer summary">
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Customers ({filteredCustomers.length})
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCustomers.map((c) => (
              <article
                key={c.key}
                className="card p-4 space-y-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--accent-light)' }}
                  >
                    <Users size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {c.name}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {c.email} · {c.phone}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Orders</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {c.orderCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Total spent</span>
                  <span className="font-medium" style={{ color: 'var(--accent)' }}>
                    ${c.totalSpent.toFixed(2)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
        <section aria-label="Orders" className="space-y-4">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Orders ({filteredOrders.length})
          </h2>
          {filteredOrders.map((order) => (
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
                      {order.customer?.phone || '—'}
                      {order.customer?.email
                        ? ` · ${order.customer.email}`
                        : ''}
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

              {order.customerMessage ? (
                <p
                  className="text-sm mb-4 px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    Customer note:{' '}
                  </span>
                  {order.customerMessage}
                </p>
              ) : null}
              <div
                className="border-t pt-4 space-y-2"
                style={{ borderColor: 'var(--border)' }}
              >
                {order.items?.map((item, i) => (
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
                      ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}
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
        </section>
      )}
    </div>
  );
}
