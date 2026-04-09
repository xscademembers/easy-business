'use client';

import Link from 'next/link';
import { ShoppingCart, ExternalLink, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export type SearchResultProduct = {
  _id: string;
  name: string;
  price: number;
  image_url?: string;
  score?: number;
  productCode?: string;
};

interface ImageSearchResultsProps {
  products: SearchResultProduct[];
  /** Shown when nothing met the similarity threshold */
  similarProducts?: SearchResultProduct[];
  threshold?: number;
}

export function ImageSearchResults({
  products,
  similarProducts,
  threshold,
}: ImageSearchResultsProps) {
  const { addItem } = useCart();

  const renderCard = (p: SearchResultProduct, opts?: { subtle?: boolean }) => (
    <article
      key={String(p._id)}
      className="card flex flex-col sm:flex-row gap-4 p-4"
      style={
        opts?.subtle
          ? { opacity: 0.95, borderColor: 'var(--border)' }
          : undefined
      }
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
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {p.productCode ? `Code: ${p.productCode}` : `ID: ${p._id}`}
            {typeof p.score === 'number' && threshold !== undefined && (
              <span className="ml-2">
                · score{' '}
                {p.score <= 1
                  ? `${(p.score * 100).toFixed(0)}%`
                  : p.score.toFixed(2)}
              </span>
            )}
          </p>
        </div>
        <p
          className="text-xl font-bold"
          style={{ color: 'var(--accent)' }}
        >
          ${Number(p.price).toFixed(2)}
        </p>
        <div className="flex flex-wrap gap-2 mt-auto">
          <button
            type="button"
            className="btn-primary text-sm !py-2 !px-4 inline-flex items-center gap-2"
            onClick={() =>
              addItem({
                productId: String(p._id),
                name: p.name,
                price: p.price,
                quantity: 1,
                image: p.image_url || '',
              })
            }
          >
            <ShoppingCart size={16} />
            Add to Cart
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

  if (products.length === 0 && (!similarProducts || similarProducts.length === 0)) {
    return null;
  }

  return (
    <section
      className="mt-8 space-y-6 w-full max-w-2xl mx-auto"
      aria-label="Search results"
    >
      {products.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-4 text-center"
          style={{
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent)',
          }}
        >
          <p className="font-medium">No matching product found</p>
          {threshold !== undefined && (
            <p className="text-sm mt-2 opacity-90">
              Similarity was below the confidence threshold.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {products.length === 1 ? 'Match' : 'Matches'}
          </h2>
          {products.map((p) => renderCard(p))}
        </div>
      )}

      {similarProducts && similarProducts.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Similar products
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            These are the closest catalog items but did not meet the match
            threshold.
          </p>
          {similarProducts.map((p) => renderCard(p, { subtle: true }))}
        </div>
      )}
    </section>
  );
}
