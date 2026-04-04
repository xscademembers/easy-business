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
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
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
    const variant = selectedVariant !== null ? product.variants[selectedVariant] : undefined;
    const price = variant?.price || product.price;
    addItem({
      productId: product.productId,
      name: product.name,
      price,
      quantity,
      image: product.image || '',
      variant: variant
        ? { size: variant.size, color: variant.color, material: variant.material }
        : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const categoryFieldLabels: Record<string, Record<string, string>> = {
    clothing: { fabric: 'Fabric', length: 'Length', width: 'Width', size: 'Size' },
    electronics: { voltage: 'Voltage', warranty: 'Warranty', powerConsumption: 'Power', brand: 'Brand' },
    food: { expiryDate: 'Expiry', ingredients: 'Ingredients', weight: 'Weight', vegNonVeg: 'Type' },
    utensils: { material: 'Material', capacity: 'Capacity', dimensions: 'Dimensions' },
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </main>
        <Footer />
      </>
    );
  }

  if (!product) return null;

  const currentPrice =
    selectedVariant !== null && product.variants[selectedVariant]?.price
      ? product.variants[selectedVariant].price
      : product.price;

  const fields = categoryFieldLabels[product.category] || {};

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
            {product.image ? (
              <img
                src={product.image}
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
              <span
                className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
                style={{
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                }}
              >
                {product.category}
              </span>
              <h1
                className="text-3xl md:text-4xl font-bold mt-4"
                style={{ color: 'var(--text-primary)' }}
              >
                {product.name}
              </h1>
              <p
                className="text-sm mt-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Product ID: {product.productId}
              </p>
            </div>

            <p
              className="text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {product.description || 'No description available.'}
            </p>

            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className="text-3xl font-bold"
                style={{ color: 'var(--accent)' }}
              >
                ${currentPrice.toFixed(2)}
              </span>
              <span
                className="text-sm font-medium px-3 py-1 rounded-full"
                style={{
                  backgroundColor:
                    product.stock > 0 ? 'var(--success)' : 'var(--danger)',
                  color: '#fff',
                }}
              >
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            </div>

            {product.variants?.length > 0 && (
              <div>
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Variants
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedVariant(selectedVariant === i ? null : i)}
                      className="px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200"
                      style={{
                        borderColor:
                          selectedVariant === i ? 'var(--accent)' : 'var(--border)',
                        backgroundColor:
                          selectedVariant === i ? 'var(--accent-light)' : 'transparent',
                        color:
                          selectedVariant === i ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {[v.size, v.color, v.material].filter(Boolean).join(' / ')}
                      {v.price && ` - $${v.price}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(product.categoryFields || {}).length > 0 && (
              <div
                className="rounded-xl p-4 space-y-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Specifications
                </h3>
                {Object.entries(product.categoryFields).map(([key, value]) => {
                  if (value == null || value === '') return null;
                  return (
                    <div key={key} className="flex justify-between gap-4 text-sm">
                      <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {fields[key] || key}
                      </span>
                      <span
                        className="font-medium text-right min-w-0 break-words"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {product.stock > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div
                  className="flex items-center justify-center rounded-xl border shrink-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
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
                    onClick={() =>
                      setQuantity(Math.min(product.stock, quantity + 1))
                    }
                    className="p-3 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
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
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
