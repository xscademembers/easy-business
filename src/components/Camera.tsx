'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera as CameraIcon, RotateCcw, Loader2 } from 'lucide-react';

interface CameraProps {
  onCapture: (imageDataUrl: string) => void;
  loading?: boolean;
}

export function Camera({ onCapture, loading }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [captured, setCaptured] = useState<string>('');

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
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch {
      setError(
        'Unable to access camera. Please allow camera permissions and try again.'
      );
    }
  }, [stopStream]);

  useEffect(() => {
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    };
  }, [startCamera]);

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

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCaptured(dataUrl);
    stopStream();
    onCapture(dataUrl);
  };

  const retake = () => {
    void startCamera();
  };

  return (
    <div className="w-full min-w-0">
      <div
        className="relative min-h-[240px] overflow-hidden rounded-2xl aspect-[4/3]"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '2px solid var(--border)',
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
            <button onClick={() => void startCamera()} className="btn-primary text-sm !px-4 !py-2">
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
            className="block h-full w-full object-cover bg-black"
          />
        )}

        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2
              size={40}
              className="text-white animate-spin motion-reduce:animate-none"
            />
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-3 mt-4">
        {captured ? (
          <button
            onClick={retake}
            disabled={loading}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <RotateCcw size={16} />
            Retake
          </button>
        ) : (
          <button
            onClick={captureImage}
            disabled={!!error || loading || !stream}
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <CameraIcon size={16} />
            Capture Image
          </button>
        )}
      </div>
    </div>
  );
}
