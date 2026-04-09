'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="pill-icon-btn p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center motion-safe:hover:scale-[1.03] motion-reduce:hover:scale-100"
      style={{
        color: 'var(--text-primary)',
      }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
