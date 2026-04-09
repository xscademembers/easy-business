'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Camera as CameraIcon,
  RotateCcw,
  Loader2,
  ImagePlus,
} from 'lucide-react';
import { compressImageDataUrl } from '@/lib/client/compressImageDataUrl';
import { resetCameraZoomTo1x } from '@/lib/client/resetCameraZoomTo1x';
import { getPortraitCameraMediaStream } from '@/lib/client/portraitCameraConstraints';

interface CameraProps {
  onCapture: (imageDataUrl: string) => void;
  loading?: boolean;
  /** Taller preview to encourage portrait framing (search & upload). */
  variant?: 'portrait' | 'standard';
  showGallery?: boolean;
  /** Request portrait lock when supported (mobile). */
  lockOrientation?: boolean;
}

export function Camera({
  onCapture,
  loading,
  variant = 'standard',
  showGallery = true,
  lockOrientation = false,
}: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [captured, setCaptured] = useState<string>('');
  const [compressing, setCompressing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      setCaptured('');
      stopStream();
      const mediaStream =
        variant === 'portrait'
          ? await getPortraitCameraMediaStream()
          : await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
            });
      await resetCameraZoomTo1x(mediaStream);
      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch {
      setError(
        'Unable to access camera. Please allow camera permissions and try again.'
      );
    }
  }, [stopStream, variant]);

  useEffect(() => {
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    };
  }, [startCamera]);

  useEffect(() => {
    if (!lockOrientation || !stream) return;
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
    return () => {
      if (
        o &&
        typeof (o as ScreenOrientation & { unlock?: () => void }).unlock ===
          'function'
      ) {
        try {
          (o as ScreenOrientation & { unlock: () => void }).unlock();
        } catch {
          /* ignore */
        }
      }
    };
  }, [lockOrientation, stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || captured || error) {
      if (video) video.srcObject = null;
      return;
    }
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream, captured, error]);

  const processDataUrl = async (raw: string) => {
    setCompressing(true);
    try {
      const compressed = await compressImageDataUrl(raw);
      setCaptured(compressed);
      stopStream();
      onCapture(compressed);
    } catch {
      setError('Could not process the image. Try again.');
    } finally {
      setCompressing(false);
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
    await processDataUrl(raw);
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res === 'string') void processDataUrl(res);
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    setCaptured('');
    void startCamera();
  };

  const busy = loading || compressing;

  const frameClass =
    variant === 'portrait'
      ? 'relative min-h-[280px] overflow-hidden rounded-2xl aspect-[3/4] max-w-md mx-auto'
      : 'relative min-h-[240px] overflow-hidden rounded-2xl aspect-[4/3]';

  return (
    <div className="w-full min-w-0">
      <div
        className={`${frameClass} glass-panel-strong overflow-hidden`}
        style={{
          borderColor: 'var(--glass-border)',
          boxShadow: `var(--glass-shadow), inset 0 1px 0 var(--glass-border-subtle)`,
        }}
      >
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <CameraIcon
              size={48}
              className="mb-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <p
              className="text-sm mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="btn-primary text-sm !px-4 !py-2"
            >
              Try Again
            </button>
          </div>
        ) : captured ? (
          <img
            src={captured}
            alt="Captured"
            className="block h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="block h-full w-full object-cover object-center bg-black"
          />
        )}

        {busy && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2
              size={40}
              className="text-white animate-spin motion-reduce:animate-none"
            />
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
        onChange={onGalleryChange}
      />

      <div className="flex flex-wrap gap-3 mt-4">
        {captured ? (
          <button
            type="button"
            onClick={retake}
            disabled={busy}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50 min-h-[44px]"
          >
            <RotateCcw size={16} />
            Retake
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void captureImage()}
              disabled={!!error || busy || !stream}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50 min-h-[44px]"
            >
              <CameraIcon size={16} />
              Capture Image
            </button>
            {showGallery && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!error || busy}
                className="btn-secondary flex items-center justify-center gap-2 text-sm px-4 min-h-[44px] disabled:opacity-50"
                aria-label="Upload from gallery"
              >
                <ImagePlus size={16} />
                Gallery
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
