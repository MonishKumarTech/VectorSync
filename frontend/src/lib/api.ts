const isBrowser = typeof window !== 'undefined';
const isLocalhost =
  isBrowser &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  (isLocalhost ? 'http://127.0.0.1:8000' : 'https://vectorsync.onrender.com')
).replace(/\/+$/, '');