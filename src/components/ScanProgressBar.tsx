'use client';

interface ScanProgressBarProps {
  value: number;
  label?: string;
}

/**
 * Determinate progress for photo processing (0–100). Uses theme CSS variables.
 */
export function ScanProgressBar({ value, label = 'Progress' }: ScanProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full mt-3 space-y-2">
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full motion-reduce:transition-none transition-[width] duration-300 ease-out"
          style={{
            width: `${clamped}%`,
            backgroundColor: 'var(--accent)',
          }}
        />
      </div>
      <p
        className="text-xs text-center tabular-nums"
        style={{ color: 'var(--text-muted)' }}
      >
        {clamped}%
      </p>
    </div>
  );
}
