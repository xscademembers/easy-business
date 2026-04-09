'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

type WebSpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: Event) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type WebSpeechCtor = new () => WebSpeechRec;

interface VoiceTextButtonProps {
  onText: (text: string) => void;
  className?: string;
  label?: string;
}

export function VoiceTextButton({
  onText,
  className = '',
  label = 'Speak',
}: VoiceTextButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<WebSpeechRec | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as typeof window & {
      SpeechRecognition?: WebSpeechCtor;
      webkitSpeechRecognition?: WebSpeechCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError('');
    const w = window as typeof window & {
      SpeechRecognition?: WebSpeechCtor;
      webkitSpeechRecognition?: WebSpeechCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event: Event) => {
      const ev = event as unknown as {
        results: ArrayLike<{ 0?: { transcript?: string } }>;
      };
      const text = Array.from(ev.results)
        .map((r) => r[0]?.transcript)
        .filter(Boolean)
        .join(' ')
        .trim();
      if (text) onText(text);
      stop();
    };
    rec.onerror = () => {
      setError('Could not capture speech');
      stop();
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setError('Could not start microphone');
      setListening(false);
    }
  }, [onText, stop]);

  useEffect(() => () => stop(), [stop]);

  if (!supported) {
    return null;
  }

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        className="btn-secondary text-sm !py-2 !px-3 inline-flex items-center gap-2"
        aria-pressed={listening}
      >
        {listening ? (
          <>
            <Loader2
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
            Listening…
          </>
        ) : (
          <>
            <Mic size={16} />
            {label}
          </>
        )}
      </button>
      {listening && (
        <button
          type="button"
          onClick={stop}
          className="text-xs inline-flex items-center gap-1"
          style={{ color: 'var(--danger)' }}
        >
          <MicOff size={12} />
          Stop
        </button>
      )}
      {error && (
        <span className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
