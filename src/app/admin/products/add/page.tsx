'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera as CameraIcon,
  Save,
  Loader2,
  Plus,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  processProductImage,
  PRODUCT_FEATURE_PIPELINE_VERSION,
} from '@/lib/productImagePipeline';

const CATEGORIES = ['clothing', 'electronics', 'food', 'utensils', 'other'];

const CATEGORY_FIELDS: Record<string, { key: string; label: string; type: string }[]> = {
  clothing: [
    { key: 'fabric', label: 'Fabric', type: 'text' },
    { key: 'length', label: 'Length', type: 'text' },
    { key: 'width', label: 'Width', type: 'text' },
    { key: 'size', label: 'Size', type: 'text' },
  ],
  electronics: [
    { key: 'voltage', label: 'Voltage', type: 'text' },
    { key: 'warranty', label: 'Warranty', type: 'text' },
    { key: 'powerConsumption', label: 'Power Consumption', type: 'text' },
    { key: 'brand', label: 'Brand', type: 'text' },
  ],
  food: [
    { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { key: 'ingredients', label: 'Ingredients', type: 'text' },
    { key: 'weight', label: 'Weight', type: 'text' },
    { key: 'vegNonVeg', label: 'Veg / Non-Veg', type: 'text' },
  ],
  utensils: [
    { key: 'material', label: 'Material', type: 'text' },
    { key: 'capacity', label: 'Capacity', type: 'text' },
    { key: 'dimensions', label: 'Dimensions', type: 'text' },
  ],
};

interface Variant {
  size: string;
  color: string;
  material: string;
  price: string;
}

export default function AddProductPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    stock: '',
    price: '',
    category: 'other',
  });
  const [categoryFields, setCategoryFields] = useState<Record<string, string>>({});
  const [variants, setVariants] = useState<Variant[]>([]);
  const [image, setImage] = useState('');
  const [featureCode, setFeatureCode] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fingerprinting, setFingerprinting] = useState(false);
  const [fingerprintHint, setFingerprintHint] = useState('');

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
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setError('Could not access camera');
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setImage(dataUrl);
    setFeatureCode('');
    setOcrText('');
    stopCamera();
    setFingerprinting(true);
    setFingerprintHint('Scanning image (OCR + fingerprint)…');
    setError('');
    try {
      const result = await processProductImage(dataUrl, {
        progress: (key, current, total) => {
          setFingerprintHint(`${key} (${current} / ${total})`);
        },
      });
      setFeatureCode(result.featureCode);
      setOcrText(result.ocrText);
      setFingerprintHint('');
    } catch {
      setError('Could not process product image. Try again or retake the photo.');
      setImage('');
      setFingerprintHint('');
    } finally {
      setFingerprinting(false);
    }
  };

  const retakeImage = () => {
    setImage('');
    setFeatureCode('');
    setOcrText('');
    setFingerprintHint('');
    startCamera();
  };

  const addVariant = () =>
    setVariants([...variants, { size: '', color: '', material: '', price: '' }]);

  const removeVariant = (i: number) =>
    setVariants(variants.filter((_, idx) => idx !== i));

  const updateVariant = (i: number, field: keyof Variant, value: string) =>
    setVariants(
      variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        name: form.name,
        description: form.description,
        stock: parseInt(form.stock) || 0,
        price: parseFloat(form.price) || 0,
        category: form.category,
        image,
        featureCode,
        featureCodeVersion: PRODUCT_FEATURE_PIPELINE_VERSION,
        ocrText,
        categoryFields,
        variants: variants
          .filter((v) => v.size || v.color || v.material)
          .map((v) => ({
            ...v,
            price: v.price ? parseFloat(v.price) : undefined,
          })),
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const dynamicFields = CATEGORY_FIELDS[form.category] || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1
        className="text-2xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        Add Product
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h2
            className="font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Product Image
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Background is removed in the browser before saving a fingerprint, so customer scans match even when the backdrop differs.
          </p>
          <div
            className="rounded-xl overflow-hidden aspect-[16/9] relative"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '2px solid var(--border)',
            }}
          >
            {image ? (
              <img src={image} alt="Preview" className="block h-full w-full object-cover" />
            ) : cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="block h-full w-full object-cover bg-black"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <CameraIcon size={48} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            {fingerprinting && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)' }}
              >
                <Loader2
                  className="animate-spin motion-reduce:animate-none"
                  size={32}
                  style={{ color: 'var(--accent)' }}
                  aria-hidden
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {fingerprintHint || 'Preparing fingerprint…'}
                </span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex gap-3">
            {image ? (
              <button
                type="button"
                onClick={retakeImage}
                disabled={fingerprinting}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <RotateCcw size={16} /> Retake
              </button>
            ) : cameraActive ? (
              <button
                type="button"
                onClick={captureImage}
                disabled={fingerprinting}
                className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <CameraIcon size={16} /> Capture
              </button>
            ) : (
              <button type="button" onClick={startCamera} className="btn-primary flex items-center gap-2 text-sm">
                <CameraIcon size={16} /> Open Camera
              </button>
            )}
          </div>

          {ocrText && (
            <div
              className="rounded-xl p-3 text-sm"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                OCR Text Detected:
              </span>{' '}
              {ocrText}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Basic Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Product Name *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Product name"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field resize-none"
                placeholder="Product description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Stock Quantity *
              </label>
              <input
                type="number"
                required
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value });
                  setCategoryFields({});
                }}
                className="input-field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {dynamicFields.length > 0 && (
          <div className="card space-y-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {form.category.charAt(0).toUpperCase() + form.category.slice(1)} Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {dynamicFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={categoryFields[field.key] || ''}
                    onChange={(e) =>
                      setCategoryFields({ ...categoryFields, [field.key]: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Variants
            </h2>
            <button
              type="button"
              onClick={addVariant}
              className="text-sm font-medium flex items-center gap-1"
              style={{ color: 'var(--accent)' }}
            >
              <Plus size={16} /> Add Variant
            </button>
          </div>
          {variants.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No variants added. Click &quot;Add Variant&quot; to create size, color, or material options.
            </p>
          )}
          {variants.map((v, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-3 items-end rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Size</label>
                <input value={v.size} onChange={(e) => updateVariant(i, 'size', e.target.value)} className="input-field text-sm !py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Color</label>
                <input value={v.color} onChange={(e) => updateVariant(i, 'color', e.target.value)} className="input-field text-sm !py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Material</label>
                <input value={v.material} onChange={(e) => updateVariant(i, 'material', e.target.value)} className="input-field text-sm !py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Price</label>
                <input type="number" step="0.01" value={v.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} className="input-field text-sm !py-2" />
              </div>
              <button type="button" onClick={() => removeVariant(i)} className="p-2 rounded-lg self-end" style={{ color: 'var(--danger)' }}>
                <X size={18} />
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || fingerprinting || (!!image && !featureCode)}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Product'}
        </button>
      </form>
    </div>
  );
}
