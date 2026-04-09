import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative mt-16 border-t border-transparent">
      <div
        className="glass-panel-strong rounded-t-[28px] border-b-0 mx-2 sm:mx-4 lg:mx-auto max-w-7xl overflow-hidden"
        style={{ borderColor: 'var(--glass-border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="logo-mark w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm">
                  EB
                </div>
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Easy Business
                </span>
              </div>
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Smart inventory and visual product search for modern
                businesses.
              </p>
            </div>

            <nav aria-label="Quick links">
              <h3
                className="font-semibold mb-4 text-xs uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Quick links
              </h3>
              <ul className="space-y-3">
                {[
                  { href: '/', label: 'Home' },
                  { href: '/cart', label: 'Cart' },
                  { href: '/contact', label: 'Contact' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium inline-flex items-center min-h-[40px] motion-safe:transition-colors py-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="border-b border-transparent hover:border-current pb-0.5">
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h3
                className="font-semibold mb-4 text-xs uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Contact
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Have questions?{' '}
                <Link
                  href="/contact"
                  className="font-semibold underline underline-offset-2 decoration-2"
                  style={{ color: 'var(--accent)' }}
                >
                  Send us a message
                </Link>
              </p>
            </div>
          </div>

          <div
            className="border-t mt-10 pt-8 text-center text-sm"
            style={{
              borderColor: 'var(--glass-border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            &copy; {new Date().getFullYear()} Easy Business. All rights
            reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
