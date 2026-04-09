'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import {
  Package,
  ShoppingCart,
  Minus,
  Plus,
  ArrowLeft,
  Loader2,
  CheckCircle,
  X,
  ZoomIn,
} from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<{
    _id: string;
    name: string;
    price: number;
    image_url?: string;
    description?: string;
    quantity?: number;
    productCode?: string;
    category?: string;
    sizes?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push('/not-found');
          return;
        }
        setProduct(data);
      })
      .catch(() => router.push('/not-found'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const closeExpanded = useCallback(() => setImageExpanded(false), []);

  useEffect(() => {
    if (!imageExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpanded();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [imageExpanded, closeExpanded]);

  const stock =
    product != null
      ? Math.max(0, Math.floor(Number(product.quantity) || 0))
      : 0;
  const inStock = stock > 0;

  useEffect(() => {
    if (!product) return;
    setQuantity((q) => {
      if (stock <= 0) return 0;
      return Math.min(Math.max(1, q), stock);
    });
  }, [product, stock]);

  const handleAddToCart = () => {
    if (!product || !inStock) return;
    setCartMessage('');
    const result = addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image_url || '',
      maxStock: stock,
    });
    if (!result.ok) {
      setCartMessage(result.message);
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2
            size={40}
            className="animate-spin motion-reduce:animate-none"
            style={{ color: 'var(--accent)' }}
          />
        </main>
        <Footer />
      </>
    );
  }

  if (!product) return null;

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8 text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => product.image_url && setImageExpanded(true)}
              className="aspect-square w-full rounded-2xl overflow-hidden text-left relative group transition-opacity motion-safe:duration-200 disabled:cursor-default"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
              }}
              disabled={!product.image_url}
              aria-label="View larger product image"
            >
              {product.image_url ? (
                <>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transition-none group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
                  />
                  <span
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-lg opacity-95 motion-safe:transition-opacity motion-reduce:transition-none group-hover:opacity-100"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <ZoomIn size={14} aria-hidden />
                    Enlarge
                  </span>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={80} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {product.name}
              </h1>

              <div
                className="mt-4 rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
              >
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th
                        scope="row"
                        className="text-left py-3 px-4 font-medium w-[40%]"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Product code
                      </th>
                      <td
                        className="py-3 px-4 tabular-nums font-semibold tracking-wide text-base"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {product.productCode || '—'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th
                        scope="row"
                        className="text-left py-3 px-4 font-medium"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Price
                      </th>
                      <td
                        className="py-3 px-4 tabular-nums font-semibold text-base"
                        style={{ color: 'var(--accent)' }}
                      >
                        ${product.price.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th
                        scope="row"
                        className="text-left py-3 px-4 font-medium"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Availability
                      </th>
                      <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                        {inStock ? (
                          <span className="tabular-nums font-medium">
                            {stock} in stock
                          </span>
                        ) : (
                          <span
                            className="font-semibold"
                            style={{ color: 'var(--danger)' }}
                          >
                            Out of stock
                          </span>
                        )}
                      </td>
                    </tr>
                    {product.category ? (
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th
                          scope="row"
                          className="text-left py-3 px-4 font-medium capitalize"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Category
                        </th>
                        <td
                          className="py-3 px-4 capitalize"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {product.category}
                        </td>
                      </tr>
                    ) : null}
                    {product.sizes && product.sizes.length > 0 ? (
                      <tr>
                        <th
                          scope="row"
                          className="text-left py-3 px-4 font-medium align-top"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Sizes
                        </th>
                        <td
                          className="py-3 px-4"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {product.sizes.join(', ')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {product.description ? (
                <p
                  className="mt-4 text-base leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {product.description}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className="text-3xl font-bold tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                ${product.price.toFixed(2)}
              </span>
            </div>

            {cartMessage && (
              <p
                className="text-sm px-4 py-3 rounded-xl"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--danger) 12%, transparent)',
                  color: 'var(--danger)',
                }}
                role="alert"
              >
                {cartMessage}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div
                className="flex items-center justify-center rounded-xl border shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() =>
                    setQuantity((q) => Math.max(inStock ? 1 : 0, q - 1))
                  }
                  className="p-3 transition-colors disabled:opacity-40"
                  style={{ color: 'var(--text-primary)' }}
                  type="button"
                  disabled={!inStock || quantity <= (inStock ? 1 : 0)}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span
                  className="w-12 text-center font-semibold tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(stock, q + 1))
                  }
                  className="p-3 transition-colors disabled:opacity-40"
                  style={{ color: 'var(--text-primary)' }}
                  type="button"
                  disabled={!inStock || quantity >= stock}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                type="button"
                disabled={!inStock}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {added ? (
                  <>
                    <CheckCircle size={18} />
                    Added!
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    {inStock ? 'Add to Cart' : 'Out of stock'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {imageExpanded && product.image_url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.88)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Product image enlarged"
          onClick={closeExpanded}
        >
          <div
            className="relative w-full max-w-[min(96vw,960px)] max-h-[92vh] flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-1">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--bg-primary)' }}
              >
                {product.name}
                {product.productCode ? (
                  <>
                    {' '}
                    ·{' '}
                    <span className="tabular-nums">{product.productCode}</span>
                  </>
                ) : null}
              </p>
              <button
                type="button"
                onClick={closeExpanded}
                className="shrink-0 p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  color: 'var(--bg-primary)',
                }}
                aria-label="Close enlarged image"
              >
                <X size={22} />
              </button>
            </div>
            <img
              src={product.image_url}
              alt=""
              className="w-full max-h-[min(80vh,720px)] object-contain rounded-xl mx-auto motion-safe:transition-transform motion-reduce:transition-none duration-200"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
