/**
 * Application Configuration & API Base URL
 * Reads VITE_API_BASE_URL if configured for remote deployments (e.g. Render backend on Vercel frontend),
 * or defaults to empty string to leverage the local Vite proxy.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiUrl = (endpoint) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};

export default {
  API_BASE_URL,
  apiUrl,
};
