'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { compressImageDataUrl } from '@/lib/client/compressImageDataUrl';
import { VoiceTextButton } from '@/components/VoiceTextButton';

export default function EditProductPage() {
  const { id } = useParams();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageDirty, setImageDirty] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [spellField, setSpellField] = useState<'name' | 'description' | null>(
    null
  );

  useEffect(() => {
    fetch(`/api/products/${id}`)
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
  }, [id]);

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
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      });
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
      const compressed = await compressImageDataUrl(raw);
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
        const compressed = await compressImageDataUrl(res);
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
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          imageBase64: imageDirty ? image : undefined,
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
        productCode: form.productCode.trim() || undefined,
      };
      if (imageDirty && image) {
        body.imageBase64 = image;
      }

      const res = await fetch(`/api/products/${id}`, {
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
        Edit product
      </h1>

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
                className="block h-full w-full object-cover bg-black"
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
              >
                <CameraIcon size={16} /> Capture
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void replaceWithCamera()}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <CameraIcon size={16} /> New photo from camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary flex items-center gap-2 text-sm"
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
                Product code (5–7 digits)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.productCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    productCode: e.target.value.replace(/\D/g, '').slice(0, 7),
                  })
                }
                className="input-field"
              />
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
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
