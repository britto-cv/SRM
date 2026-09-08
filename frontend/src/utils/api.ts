/**
 * Utility for making API requests.
 * Hardcoded to the Render URL for easy drag-and-drop deployments.
 */

const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://srm-njvt.onrender.com');

export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, options);
}
