'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Order failed');
      }

      setSuccess(true);
      clearCart();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="card max-w-md w-full text-center py-12">
            <CheckCircle
              size={64}
              className="mx-auto mb-6"
              style={{ color: 'var(--success)' }}
            />
            <h1
              className="text-2xl font-bold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Thank you!
            </h1>
            <p
              className="mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Your order was received. We appreciate your purchase.
            </p>
            <p
              className="mb-8 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              You will be contacted using the details you provided if we need
              anything else.
            </p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              Continue Shopping
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <h1
              className="text-xl font-bold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Your cart is empty
            </h1>
            <Link href="/" className="btn-primary inline-block">
              Go Shopping
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 mb-8 text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          Back to Cart
        </Link>

        <h1
          className="text-2xl md:text-3xl font-bold mb-8"
          style={{ color: 'var(--text-primary)' }}
        >
          Checkout
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="card">
                <h2
                  className="text-lg font-bold mb-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Your Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className="input-field"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="input-field"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="input-field"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="card sticky top-24">
                <h2
                  className="text-lg font-bold mb-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Order Summary
                </h2>
                <div className="space-y-3 mb-6">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex justify-between text-sm"
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.name} x{item.quantity}
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div
                    className="border-t pt-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex justify-between">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        Total
                      </span>
                      <span
                        className="font-bold text-xl"
                        style={{ color: 'var(--accent)' }}
                      >
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {error && (
                  <p
                    className="text-sm mb-4 px-4 py-3 rounded-xl"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                      color: 'var(--danger)',
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                      Processing…
                    </>
                  ) : (
                    'Buy now'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}
