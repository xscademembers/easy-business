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

  useEffect(() => {
    if (query) {
      doSearch(query);
    } else {
      fetchAll();
    }
  }, [query]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products?limit=50');
      const data = await res.json();
      setResults(data.products || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const doSearch = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, productId: q }),
      });
      const data = await res.json();
      setResults(data.products || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <>
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <Search size={24} style={{ color: 'var(--accent)' }} />
            <h1
              className="text-2xl md:text-3xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {query ? `Results for "${query}"` : 'All Products'}
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {loading
              ? 'Searching...'
              : `${results.length} product${results.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
      </section>

      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2
                size={40}
                className="animate-spin"
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
      <main className="min-h-screen">
        <Suspense
          fallback={
            <div className="flex justify-center py-24">
              <Loader2
                size={40}
                className="animate-spin"
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
