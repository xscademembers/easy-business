'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Package,
  Loader2,
  Trash2,
  Pencil,
  Eye,
  ChevronDown,
  ChevronUp,
  Maximize2,
} from 'lucide-react';

type ProductRow = {
  _id: string;
  name: string;
  price: number;
  quantity?: number;
  productCode?: string;
  image_url?: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/products/backfill-codes', { method: 'POST' }).catch(
        () => {}
      );
      const res = await fetch('/api/products?limit=500');
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p._id !== id));
      setExpandedId((e) => (e === id ? null : e));
    } catch {
      alert('Failed to delete product');
    }
  };

  const q = search.toLowerCase().trim();
  const filtered = products.filter((p) => {
    if (!q) return true;
    const name = (p.name || '').toLowerCase();
    const code = String(p.productCode || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Products
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tabular list with unique product codes (
            <span className="tabular-nums">5–7</span> digits). Expand a row for
            a larger image.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 self-start">
          <Link
            href="/admin/products/bulk"
            className="btn-secondary flex items-center gap-2"
          >
            Bulk upload
          </Link>
          <Link
            href="/admin/products/add"
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Add product
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search by name or product code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2
              size={32}
              className="animate-spin motion-reduce:animate-none"
              style={{ color: 'var(--accent)' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package
              size={48}
              className="mx-auto mb-3"
              style={{ color: 'var(--text-muted)' }}
            />
            <p style={{ color: 'var(--text-secondary)' }}>
              {search ? 'No products match your search' : 'No products yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {filtered.map((product) => (
                <div
                  key={product._id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(product._id)}
                        className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative ring-2 ring-transparent focus:outline-none focus:ring-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-tertiary)' }}
                        aria-expanded={expandedId === product._id}
                        aria-label={
                          expandedId === product._id
                            ? 'Collapse image'
                            : 'Expand image'
                        }
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package
                              size={20}
                              style={{ color: 'var(--text-muted)' }}
                            />
                          </div>
                        )}
                        <span
                          className="absolute bottom-0 right-0 p-0.5 rounded-tl"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <Maximize2 size={10} aria-hidden />
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-sm truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {product.name}
                        </p>
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                          <dt style={{ color: 'var(--text-muted)' }}>Code</dt>
                          <dd
                            className="tabular-nums font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {product.productCode || '—'}
                          </dd>
                          <dt style={{ color: 'var(--text-muted)' }}>Price</dt>
                          <dd
                            className="tabular-nums font-semibold"
                            style={{ color: 'var(--accent)' }}
                          >
                            ${Number(product.price).toFixed(2)}
                          </dd>
                          <dt style={{ color: 'var(--text-muted)' }}>Qty</dt>
                          <dd className="tabular-nums">
                            {product.quantity ?? 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  {expandedId === product._id && product.image_url && (
                    <div
                      className="px-3 pb-3 motion-safe:transition-all motion-reduce:transition-none duration-200"
                      style={{
                        borderTop: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-tertiary)',
                      }}
                    >
                      <img
                        src={product.image_url}
                        alt=""
                        className="w-full max-h-[min(70vh,480px)] object-contain mx-auto rounded-lg"
                      />
                    </div>
                  )}
                  <div
                    className="flex items-center gap-1 p-2 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <Link
                      href={`/admin/products/${product._id}`}
                      className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                    <Link
                      href={`/product/${product._id}`}
                      target="_blank"
                      className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: 'var(--success)' }}
                    >
                      <Eye size={14} /> View
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(product._id)}
                      className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-left border-collapse min-w-[640px]">
                <caption className="sr-only">Product catalog</caption>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider w-10"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      <span className="sr-only">Expand image</span>
                    </th>
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider w-14"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      Img
                    </th>
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      Product code
                    </th>
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      Name
                    </th>
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider text-right"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      Price
                    </th>
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider text-right"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      Qty
                    </th>
                    <th
                      className="p-3 text-xs font-semibold uppercase tracking-wider text-right w-[120px]"
                      style={{ color: 'var(--text-muted)' }}
                      scope="col"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <Fragment key={product._id}>
                      <tr
                        className="border-b last:border-0"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="p-2 align-middle">
                          <button
                            type="button"
                            onClick={() => toggleExpand(product._id)}
                            className="p-2 rounded-lg transition-colors motion-safe:duration-200"
                            style={{
                              color: 'var(--accent)',
                              backgroundColor:
                                expandedId === product._id
                                  ? 'var(--accent-light)'
                                  : 'transparent',
                            }}
                            aria-expanded={expandedId === product._id}
                            aria-label={
                              expandedId === product._id
                                ? 'Collapse large image'
                                : 'Show large image'
                            }
                          >
                            {expandedId === product._id ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </td>
                        <td className="p-2 align-middle">
                          <div
                            className="w-10 h-10 rounded-lg overflow-hidden"
                            style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package
                                  size={16}
                                  style={{ color: 'var(--text-muted)' }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 align-middle">
                          <span
                            className="tabular-nums text-sm font-semibold tracking-wide"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {product.productCode || '—'}
                          </span>
                        </td>
                        <td className="p-3 align-middle">
                          <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {product.name}
                          </span>
                        </td>
                        <td className="p-3 align-middle text-right">
                          <span
                            className="tabular-nums text-sm font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            ${Number(product.price).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 align-middle text-right">
                          <span
                            className="tabular-nums text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {product.quantity ?? 0}
                          </span>
                        </td>
                        <td className="p-2 align-middle text-right">
                          <div className="flex items-center justify-end gap-0">
                            <Link
                              href={`/admin/products/${product._id}`}
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: 'var(--accent)' }}
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </Link>
                            <Link
                              href={`/product/${product._id}`}
                              target="_blank"
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: 'var(--success)' }}
                              title="View storefront"
                            >
                              <Eye size={16} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(product._id)}
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: 'var(--danger)' }}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === product._id && product.image_url && (
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <td colSpan={7} className="p-4">
                            <div className="flex flex-col items-center gap-2 max-w-3xl mx-auto">
                              <p
                                className="text-xs font-medium"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {product.name} ·{' '}
                                <span className="tabular-nums">
                                  {product.productCode || '—'}
                                </span>
                              </p>
                              <img
                                src={product.image_url}
                                alt=""
                                className="w-full max-h-[min(75vh,560px)] object-contain rounded-xl"
                                style={{
                                  border: '1px solid var(--border)',
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
