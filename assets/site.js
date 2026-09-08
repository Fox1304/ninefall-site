// Site chrome: Day/Night, reveal-on-scroll, and the live Daily Flip number.

// ---- Day / Night -----------------------------------------------------------
// The app ships Day and Night themes; the site follows the system by default
// and remembers an explicit choice.
const root = document.documentElement;
try {
  const saved = localStorage.getItem('ninefall-theme');
  if (saved === 'day' || saved === 'night') root.dataset.theme = saved;
} catch { /* private browsing: fall back to the system theme */ }

export function initTheme() {
  const box = document.querySelector('.theme-switch');
  if (!box) return;
  const sync = () => {
    const explicit = root.dataset.theme;
    const dark = explicit ? explicit === 'night'
                          : matchMedia('(prefers-color-scheme: dark)').matches;
    box.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.theme === (dark ? 'night' : 'day'))));
  };
  box.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme]')?.dataset.theme;
    if (!t) return;
    root.dataset.theme = t;
    try { localStorage.setItem('ninefall-theme', t); } catch { /* no-op */ }
    sync();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
  sync();
}

// ---- reveal on scroll ------------------------------------------------------
export function initReveal() {
  const els = document.querySelectorAll('.rv');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  els.forEach((el) => io.observe(el));
}

// ---- sticky nav hairline ---------------------------------------------------
export function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---- the Daily Flip number -------------------------------------------------
// Day 1 = 2026-01-01 UTC, matching Daily.dayNumber in NinefallCore. The board
// itself is generated on device; only the number is worth computing here.
export function dailyNumber(now = new Date()) {
  const epoch = Date.UTC(2026, 0, 1);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - epoch) / 86400000) + 1;
}

export function initDaily() {
  const n = document.querySelector('[data-daily-number]');
  const d = document.querySelector('[data-daily-date]');
  if (n) n.textContent = `#${dailyNumber()}`;
  if (d) d.textContent = new Date().toLocaleDateString(
    document.documentElement.lang || 'en', { month: 'long', day: 'numeric' });
}

// ---- videos: play only while visible, never under reduced motion -----------
export function initVideos() {
  const vids = document.querySelectorAll('video');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    vids.forEach((v) => { v.removeAttribute('autoplay'); v.controls = true; v.pause(); });
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.play?.().catch(() => {});
      else e.target.pause?.();
    });
  }, { threshold: 0.25 });
  vids.forEach((v) => io.observe(v));
}

export function initAll() {
  initTheme(); initReveal(); initNav(); initDaily(); initVideos();
}
