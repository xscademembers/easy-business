'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Camera } from '@/components/Camera';
import {
  processProductImage,
  PRODUCT_FEATURE_PIPELINE_VERSION,
} from '@/lib/productImagePipeline';
import { SCAN_CHECKING_STORE, SCAN_WORKING } from '@/lib/scanUiCopy';
import { ScanProgressBar } from '@/components/ScanProgressBar';
import { Camera as CameraIcon, Search, Sparkles } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [message, setMessage] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  const handleCapture = async (imageDataUrl: string) => {
    setSearching(true);
    setScanProgress(0);
    setMessage(SCAN_WORKING);
    try {
      const result = await processProductImage(imageDataUrl, {
        onProgress: setScanProgress,
      });
      setMessage(SCAN_CHECKING_STORE);
      const res = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureCode: result.featureCode,
          ocrText: result.ocrText,
          pipelineVersion: PRODUCT_FEATURE_PIPELINE_VERSION,
        }),
      });
      const data = await res.json();
      if (data.products?.length > 0) {
        setMessage('');
        router.push(`/product/${data.products[0]._id}`);
      } else {
        setMessage('No matching product found. Try a different angle or search manually.');
      }
    } catch {
      setMessage('Search failed. Please try again.');
    } finally {
      setSearching(false);
      setScanProgress(0);
    }
  };

  const handleIdSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchId.trim())}`);
  };

  return (
    <>
      <Navbar />
      <main>
        <section
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
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
                  AI-Powered Product Search
                </div>

                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Scan. Search.{' '}
                  <span style={{ color: 'var(--accent)' }}>Shop.</span>
                </h1>

                <p
                  className="text-lg md:text-xl leading-relaxed max-w-lg"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Use your camera to instantly identify products or search by
                  Product ID. Shopping made effortless.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowCamera(!showCamera)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CameraIcon size={18} />
                    {showCamera ? 'Hide Camera' : 'Scan Product'}
                  </button>
                  <a href="#search" className="btn-secondary flex items-center gap-2">
                    <Search size={18} />
                    Search by ID
                  </a>
                </div>
              </div>

              {showCamera && (
                <div className="card min-w-0 w-full">
                  <Camera onCapture={handleCapture} loading={searching} />
                  {message && (
                    <div
                      className="mt-4 px-4 py-3 rounded-xl"
                      style={{
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent)',
                      }}
                    >
                      <p className="text-sm text-center">{message}</p>
                      {searching && (
                        <ScanProgressBar
                          value={scanProgress}
                          label="Scan progress"
                        />
                      )}
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
                Search by Product ID
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Enter the unique product ID to find exactly what you need
              </p>
            </div>
            <form onSubmit={handleIdSearch} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="e.g. PRD-00001"
                className="input-field flex-1"
              />
              <button type="submit" className="btn-primary flex items-center justify-center gap-2 shrink-0">
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
