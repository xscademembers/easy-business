import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="text-center max-w-md">
        <h1
          className="text-8xl font-bold mb-4"
          style={{ color: 'var(--accent)' }}
        >
          404
        </h1>
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Page Not Found
        </h2>
        <p
          className="mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          The page you&apos;re looking for doesn&apos;t exist or the product
          may have been removed.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary flex items-center gap-2">
            <Home size={16} />
            Go Home
          </Link>
          <Link href="/search" className="btn-secondary flex items-center gap-2">
            <Search size={16} />
            Search Products
          </Link>
        </div>
      </div>
    </main>
  );
}
