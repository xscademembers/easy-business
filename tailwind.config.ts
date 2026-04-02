import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'th-bg': 'var(--bg-primary)',
        'th-bg-secondary': 'var(--bg-secondary)',
        'th-bg-tertiary': 'var(--bg-tertiary)',
        'th-text': 'var(--text-primary)',
        'th-text-secondary': 'var(--text-secondary)',
        'th-text-muted': 'var(--text-muted)',
        'th-accent': 'var(--accent)',
        'th-accent-hover': 'var(--accent-hover)',
        'th-accent-light': 'var(--accent-light)',
        'th-border': 'var(--border)',
        'th-card': 'var(--card-bg)',
        'th-success': 'var(--success)',
        'th-danger': 'var(--danger)',
        'th-warning': 'var(--warning)',
        'th-nav': 'var(--nav-bg)',
      },
    },
  },
  plugins: [],
};

export default config;
