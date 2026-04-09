'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera as CameraIcon,
  Save,
  Loader2,
  RotateCcw,
  ImagePlus,
  Wand2,
  SpellCheck,
} from 'lucide-react';
import { compressImageDataUrl } from '@/lib/client/compressImageDataUrl';
import { VoiceTextButton } from '@/components/VoiceTextButton';

type SimilarMeta = {
  duplicateCandidate: {
    _id: string;
    name: string;
    price?: number;
    image_url?: string;
    similarityScore?: number;
  } | null;
  codeMatch: { productCode: string; product: { _id?: string; name?: string } } | null;
};

export default function AddProductPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '0',
    category: 'general',
    sizes: '',
    productCode: '',
  });
  const [image, setImage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [similarMeta, setSimilarMeta] = useState<SimilarMeta | null>(null);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [dupModal, setDupModal] = useState(false);
  const [codeModal, setCodeModal] = useState(false);
  const [restockQty, setRestockQty] = useState('1');
  const [genLoading, setGenLoading] = useState(false);
  const [spellField, setSpellField] = useState<'name' | 'description' | null>(
    null
  );
  const [ignoreCodeMatch, setIgnoreCodeMatch] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraActive || !stream || !video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream, cameraActive]);

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setError('Could not access camera');
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const raw = canvas.toDataURL('image/jpeg', 0.85);
    try {
      const compressed = await compressImageDataUrl(raw);
      setImage(compressed);
    } catch {
      setError('Could not compress image');
      return;
    }
    stopCamera();
    setError('');
  };

  const onGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = reader.result;
      if (typeof res !== 'string') return;
      try {
        const compressed = await compressImageDataUrl(res);
        setImage(compressed);
        stopCamera();
        setError('');
      } catch {
        setError('Could not process image');
      }
    };
    reader.readAsDataURL(file);
  };

  const retakeImage = () => {
    setImage('');
    setSimilarMeta(null);
    setIgnoreCodeMatch(false);
    void startCamera();
  };

  const runSimilarCheck = useCallback(async (img: string) => {
    setCheckingSimilar(true);
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
      /* optional */
    } finally {
      setCheckingSimilar(false);
    }
  }, []);

  useEffect(() => {
    if (!image) {
      setSimilarMeta(null);
      return;
    }
    const t = window.setTimeout(() => void runSimilarCheck(image), 500);
    return () => window.clearTimeout(t);
  }, [image, runSimilarCheck]);

  const tryLockPortrait = () => {
    const o = screen.orientation;
    if (
      o &&
      typeof (o as ScreenOrientation & { lock?: (s: string) => Promise<void> })
        .lock === 'function'
    ) {
      void (o as ScreenOrientation & { lock: (s: string) => Promise<void> })
        .lock('portrait')
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (!cameraActive || !stream) return;
    tryLockPortrait();
  }, [cameraActive, stream]);

  const spellcheck = async (field: 'name' | 'description') => {
    const raw = form[field].trim();
    if (!raw) return;
    setSpellField(field);
    try {
      const res = await fetch('/api/ai/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Spell check failed');
      setForm((f) => ({ ...f, [field]: data.corrected || f[field] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spell check failed');
    } finally {
      setSpellField(null);
    }
  };

  const generateDescription = async () => {
    if (!form.name.trim()) {
      setError('Add a product name first');
      return;
    }
    setGenLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          imageBase64: image || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate');
      setForm((f) => ({
        ...f,
        description: data.description || f.description,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setGenLoading(false);
    }
  };

  const sizesArray =
    form.category === 'clothing'
      ? form.sizes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const createProduct = async () => {
    if (!image) {
      setError('Add a product photo first');
      return;
    }
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
          category: form.category.trim() || 'general',
          sizes: sizesArray,
          productCode: form.productCode.trim() || undefined,
          imageBase64: image,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }
      router.push('/admin/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const updateExistingFromDuplicate = async (id: string) => {
    if (!image) return;
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
          category: form.category.trim() || 'general',
          sizes: sizesArray,
          productCode: form.productCode.trim() || undefined,
          imageBase64: image,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
      setDupModal(false);
      router.push('/admin/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const applyRestock = async () => {
    const id = similarMeta?.codeMatch?.product?._id;
    if (!id) return;
    const delta = parseInt(restockQty, 10);
    if (Number.isNaN(delta) || delta <= 0) {
      setError('Enter a positive quantity to add');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta: delta }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Restock failed');
      }
      setCodeModal(false);
      router.push('/admin/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Restock failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (similarMeta?.codeMatch && !ignoreCodeMatch && !codeModal) {
      setCodeModal(true);
      return;
    }
    if (similarMeta?.duplicateCandidate && !dupModal) {
      setDupModal(true);
      return;
    }
    await createProduct();
  };

  const proceedAddNewDespiteDuplicate = async () => {
    setDupModal(false);
    await createProduct();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1
          className="text-2xl font-bold flex-1 min-w-0"
          style={{ color: 'var(--text-primary)' }}
        >
          Add Product
        </h1>
        <Link
          href="/admin/products/bulk"
          className="btn-secondary text-sm !py-2 !px-3"
        >
          Bulk upload
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h2
            className="font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Product image
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Portrait photo works best. We scan for a 5–7 digit code on the label
            for restock hints and compare embeddings for duplicates.
          </p>
          <div
            className="rounded-xl overflow-hidden aspect-[3/4] max-w-md relative mx-auto"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '2px solid var(--border)',
            }}
          >
            {image ? (
              <img
                src={image}
                alt="Preview"
                className="block h-full w-full object-cover"
              />
            ) : cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="block h-full w-full object-cover bg-black"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center min-h-[200px]">
                <CameraIcon size={48} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            {checkingSimilar && (
              <div className="absolute top-2 right-2 rounded-lg px-2 py-1 text-xs flex items-center gap-1 bg-black/60 text-white">
                <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                Checking…
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden
            onChange={onGalleryPick}
          />

          <div className="flex flex-wrap gap-3">
            {image ? (
              <button
                type="button"
                onClick={retakeImage}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RotateCcw size={16} /> Retake
              </button>
            ) : cameraActive ? (
              <button
                type="button"
                onClick={() => void captureImage()}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <CameraIcon size={16} /> Capture
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <CameraIcon size={16} /> Open camera
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <ImagePlus size={16} />
              From gallery
            </button>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <label
                  className="block text-sm font-medium flex-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Name *
                </label>
                <VoiceTextButton
                  label="Name (mic)"
                  onText={(t) => setForm((f) => ({ ...f, name: t }))}
                />
                <button
                  type="button"
                  className="btn-secondary text-xs !py-1.5 !px-2 inline-flex items-center gap-1"
                  onClick={() => void spellcheck('name')}
                  disabled={spellField === 'name'}
                >
                  {spellField === 'name' ? (
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <SpellCheck size={14} />
                  )}
                  Spell check
                </button>
              </div>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Product name"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <label
                  className="block text-sm font-medium flex-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Description
                </label>
                <VoiceTextButton
                  label="Description (mic)"
                  onText={(t) =>
                    setForm((f) => ({
                      ...f,
                      description: f.description
                        ? `${f.description} ${t}`
                        : t,
                    }))
                  }
                />
                <button
                  type="button"
                  className="btn-secondary text-xs !py-1.5 !px-2 inline-flex items-center gap-1"
                  onClick={() => void spellcheck('description')}
                  disabled={spellField === 'description'}
                >
                  {spellField === 'description' ? (
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <SpellCheck size={14} />
                  )}
                  Spell check
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs !py-1.5 !px-2 inline-flex items-center gap-1"
                  onClick={() => void generateDescription()}
                  disabled={genLoading}
                >
                  {genLoading ? (
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Wand2 size={14} />
                  )}
                  Generate description
                </button>
              </div>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="input-field min-h-[96px] resize-y"
                placeholder="Short description"
                rows={4}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Price *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input-field"
                placeholder="0.00"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Quantity in stock
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                <option value="general">General</option>
                <option value="clothing">Clothing</option>
                <option value="electronics">Electronics</option>
                <option value="home">Home</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Product code (optional, 5–7 digits)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{5,7}"
                value={form.productCode}
                onChange={(e) =>
                  setForm({ ...form, productCode: e.target.value.replace(/\D/g, '').slice(0, 7) })
                }
                className="input-field"
                placeholder="Auto if empty"
              />
            </div>

            {form.category === 'clothing' && (
              <div className="sm:col-span-2">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sizes (comma-separated, e.g. S, M, L, XL)
                </label>
                <input
                  value={form.sizes}
                  onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                  className="input-field"
                  placeholder="S, M, L, XL"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <p
            className="text-sm px-4 py-3 rounded-xl"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--danger) 10%, transparent)',
              color: 'var(--danger)',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !image}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Saving…' : 'Save product'}
        </button>
      </form>

      {dupModal && similarMeta?.duplicateCandidate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-title"
        >
          <div
            className="card max-w-md w-full space-y-4 p-6"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <h2 id="dup-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              This looks like an existing product
            </h2>
            <div className="flex gap-3 items-center">
              {similarMeta.duplicateCandidate.image_url && (
                <img
                  src={similarMeta.duplicateCandidate.image_url}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              )}
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {similarMeta.duplicateCandidate.name}
                </p>
                {similarMeta.duplicateCandidate.similarityScore != null && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Similarity score:{' '}
                    {similarMeta.duplicateCandidate.similarityScore.toFixed(3)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={saving}
                onClick={() =>
                  void updateExistingFromDuplicate(
                    String(similarMeta.duplicateCandidate!._id)
                  )
                }
              >
                Update existing
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={saving}
                onClick={() => void proceedAddNewDespiteDuplicate()}
              >
                Add new
              </button>
            </div>
            <button
              type="button"
              className="text-sm w-full"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setDupModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {codeModal && similarMeta?.codeMatch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card max-w-md w-full space-y-4 p-6"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Code {similarMeta.codeMatch.productCode} matches an existing product
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {similarMeta.codeMatch.product.name || 'Existing item'}
            </p>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Quantity to add
            </label>
            <input
              type="number"
              min="1"
              className="input-field"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={saving}
                onClick={() => void applyRestock()}
              >
                Restock (add quantity)
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={saving}
                onClick={() => {
                  setCodeModal(false);
                  setIgnoreCodeMatch(true);
                  if (similarMeta.duplicateCandidate) setDupModal(true);
                  else void createProduct();
                }}
              >
                Create new anyway
              </button>
            </div>
            <button
              type="button"
              className="text-sm w-full"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => {
                setCodeModal(false);
                setIgnoreCodeMatch(true);
              }}
            >
              Dismiss code hint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
