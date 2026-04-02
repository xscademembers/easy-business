'use client';

import Link from 'next/link';
import { ShoppingCart, Search, Menu, X, Shield } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { ThemeToggle } from './ThemeToggle';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileOpen(false);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-200"
      style={{
        backgroundColor: 'var(--nav-bg)',
        borderColor: 'var(--border)',
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              EB
            </div>
            <span
              className="text-lg font-bold hidden sm:block"
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
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search by Product ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 !py-2 !rounded-full text-sm"
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Link
              href="/cart"
              className="relative p-2.5 rounded-xl transition-colors duration-200 hover:opacity-80"
              style={{ color: 'var(--text-primary)' }}
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <Link
              href="/admin"
              className="hidden sm:flex p-2.5 rounded-xl transition-colors duration-200 hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
              title="Admin Panel"
            >
              <Shield size={20} />
            </Link>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2.5 rounded-xl transition-colors duration-200"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            className="md:hidden py-4 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <form onSubmit={handleSearch} className="mb-3">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Search by Product ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 !py-2 text-sm"
                />
              </div>
            </form>
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Shield size={16} />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
