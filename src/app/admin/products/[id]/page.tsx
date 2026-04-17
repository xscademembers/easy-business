'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Save,
  Loader2,
  Camera as CameraIcon,
  RotateCcw,
  ArrowLeft,
  ImagePlus,
  Wand2,
  SpellCheck,
} from 'lucide-react';
import Link from 'next/link';
import { compressImageForVisualMatch } from '@/lib/client/compressImageDataUrl';
import { resetCameraZoomTo1x } from '@/lib/client/resetCameraZoomTo1x';
import { getPortraitCameraMediaStream } from '@/lib/client/portraitCameraConstraints';
import { VoiceTextButton } from '@/components/VoiceTextButton';

function EditProductPageInner() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const idStr = String(id);
  const restockMode = searchParams.get('restock') === '1';

  const [addStockQty, setAddStockQty] = useState('1');
  const [restockBusy, setRestockBusy] = useState(false);
  const [restockSuccessMsg, setRestockSuccessMsg] = useState<string | null>(null);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageDirty, setImageDirty] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [spellField, setSpellField] = useState<'name' | 'description' | null>(
    null
  );

  useEffect(() => {
    fetch(`/api/products/${idStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setForm({
          name: data.name || '',
          description: data.description || '',
          price: String(data.price ?? ''),
          quantity: String(data.quantity ?? 0),
          category: data.category || 'general',
          sizes: Array.isArray(data.sizes) ? data.sizes.join(', ') : '',
          productCode: data.productCode || '',
        });
        setImage(data.image_url || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [idStr]);

  const applyAddStock = async () => {
    const delta = parseInt(addStockQty, 10);
    if (Number.isNaN(delta) || delta <= 0) {
      setError('Enter a positive number of units to add');
      return;
    }
    setRestockBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/products/${idStr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta: delta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to add stock'
        );
      }
      if (typeof (data as { quantity?: unknown }).quantity !== 'number') {
        throw new Error('Could not read updated stock from server');
      }
      const nextQty = (data as { quantity: number }).quantity;
      setForm((f) => ({ ...f, quantity: String(nextQty) }));
      setRestockSuccessMsg(
        `Added ${delta} unit${delta === 1 ? '' : 's'}. Total stock is now ${nextQty}.`
      );
      setAddStockQty('1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add stock');
    } finally {
      setRestockBusy(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraActive || !stream || !video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream, cameraActive]);

  const startCamera = async () => {
    try {
      setError('');
      setCameraActive(true);
      const mediaStream = await getPortraitCameraMediaStream();
      await resetCameraZoomTo1x(mediaStream);
      setStream(mediaStream);
    } catch {
      setError('Could not access camera');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
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
      const compressed = await compressImageForVisualMatch(raw);
      setImage(compressed);
      setImageDirty(true);
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
        const compressed = await compressImageForVisualMatch(res);
        setImage(compressed);
        setImageDirty(true);
        stopCamera();
        setError('');
      } catch {
        setError('Could not process image');
      }
    };
    reader.readAsDataURL(file);
  };

  const replaceWithCamera = () => {
    void startCamera();
  };

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
      const isDataUrl = image.startsWith('data:');
      const isHttpUrl = /^https?:\/\//i.test(image);
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          // Always regenerate from the *current* image: send base64 when we
          // have one locally, otherwise ask the server to fetch the saved
          // http(s) URL. This also fixes the "description not working after
          // edit" case where the old code sent `undefined` for the image.
          imageBase64: image && isDataUrl ? image : undefined,
          image_url: image && !isDataUrl && isHttpUrl ? image : undefined,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity, 10) || 0,
        category: form.category.trim() || 'general',
        sizes: sizesArray,
      };
      if (imageDirty && image) {
        body.imageBase64 = image;
      }

      const res = await fetch(`/api/products/${idStr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      router.push('/admin/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2
          size={40}
          className="animate-spin motion-reduce:animate-none"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: 'var(--accent)' }}
      >
        <ArrowLeft size={16} /> Back to products
      </Link>

      <h1
        className="text-2xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {restockMode ? 'Restock product' : 'Edit product'}
      </h1>

      {restockMode && (
        <div
          className="card space-y-4"
          style={{
            border: '2px solid var(--accent)',
            backgroundColor: 'var(--accent-light)',
          }}
          role="region"
          aria-label="Add stock"
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Add stock
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Product: <span className="font-semibold">{form.name || '—'}</span>
            <br />
            Current stock:{' '}
            <span className="font-semibold tabular-nums">{form.quantity}</span>
          </p>

          {restockSuccessMsg ? (
            <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              {restockSuccessMsg}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Units to add
              </label>
              <input
                type="number"
                min={1}
                step={1}
                className="input-field"
                value={addStockQty}
                onChange={(e) => setAddStockQty(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary min-h-[48px] shrink-0"
              disabled={restockBusy}
              onClick={() => void applyAddStock()}
            >
              {restockBusy ? (
                <Loader2
                  size={18}
                  className="animate-spin motion-reduce:animate-none inline"
                />
              ) : (
                'Add to stock'
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/admin/products"
              className="btn-secondary flex-1 text-sm !py-2 text-center"
            >
              Done
            </Link>
            <button
              type="button"
              className="btn-secondary flex-1 text-sm !py-2"
              onClick={() => router.replace(`/admin/products/${idStr}`)}
            >
              Switch to full edit
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h2
            className="font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Product image
          </h2>
          <div
            className="rounded-xl overflow-hidden aspect-[3/4] max-w-md relative mx-auto"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '2px solid var(--border)',
            }}
          >
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="block h-full w-full object-cover object-center bg-black"
              />
            ) : image ? (
              <img
                src={image}
                alt="Product"
                className="block h-full w-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center min-h-[200px]">
                <CameraIcon size={48} style={{ color: 'var(--text-muted)' }} />
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
            {cameraActive ? (
              <button
                type="button"
                onClick={() => void captureImage()}
                className="btn-primary flex items-center gap-2 text-sm"
                disabled={restockMode}
              >
                <CameraIcon size={16} /> Capture
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void replaceWithCamera()}
                  className="btn-primary flex items-center gap-2 text-sm"
                  disabled={restockMode}
                >
                  <CameraIcon size={16} /> New photo from camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary flex items-center gap-2 text-sm"
                  disabled={restockMode}
                >
                  <ImagePlus size={16} />
                  From gallery
                </button>
              </>
            )}
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
                  disabled={restockMode || spellField === 'name'}
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
                disabled={restockMode}
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
                  disabled={restockMode || spellField === 'description'}
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
                  disabled={restockMode || genLoading}
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
                rows={4}
                disabled={restockMode}
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
                disabled={restockMode}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Quantity
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input-field"
                disabled={restockMode}
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
                disabled={restockMode}
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
                Product code
              </label>
              <div
                className="input-field tabular-nums tracking-wide font-medium"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                }}
                aria-live="polite"
              >
                {form.productCode || '—'}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Auto-generated and permanent. Use the product list to copy this code.
              </p>
            </div>

            {form.category === 'clothing' && (
              <div className="sm:col-span-2">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sizes (comma-separated)
                </label>
                <input
                  value={form.sizes}
                  onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                  className="input-field"
                  disabled={restockMode}
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

        {!restockMode && (
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2
                size={18}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Save size={18} />
            )}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </form>
    </div>
  );
}

export default function EditProductPage() {
  return (
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
      <EditProductPageInner />
    </Suspense>
  );
}
