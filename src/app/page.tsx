'use client';

import { useState, useCallback } from 'react';
import { Camera } from '@/components/Camera';
import { Navbar } from '@/components/Navbar';
import {
  ImageSearchResults,
  type SearchResultProduct,
} from '@/components/ImageSearchResults';
import {
  Camera as CameraIcon,
  Hash,
  ArrowLeft,
  Loader2,
  Search,
} from 'lucide-react';

export default function HomePage() {
  const [mode, setMode] = useState<'pick' | 'image' | 'id'>('pick');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState<SearchResultProduct[]>([]);
  const [similarProducts, setSimilarProducts] = useState<
    SearchResultProduct[] | undefined
  >(undefined);
  const [threshold, setThreshold] = useState<number | undefined>(undefined);

  const [idInput, setIdInput] = useState('');

  const runImageSearch = useCallback(async (imageDataUrl: string) => {
    setSearching(true);
    setMessage('Finding your product…');
    setProducts([]);
    setSimilarProducts(undefined);
    setThreshold(undefined);
    try {
      const res = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }
      setThreshold(
        typeof data.threshold === 'number' ? data.threshold : undefined
      );
      const list = (data.products || []) as SearchResultProduct[];
      setProducts(list);
      setSimilarProducts(data.similarProducts as SearchResultProduct[] | undefined);
      setMessage('');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Search failed. Please try again.'
      );
      setProducts([]);
      setSimilarProducts(undefined);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleIdSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = idInput.trim();
    if (!q) return;
    setSearching(true);
    setMessage('');
    setProducts([]);
    setSimilarProducts(undefined);
    setThreshold(undefined);
    try {
      const body =
        /^[0-9a-fA-F]{24}$/.test(q) || /^\d{5,7}$/.test(q)
          ? { id: q }
          : { query: q };
      const res = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }
      setProducts((data.products || []) as SearchResultProduct[]);
      if (!data.products?.length) {
        setMessage('No matching product found.');
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Search failed. Please try again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const goPick = () => {
    setMode('pick');
    setMessage('');
    setProducts([]);
    setSimilarProducts(undefined);
    setThreshold(undefined);
    setIdInput('');
  };

  return (
    <>
      <Navbar />
      <main className="page-shell min-h-[calc(100dvh-4rem)] flex flex-col px-4 sm:px-6 py-8 sm:py-10 safe-area-pb">
      {mode === 'pick' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md mx-auto w-full">
          <div className="text-center space-y-3 w-full motion-safe:animate-fade-up">
            <p
              className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              Visual catalog
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-accent">
              Easy Business
            </h1>
            <p
              className="text-sm sm:text-base max-w-xs mx-auto leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Find products by photo or ID in seconds.
            </p>
          </div>
          <div className="flex flex-col gap-4 w-full">
            <button
              type="button"
              className="btn-primary w-full min-h-[56px] text-base flex items-center justify-center gap-3 rounded-2xl motion-safe:animate-fade-up-delay-1"
              onClick={() => setMode('image')}
            >
              <CameraIcon size={22} aria-hidden />
              Search by Image
            </button>
            <button
              type="button"
              className="btn-secondary w-full min-h-[56px] text-base flex items-center justify-center gap-3 rounded-2xl motion-safe:animate-fade-up-delay-2"
              onClick={() => setMode('id')}
            >
              <Hash size={22} aria-hidden />
              Search by Product ID
            </button>
          </div>
        </div>
      )}

      {mode === 'image' && (
        <div className="flex-1 flex flex-col items-stretch max-w-lg mx-auto w-full gap-6">
          <button
            type="button"
            onClick={goPick}
            className="self-start inline-flex items-center gap-2 text-sm font-semibold min-h-[44px] px-3 -ml-1 rounded-xl pill-icon-btn"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={18} aria-hidden />
            Back
          </button>
          <Camera
            onCapture={runImageSearch}
            loading={searching}
            variant="portrait"
            showGallery
            lockOrientation
          />
          {message && (
            <div
              className="glass-panel-strong rounded-2xl px-4 py-4 flex items-center justify-center gap-3 border"
              style={{
                borderColor: 'var(--glass-border-subtle)',
                color: 'var(--accent)',
              }}
              role="status"
            >
              {searching && (
                <Loader2
                  className="animate-spin motion-reduce:animate-none shrink-0"
                  size={24}
                  aria-hidden
                />
              )}
              <p className="text-sm text-center">{message}</p>
            </div>
          )}
          <ImageSearchResults
            products={products}
            similarProducts={similarProducts}
            threshold={threshold}
          />
        </div>
      )}

      {mode === 'id' && (
        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full gap-6">
          <button
            type="button"
            onClick={goPick}
            className="self-start inline-flex items-center gap-2 text-sm font-semibold min-h-[44px] px-3 -ml-1 rounded-xl pill-icon-btn"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={18} aria-hidden />
            Back
          </button>
          <form
            onSubmit={handleIdSearch}
            className="space-y-5 glass-panel-strong rounded-3xl p-5 sm:p-6 border"
            style={{ borderColor: 'var(--glass-border-subtle)' }}
          >
            <label
              htmlFor="product-id-search"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Product ID (5–7 digit code or catalog ID) or name
            </label>
            <input
              id="product-id-search"
              type="search"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. 4829101"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={searching || !idInput.trim()}
              className="btn-primary w-full min-h-[52px] flex items-center justify-center gap-2 disabled:opacity-50 rounded-2xl"
            >
              {searching ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" size={20} />
              ) : (
                <Search size={20} aria-hidden />
              )}
              Search
            </button>
          </form>
          {message && (
            <p
              className="text-sm text-center px-2"
              style={{ color: 'var(--warning)' }}
              role="status"
            >
              {message}
            </p>
          )}
          {products.length > 0 && (
            <ImageSearchResults products={products} />
          )}
        </div>
      )}
      </main>
    </>
  );
}
