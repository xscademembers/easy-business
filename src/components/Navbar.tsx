'use client';

import Link from 'next/link';
import { ShoppingCart, Search, Menu, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { ThemeToggle } from './ThemeToggle';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 glass-nav safe-area-pt">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 h-16 gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 shrink-0 min-h-[44px] min-w-[44px] sm:min-w-0 rounded-xl pr-2 -ml-2 pl-2 motion-safe:transition-opacity hover:opacity-90"
            >
              <div className="logo-mark w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm">
                EB
              </div>
              <span
                className="text-lg font-bold hidden sm:block tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Easy Business
              </span>
            </Link>

            <form
              onSubmit={handleSearch}
              className="hidden md:flex flex-1 max-w-md mx-4"
            >
              <div className="relative w-full">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                  aria-hidden
                />
                <input
                  type="text"
                  placeholder="Search by name or product ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 !py-2.5 !rounded-full text-sm"
                />
              </div>
            </form>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ThemeToggle />

              <Link
                href="/cart"
                className="relative pill-icon-btn p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: 'var(--text-primary)' }}
                aria-label={`Shopping cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
              >
                <ShoppingCart size={20} aria-hidden />
                {itemCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none"
                    style={{
                      background: `linear-gradient(135deg, var(--danger), color-mix(in srgb, var(--danger) 75%, #7f1d1d))`,
                      boxShadow: '0 2px 8px color-mix(in srgb, var(--danger) 45%, transparent)',
                    }}
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                className="md:hidden pill-icon-btn p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: 'var(--text-primary)' }}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Search and navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm motion-safe:transition-opacity"
            style={{ WebkitBackdropFilter: 'blur(8px)' }}
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="relative mt-16 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] glass-panel-strong rounded-3xl p-5 shadow-2xl flex-1 max-h-[min(70vh,calc(100dvh-5rem))] overflow-hidden flex flex-col motion-safe:animate-mobile-sheet"
          >
            <form onSubmit={handleSearch} className="space-y-3 shrink-0">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Search catalog
              </p>
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder="Name or product ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-11 !py-3.5 text-base rounded-2xl"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full min-h-[48px] rounded-2xl">
                Search
              </button>
            </form>
            <div
              className="mt-5 pt-5 border-t shrink-0"
              style={{ borderColor: 'var(--glass-border-subtle)' }}
            >
              <Link
                href="/cart"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl font-semibold pill-icon-btn"
                style={{ color: 'var(--text-primary)' }}
              >
                <ShoppingCart size={20} aria-hidden />
                View cart
                {itemCount > 0 && (
                  <span
                    className="tabular-nums text-sm px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: 'var(--accent-light)',
                      color: 'var(--accent)',
                    }}
                  >
                    {itemCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
