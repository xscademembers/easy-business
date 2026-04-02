import Link from 'next/link';

export function Footer() {
  return (
    <footer
      className="border-t mt-16"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                EB
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                Easy Business
              </span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Smart inventory & product identification system for modern
              businesses.
            </p>
          </div>

          <nav aria-label="Quick links">
            <h3
              className="font-semibold mb-4 text-sm uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Quick Links
            </h3>
            <ul className="space-y-2">
              {[
                { href: '/', label: 'Home' },
                { href: '/cart', label: 'Cart' },
                { href: '/contact', label: 'Contact' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors duration-200 hover:underline"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3
              className="font-semibold mb-4 text-sm uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Contact
            </h3>
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Have questions?{' '}
              <Link
                href="/contact"
                className="underline"
                style={{ color: 'var(--accent)' }}
              >
                Send us a message
              </Link>
            </p>
          </div>
        </div>

        <div
          className="border-t mt-8 pt-8 text-center text-sm"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          &copy; {new Date().getFullYear()} Easy Business. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
