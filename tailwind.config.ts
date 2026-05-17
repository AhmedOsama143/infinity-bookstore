import type { Config } from 'tailwindcss';

// Design tokens ported 1:1 from mockup1. Shared by storefront + admin.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#578e7e',
          dark: '#3c655a',
          light: '#dcebe5',
        },
        accent: {
          DEFAULT: '#e3af64',
          dark: '#da9035',
        },
        ink: '#161618',
        bg: {
          light: '#f2f2f7',
          white: '#f9f9fb',
        },
        success: '#10b981',
        danger: '#e74c3c',
      },
      fontFamily: {
        // CSS variables come from next/font in app/layout.tsx. The literal
        // names stay in the fallback chain so the browser still uses any
        // system-installed Cairo/Tajawal before falling back to sans-serif.
        heading: ['var(--font-cairo)', 'Cairo', 'sans-serif'],
        body: ['var(--font-tajawal)', 'var(--font-cairo)', 'Tajawal', 'Cairo', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        pill: '50px',
        card: '12px',
        's': '8px',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, #3c655a 0%, #578e7e 50%, #e3af64 100%)',
        'page-header':
          'linear-gradient(135deg, #3c655a, #578e7e)',
      },
    },
  },
  plugins: [],
};

export default config;
