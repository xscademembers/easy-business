'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Camera } from '@/components/Camera';
import { Camera as CameraIcon, Search, Sparkles, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [message, setMessage] = useState('');

  const handleCapture = async (imageDataUrl: string) => {
    setSearching(true);
    setMessage('Finding your product…');
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
      if (data.products?.length > 0) {
        setMessage('');
        router.push(`/product/${data.products[0]._id}`);
      } else {
        setMessage('No matching product found. Try a different angle or search by ID.');
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Search failed. Please try again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleIdSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    const q = searchId.trim();
    if (/^[0-9a-fA-F]{24}$/.test(q)) {
      router.push(`/product/${q}`);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <Navbar />
      <main>
        <section
          className="relative overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}
                >
                  <Sparkles size={14} />
                  Visual product search
                </div>

                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Scan. Match.{' '}
                  <span style={{ color: 'var(--accent)' }}>Shop.</span>
                </h1>

                <p
                  className="text-lg md:text-xl leading-relaxed max-w-lg"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Take a photo and we&apos;ll match it to the closest product in
                  the catalog using OpenAI vision and text embeddings.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowCamera(!showCamera)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CameraIcon size={18} />
                    {showCamera ? 'Hide Camera' : 'Scan Product'}
                  </button>
                  <a
                    href="#search"
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Search size={18} />
                    Search by ID or name
                  </a>
                </div>
              </div>

              {showCamera && (
                <div className="card min-w-0 w-full">
                  <Camera onCapture={handleCapture} loading={searching} />
                  {message && (
                    <div
                      className="mt-4 px-4 py-3 rounded-xl flex flex-col items-center gap-3"
                      style={{
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent)',
                      }}
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
                </div>
              )}

              {!showCamera && (
                <div className="hidden md:flex items-center justify-center">
                  <div
                    className="w-64 h-64 rounded-3xl flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--accent-light)',
                      border: '2px dashed var(--accent)',
                    }}
                  >
                    <div className="text-center space-y-3">
                      <CameraIcon
                        size={56}
                        style={{ color: 'var(--accent)' }}
                        className="mx-auto"
                      />
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        Click &quot;Scan Product&quot; to start
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          id="search"
          className="py-16"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2
                className="text-2xl md:text-3xl font-bold mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                Search by product ID or name
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Enter a MongoDB product ID (24 hex characters) or part of the
                product name
              </p>
            </div>
            <form
              onSubmit={handleIdSearch}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Product ID or name"
                className="input-field flex-1"
              />
              <button
                type="submit"
                className="btn-primary flex items-center justify-center gap-2 shrink-0"
              >
                <Search size={18} />
                Search
              </button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
