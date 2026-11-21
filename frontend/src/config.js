/**
 * Application Configuration & Hardcode-Safe API Base URL
 * Reads VITE_API_BASE_URL if explicitly configured and sanitizes it against quotes,
 * whitespace, trailing slashes, and Markdown brackets [url](url).
 * When running locally (localhost / 127.0.0.1), defaults to '' to use the Vite dev proxy.
 * In production (e.g. Vercel at smart-ed-studio.vercel.app), resolves cleanly to
 * https://smarted-studio.onrender.com to bypass Vercel's 4.5 MB serverless proxy payload limit.
 */
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const rawEnv = (import.meta.env.VITE_API_BASE_URL || '').trim();
const match = rawEnv.match(/https?:\/\/[^\s)\]]+/);

export const API_BASE_URL = isLocal ? '' : (match ? match[0] : 'https://smarted-studio.onrender.com').replace(/\/$/, '');

export const apiUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|\/\/|data:|blob:)/.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
};

export default {
  API_BASE_URL,
  apiUrl,
};
