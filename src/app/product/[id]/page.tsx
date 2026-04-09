'use client';

import { useEffect, useState } from 'react';
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

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image_url || '',
    });
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
          <div
            className="aspect-square rounded-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
            }}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={80} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {product.name}
              </h1>
              <p
                className="text-sm mt-2 font-mono truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {product.productCode
                  ? `Product code: ${product.productCode}`
                  : `ID: ${product._id}`}
              </p>
              {product.description ? (
                <p
                  className="mt-4 text-base leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {product.description}
                </p>
              ) : null}
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                In stock:{' '}
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {product.quantity ?? 0}
                </span>
                {product.category ? (
                  <>
                    {' '}
                    · <span className="capitalize">{product.category}</span>
                  </>
                ) : null}
              </p>
              {product.sizes && product.sizes.length > 0 && (
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Sizes: {product.sizes.join(', ')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className="text-3xl font-bold"
                style={{ color: 'var(--accent)' }}
              >
                ${product.price.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div
                className="flex items-center justify-center rounded-xl border shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  type="button"
                >
                  <Minus size={16} />
                </button>
                <span
                  className="w-12 text-center font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  type="button"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                type="button"
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {added ? (
                  <>
                    <CheckCircle size={18} />
                    Added!
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    Add to Cart
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
