const API_BASE = '';

let sessionToken = null;

export function setToken(token) {
  sessionToken = token;
}

export function getToken() {
  return sessionToken;
}

export function clearToken() {
  sessionToken = null;
}

export async function requestJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || 'Request failed.');
  }

  return data;
}
