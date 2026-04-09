'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Upload, ChevronRight, ChevronLeft } from 'lucide-react';
import { compressImageDataUrl } from '@/lib/client/compressImageDataUrl';

type Slide = { dataUrl: string; name: string };

type SimilarMeta = {
  duplicateCandidate: { _id: string; name: string; image_url?: string } | null;
  codeMatch: { productCode: string; product: { _id?: string; name?: string } } | null;
};

export default function BulkUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '0',
    category: 'general',
    sizes: '',
  });
  const [checking, setChecking] = useState(false);
  const [similarMeta, setSimilarMeta] = useState<SimilarMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** null = no choice yet when a duplicate is shown; 'update' | 'create' = explicit choice for this slide */
  const [dupChoice, setDupChoice] = useState<'update' | 'create' | null>(null);

  const current = slides[step];

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    const next: Slide[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!;
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () =>
          typeof r.result === 'string' ? resolve(r.result) : reject();
        r.onerror = () => reject();
        r.readAsDataURL(file);
      });
      try {
        const compressed = await compressImageDataUrl(dataUrl);
        next.push({ dataUrl: compressed, name: file.name.replace(/\.[^.]+$/, '') });
      } catch {
        /* skip */
      }
    }
    if (!next.length) return;
    setSlides(next);
    setStep(0);
    setForm((f) => ({ ...f, name: next[0]!.name }));
    setSimilarMeta(null);
    setDupChoice(null);
    setError('');
  };

  const runSimilarCheck = useCallback(async (img: string) => {
    setChecking(true);
    setSimilarMeta(null);
    setDupChoice(null);
    try {
      const res = await fetch('/api/products/similar-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: img, extractCodes: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSimilarMeta({
          duplicateCandidate: data.duplicateCandidate ?? null,
          codeMatch: data.codeMatch ?? null,
        });
      }
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const s = slides[step];
    if (!s) return;
    void runSimilarCheck(s.dataUrl);
  }, [slides, step, runSimilarCheck]);

  const goStep = (idx: number) => {
    if (idx < 0 || idx >= slides.length) return;
    setStep(idx);
    const s = slides[idx]!;
    setForm((f) => ({ ...f, name: s.name }));
    setError('');
    setDupChoice(null);
    setSimilarMeta(null);
  };

  const sizesArray =
    form.category === 'clothing'
      ? form.sizes
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

  const saveCreate = async () => {
    if (!current) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity, 10) || 0,
          category: form.category,
          sizes: sizesArray,
          imageBase64: current.dataUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Create failed');
      }
      advanceAfterSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveUpdate = async (id: string) => {
    if (!current) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity, 10) || 0,
          category: form.category,
          sizes: sizesArray,
          imageBase64: current.dataUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Update failed');
      }
      advanceAfterSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const advanceAfterSave = () => {
    const rest = slides.filter((_, i) => i !== step);
    setSlides(rest);
    setStep(0);
    setDupChoice(null);
    setSimilarMeta(null);
    if (rest[0]) {
      setForm((f) => ({ ...f, name: rest[0]!.name }));
    } else {
      setForm({
        name: '',
        description: '',
        price: '',
        quantity: '0',
        category: 'general',
        sizes: '',
      });
    }
  };

  const handleNext = async () => {
    if (!current) return;
    if (!form.name.trim() || !form.price.trim()) {
      setError('Name and price are required');
      return;
    }
    if (saving) return;

    if (checking) {
      setError(
        'Still checking for similar products — wait a moment, then try Save again.'
      );
      return;
    }

    if (dupChoice === 'update' && similarMeta?.duplicateCandidate) {
      await saveUpdate(String(similarMeta.duplicateCandidate._id));
      return;
    }

    if (dupChoice === 'create') {
      await saveCreate();
      return;
    }

    if (
      similarMeta?.duplicateCandidate &&
      dupChoice !== 'update' &&
      dupChoice !== 'create'
    ) {
      setError(
        'Similar product found — choose Same product → update or New product → create, then Save again.'
      );
      return;
    }

    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/products/similar-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: current.dataUrl,
          extractCodes: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Could not verify duplicates. Try again.'
        );
      }
      setSimilarMeta({
        duplicateCandidate: data.duplicateCandidate ?? null,
        codeMatch: data.codeMatch ?? null,
      });
      if (data.duplicateCandidate) {
        setDupChoice(null);
        setError(
          'Similar product found — choose Same product → update or New product → create, then Save again.'
        );
        return;
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not verify duplicates. Try again.'
      );
      return;
    } finally {
      setChecking(false);
    }

    await saveCreate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: 'var(--accent)' }}
      >
        <ArrowLeft size={16} /> Back to products
      </Link>

      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Bulk upload
      </h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Select multiple images, then complete details for each. We check for a
        similar catalog item before you continue.
      </p>

      {slides.length === 0 ? (
        <div className="card p-8 text-center space-y-4">
          <Upload
            className="mx-auto"
            size={40}
            style={{ color: 'var(--text-muted)' }}
          />
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => inputRef.current?.click()}
          >
            Choose images
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e)}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>
              Image {step + 1} of {slides.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary !py-1 !px-2 inline-flex items-center gap-1"
                disabled={step === 0}
                onClick={() => goStep(step - 1)}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                type="button"
                className="btn-secondary !py-1 !px-2 inline-flex items-center gap-1"
                disabled={step >= slides.length - 1}
                onClick={() => goStep(step + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div
            className="rounded-xl overflow-hidden aspect-[3/4] max-w-sm mx-auto"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '2px solid var(--border)',
            }}
          >
            {current && (
              <img
                src={current.dataUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {checking && (
            <p className="text-sm flex items-center gap-2 justify-center" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
              Checking for similar products…
            </p>
          )}

          {similarMeta?.duplicateCandidate &&
            dupChoice !== 'update' &&
            dupChoice !== 'create' && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: 'var(--accent-light)',
                border: '1px solid var(--border)',
              }}
            >
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Similar product found: {similarMeta.duplicateCandidate.name}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={() => setDupChoice('update')}
                >
                  Same product → update
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setDupChoice('create')}
                >
                  New product → create
                </button>
              </div>
            </div>
          )}

          <div className="card space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Name *
                </label>
                <input
                  required
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Description
                </label>
                <textarea
                  className="input-field min-h-[80px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Price *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Category
                </label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="general">General</option>
                  <option value="clothing">Clothing</option>
                  <option value="electronics">Electronics</option>
                  <option value="home">Home</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <p className="sm:col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                A unique product code is generated automatically when each item is saved.
              </p>
              {form.category === 'clothing' && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Sizes (comma-separated)
                  </label>
                  <input
                    className="input-field"
                    value={form.sizes}
                    onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              disabled={saving || checking}
              onClick={() => void handleNext()}
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
              ) : null}
              Save &amp; continue
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSlides([]);
                setStep(0);
                setSimilarMeta(null);
                setDupChoice(null);
              }}
            >
              Cancel bulk
            </button>
          </div>
        </>
      )}
    </div>
  );
}
