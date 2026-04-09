'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ShoppingCart, ExternalLink, Package, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export type SearchResultProduct = {
  _id: string;
  name: string;
  price: number;
  image_url?: string;
  score?: number;
  productCode?: string;
  quantity?: number;
};

interface ImageSearchResultsProps {
  products: SearchResultProduct[];
}

export function ImageSearchResults({ products }: ImageSearchResultsProps) {
  const { addItem } = useCart();
  const [feedback, setFeedback] = useState<{
    productId: string;
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const successClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successClearRef.current) clearTimeout(successClearRef.current);
    };
  }, []);

  const renderCard = (p: SearchResultProduct) => {
    const stock = Math.max(0, Math.floor(Number(p.quantity) || 0));
    const inStock = stock > 0;
    const id = String(p._id);
    const fb = feedback?.productId === id ? feedback : null;

    return (
      <article
        key={id}
        className="card flex flex-col sm:flex-row gap-4 p-4"
      >
        <div
          className="shrink-0 w-full sm:w-32 h-40 sm:h-32 rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          {p.image_url ? (
            <img
              src={p.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={40} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <h3
              className="font-semibold text-lg"
              style={{ color: 'var(--text-primary)' }}
            >
              {p.name}
            </h3>
            <p
              className="text-sm mt-2 font-medium"
              style={{ color: inStock ? 'var(--success)' : 'var(--danger)' }}
              role="status"
            >
              {inStock ? <>In stock</> : <>Out of stock</>}
            </p>
          </div>
          <p
            className="text-xl font-bold"
            style={{ color: 'var(--accent)' }}
          >
            ${Number(p.price).toFixed(2)}
          </p>
          {fb && (
            <div
              className="text-sm rounded-lg px-3 py-3 space-y-2"
              style={{
                backgroundColor:
                  fb.kind === 'success'
                    ? 'color-mix(in srgb, var(--success) 14%, transparent)'
                    : 'color-mix(in srgb, var(--danger) 12%, transparent)',
                color:
                  fb.kind === 'success'
                    ? 'var(--success)'
                    : 'var(--danger)',
                border:
                  fb.kind === 'success'
                    ? '1px solid color-mix(in srgb, var(--success) 35%, transparent)'
                    : '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
              }}
              role={fb.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <p className="font-medium flex items-center gap-2">
                {fb.kind === 'success' ? (
                  <Check size={18} className="shrink-0" aria-hidden />
                ) : null}
                {fb.message}
              </p>
              {fb.kind === 'success' && (
                <Link
                  href="/cart"
                  className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2"
                >
                  View cart
                </Link>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-auto">
            <button
              type="button"
              className="btn-primary text-sm !py-2 !px-4 inline-flex items-center gap-2 disabled:opacity-50"
              disabled={!inStock}
              onClick={() => {
                if (successClearRef.current) {
                  clearTimeout(successClearRef.current);
                  successClearRef.current = null;
                }
                const result = addItem({
                  productId: id,
                  name: p.name,
                  price: p.price,
                  quantity: 1,
                  image: p.image_url || '',
                  maxStock: stock,
                });
                if (!result.ok) {
                  setFeedback({
                    productId: id,
                    kind: 'error',
                    message: result.message,
                  });
                  return;
                }
                setFeedback({
                  productId: id,
                  kind: 'success',
                  message: 'Added to your cart. Your cart count updates in the header.',
                });
                successClearRef.current = setTimeout(() => {
                  setFeedback((cur) =>
                    cur?.productId === id && cur.kind === 'success'
                      ? null
                      : cur
                  );
                  successClearRef.current = null;
                }, 6000);
              }}
            >
              <ShoppingCart size={16} />
              {inStock ? 'Add to Cart' : 'Out of stock'}
            </button>
            <Link
              href={`/product/${p._id}`}
              className="btn-secondary text-sm !py-2 !px-4 inline-flex items-center gap-2"
            >
              <ExternalLink size={16} />
              View Details
            </Link>
          </div>
        </div>
      </article>
    );
  };

  if (products.length === 0) {
    return null;
  }

  return (
    <section
      className="mt-8 space-y-6 w-full max-w-2xl mx-auto"
      aria-label="Search results"
    >
      <div className="space-y-4">
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {products.length === 1 ? 'Match' : 'Matches'}
        </h2>
        {products.map((p) => renderCard(p))}
      </div>
    </section>
  );
}
