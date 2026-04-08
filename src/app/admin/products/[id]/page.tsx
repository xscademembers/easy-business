'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Save,
  Loader2,
  Camera as CameraIcon,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { compressImageDataUrl } from '@/lib/client/compressImageDataUrl';

export default function EditProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [form, setForm] = useState({ name: '', price: '' });
  const [image, setImage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageDirty, setImageDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setForm({
          name: data.name || '',
          price: String(data.price ?? ''),
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

  const retakeImage = () => {
    setImageDirty(true);
    void startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        price: parseFloat(form.price),
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Capture a new photo to recompute the embedding and update visual
            search.
          </p>
          <div
            className="rounded-xl overflow-hidden aspect-[16/9] relative"
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
              <div className="w-full h-full flex items-center justify-center">
                <CameraIcon size={48} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

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
                  onClick={() => void startCamera()}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <CameraIcon size={16} /> New photo from camera
                </button>
                <button
                  type="button"
                  onClick={retakeImage}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <RotateCcw size={16} /> Replace with camera
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
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Name *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
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
