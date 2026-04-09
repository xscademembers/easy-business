'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera as CameraIcon,
  Save,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { compressImageDataUrl } from '@/lib/client/compressImageDataUrl';

export default function AddProductPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [form, setForm] = useState({ name: '', price: '' });
  const [image, setImage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    } catch {
      setError('Could not compress image');
      return;
    }
    stopCamera();
    setError('');
  };

  const retakeImage = () => {
    setImage('');
    void startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Capture a product photo first');
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
          price: parseFloat(form.price),
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
            Product image
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            An embedding is generated on the server (OpenAI vision → text
            embedding) and stored for visual search. Set{' '}
            <code className="text-xs">OPENAI_API_KEY</code> in your environment.
          </p>
          <div
            className="rounded-xl overflow-hidden aspect-[16/9] relative"
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
              <div className="w-full h-full flex items-center justify-center">
                <CameraIcon size={48} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

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
                placeholder="Product name"
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
    </div>
  );
}
