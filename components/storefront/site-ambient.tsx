'use client';

import { useEffect } from 'react';

// Fixed-position decorative icons that scatter across the page.
// Mirrors the `.bg-icon` markup used across mockup1's pages.
const ICONS: {
  icon: string;
  size?: 'small' | 'large' | 'xlarge';
  left: string;
  top: string;
  color: string;
  opacity: number;
  duration: string;
  delay: string;
  speed: number;
}[] = [
  { icon: 'fa-book',           left: '3%',  top: '8%',   color: '#578e7e', opacity: 0.14, duration: '12s', delay: '0s',   speed: 0.2  },
  { icon: 'fa-book-open',      size: 'large',  left: '15%', top: '25%',  color: '#e3af64', opacity: 0.12, duration: '18s', delay: '2s',   speed: 0.35 },
  { icon: 'fa-bookmark',       size: 'small',  left: '8%',  top: '55%',  color: '#578e7e', opacity: 0.16, duration: '10s', delay: '1s',   speed: 0.15 },
  { icon: 'fa-graduation-cap', size: 'xlarge', left: '25%', top: '10%',  color: '#e3af64', opacity: 0.10, duration: '22s', delay: '3s',   speed: 0.4  },
  { icon: 'fa-pen',            left: '35%', top: '40%',  color: '#578e7e', opacity: 0.14, duration: '14s', delay: '5s',   speed: 0.25 },
  { icon: 'fa-pencil',         size: 'small',  left: '45%', top: '70%',  color: '#e3af64', opacity: 0.16, duration: '9s',  delay: '0.5s', speed: 0.3  },
  { icon: 'fa-highlighter',    size: 'large',  left: '55%', top: '15%',  color: '#578e7e', opacity: 0.12, duration: '20s', delay: '4s',   speed: 0.45 },
  { icon: 'fa-glasses',        left: '65%', top: '50%',  color: '#e3af64', opacity: 0.14, duration: '16s', delay: '2.5s', speed: 0.2  },
  { icon: 'fa-book-reader',    size: 'xlarge', left: '75%', top: '85%',  color: '#578e7e', opacity: 0.10, duration: '25s', delay: '6s',   speed: 0.5  },
  { icon: 'fa-scroll',         size: 'small',  left: '85%', top: '30%',  color: '#e3af64', opacity: 0.18, duration: '11s', delay: '1.5s', speed: 0.15 },
  { icon: 'fa-feather',        left: '92%', top: '60%',  color: '#578e7e', opacity: 0.14, duration: '15s', delay: '3.5s', speed: 0.3  },
  { icon: 'fa-star',           size: 'small',  left: '20%', top: '90%',  color: '#e3af64', opacity: 0.16, duration: '8s',  delay: '7s',   speed: 0.25 },
  { icon: 'fa-book',           size: 'large',  left: '50%', top: '120%', color: '#578e7e', opacity: 0.12, duration: '19s', delay: '0s',   speed: 0.35 },
  { icon: 'fa-book-open',      left: '70%', top: '140%', color: '#e3af64', opacity: 0.14, duration: '13s', delay: '8s',   speed: 0.4  },
  { icon: 'fa-bookmark',       size: 'xlarge', left: '10%', top: '160%', color: '#578e7e', opacity: 0.10, duration: '24s', delay: '4.5s', speed: 0.5  },
  { icon: 'fa-graduation-cap', left: '40%', top: '180%', color: '#e3af64', opacity: 0.14, duration: '17s', delay: '9s',   speed: 0.2  },
  { icon: 'fa-pen',            size: 'large',  left: '60%', top: '200%', color: '#578e7e', opacity: 0.12, duration: '21s', delay: '1s',   speed: 0.45 },
  { icon: 'fa-glasses',        size: 'small',  left: '30%', top: '130%', color: '#e3af64', opacity: 0.18, duration: '10s', delay: '5.5s', speed: 0.1  },
  { icon: 'fa-feather',        left: '80%', top: '170%', color: '#578e7e', opacity: 0.14, duration: '14s', delay: '2s',   speed: 0.3  },
  { icon: 'fa-scroll',         size: 'large',  left: '95%', top: '100%', color: '#e3af64', opacity: 0.12, duration: '23s', delay: '6.5s', speed: 0.35 },
  { icon: 'fa-star',           left: '5%',  top: '150%', color: '#578e7e', opacity: 0.16, duration: '12s', delay: '3s',   speed: 0.2  },
  { icon: 'fa-book-reader',    size: 'small',  left: '48%', top: '5%',   color: '#e3af64', opacity: 0.14, duration: '16s', delay: '10s',  speed: 0.15 },
  { icon: 'fa-highlighter',    left: '88%', top: '45%',  color: '#578e7e', opacity: 0.12, duration: '18s', delay: '7.5s', speed: 0.4  },
];

const BUBBLES: { size: number; left: string; color: string; duration: string; delay: string }[] = [
  { size: 20, left: '5%',  color: 'rgba(87,142,126,0.08)', duration: '12s', delay: '0s'   },
  { size: 40, left: '15%', color: 'rgba(227,175,100,0.06)', duration: '15s', delay: '2s'   },
  { size: 15, left: '25%', color: 'rgba(87,142,126,0.07)', duration: '10s', delay: '4s'   },
  { size: 50, left: '40%', color: 'rgba(227,175,100,0.05)', duration: '18s', delay: '1s'   },
  { size: 25, left: '55%', color: 'rgba(87,142,126,0.08)', duration: '14s', delay: '3s'   },
  { size: 35, left: '70%', color: 'rgba(227,175,100,0.06)', duration: '16s', delay: '5s'   },
  { size: 18, left: '80%', color: 'rgba(87,142,126,0.07)', duration: '11s', delay: '2.5s' },
  { size: 45, left: '90%', color: 'rgba(227,175,100,0.05)', duration: '17s', delay: '4.5s' },
];

export default function SiteAmbient() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Note: previously this effect added a `fade-in` class to every section
    // and .card to drive a scroll-in animation. That created hydration
    // mismatches: this effect runs when the layout hydrates, but children
    // inside Suspense boundaries hydrate later and saw the mutated DOM. The
    // animation was removed; the scroll-driven parallax for decorative icons
    // stays since those elements are rendered by this component itself and
    // don't conflict with hydration.

    let raf = 0;
    const icons = document.querySelectorAll<HTMLElement>('.bg-icon');
    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const scrolled = window.pageYOffset;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(scrolled / max, 1) : 0;
        const scale = 0.4 + pct * 0.8;
        const rotate = scrolled * 0.03;
        icons.forEach((icon) => {
          const speed = parseFloat(icon.dataset.speed || '0.3');
          const moveY = -scrolled * speed;
          icon.style.transform = `translateY(${moveY}px) rotate(${rotate}deg) scale(${scale})`;
        });
      });
    }
    if (!reduce) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="bubbles-bg" aria-hidden>
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="bubble"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              left: b.left,
              background: b.color,
              animationDuration: b.duration,
              animationDelay: b.delay,
            }}
          />
        ))}
      </div>
      <div className="bg-icons" aria-hidden>
        {ICONS.map((it, i) => (
          <i
            key={i}
            className={`fas ${it.icon} bg-icon${it.size ? ` ${it.size}` : ''}`}
            data-speed={it.speed}
            style={{
              left: it.left,
              top: it.top,
              color: it.color,
              opacity: it.opacity,
              animationDuration: it.duration,
              animationDelay: it.delay,
            }}
          />
        ))}
      </div>
    </>
  );
}
