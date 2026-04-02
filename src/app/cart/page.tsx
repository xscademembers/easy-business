'use client';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart();

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
        <h1
          className="text-2xl md:text-3xl font-bold mb-8"
          style={{ color: 'var(--text-primary)' }}
        >
          Shopping Cart
          {itemCount > 0 && (
            <span
              className="text-lg font-normal ml-2"
              style={{ color: 'var(--text-muted)' }}
            >
              ({itemCount} item{itemCount !== 1 ? 's' : ''})
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag
              size={64}
              className="mx-auto mb-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <h2
              className="text-xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Your cart is empty
            </h2>
            <p
              className="mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              Start shopping to add items to your cart.
            </p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <article
                  key={item.productId}
                  className="card flex gap-4"
                >
                  <div
                    className="w-20 h-20 rounded-xl overflow-hidden shrink-0"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag
                          size={24}
                          style={{ color: 'var(--text-muted)' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.name}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ID: {item.productId}
                      {item.variant &&
                        ` | ${Object.values(item.variant).filter(Boolean).join(', ')}`}
                    </p>
                    <p
                      className="font-bold mt-1"
                      style={{ color: 'var(--accent)' }}
                    >
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--danger)' }}
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div
                      className="flex items-center rounded-lg border"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="p-1.5"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Minus size={14} />
                      </button>
                      <span
                        className="w-8 text-center text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="p-1.5"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside>
              <div className="card sticky top-24">
                <h2
                  className="text-lg font-bold mb-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Order Summary
                </h2>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Subtotal ({itemCount} items)
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      ${total.toFixed(2)}
                    </span>
                  </div>
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
                        className="font-bold text-lg"
                        style={{ color: 'var(--accent)' }}
                      >
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/checkout"
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  Proceed to Checkout
                  <ArrowRight size={16} />
                </Link>
              </div>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
