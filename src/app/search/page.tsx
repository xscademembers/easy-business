'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProductCard } from '@/components/ProductCard';
import { Search, Loader2, PackageSearch } from 'lucide-react';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (query) {
      void doSearch(query);
    } else {
      void fetchAll();
    }
  }, [query]);

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/products?limit=50');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchError(
          typeof data.error === 'string' ? data.error : 'Could not load products'
        );
        setResults([]);
        return;
      }
      setResults(data.products || []);
    } catch {
      setFetchError('Could not load products');
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const doSearch = async (q: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const trimmed = q.trim();
      const body =
        /^[0-9a-fA-F]{24}$/.test(trimmed)
          ? { id: trimmed }
          : { query: trimmed };
      const res = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchError(
          typeof data.error === 'string' ? data.error : 'Search failed'
        );
        setResults([]);
        return;
      }
      setResults(data.products || []);
    } catch {
      setFetchError('Search failed');
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <>
      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-panel-strong rounded-2xl sm:rounded-3xl p-5 sm:p-6 border mb-6" style={{ borderColor: 'var(--glass-border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="logo-mark w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white">
              <Search size={20} aria-hidden />
            </div>
            <h1
              className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight min-w-0"
              style={{ color: 'var(--text-primary)' }}
            >
              {query ? `Results for “${query}”` : 'All Products'}
            </h1>
          </div>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            {loading
              ? 'Searching...'
              : `${results.length} product${results.length !== 1 ? 's' : ''} found`}
          </p>
          {fetchError ? (
            <p
              className="mt-3 text-sm rounded-lg px-4 py-3"
              style={{
                color: 'var(--danger)',
                backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
              }}
              role="alert"
            >
              {fetchError}
            </p>
          ) : null}
          </div>
        </div>
      </section>

      <section className="pb-12 sm:pb-16 safe-area-pb">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2
                size={40}
                className="animate-spin motion-reduce:animate-none"
                style={{ color: 'var(--accent)' }}
              />
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {results.map((product: any) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : searched ? (
            <div className="text-center py-16">
              <PackageSearch
                size={64}
                className="mx-auto mb-4"
                style={{ color: 'var(--text-muted)' }}
              />
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                No Products Found
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Try a different search term or browse all products.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

export default function SearchPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[100dvh] page-shell">
        <Suspense
          fallback={
            <div className="flex justify-center py-24">
              <Loader2
                size={40}
                className="animate-spin motion-reduce:animate-none"
                style={{ color: 'var(--accent)' }}
              />
            </div>
          }
        >
          <SearchContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
