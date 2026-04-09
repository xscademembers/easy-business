'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Package,
  Loader2,
  Trash2,
  Pencil,
  Eye,
} from 'lucide-react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100');
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch {
      alert('Failed to delete product');
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
            OpenAI embeddings + Atlas vector index &quot;vector_index&quot;
          </p>
        </div>
        <Link
          href="/admin/products/add"
          className="btn-primary flex items-center gap-2 shrink-0 self-start"
        >
          <Plus size={18} />
          Add product
        </Link>
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
            placeholder="Search by name…"
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
                  className="rounded-xl p-3"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-lg overflow-hidden shrink-0"
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
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {product.name}
                      </p>
                      <p
                        className="text-xs font-mono truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {product._id}
                      </p>
                      <span
                        className="text-xs font-semibold mt-1 inline-block"
                        style={{ color: 'var(--accent)' }}
                      >
                        ${product.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 mt-2 pt-2 border-t"
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

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {['Product', 'ID', 'Price', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="pb-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr
                      key={product._id}
                      className="border-b last:border-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg overflow-hidden shrink-0"
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
                          <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {product._id}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          ${product.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
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
                            title="View"
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
