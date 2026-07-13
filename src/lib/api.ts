/* eslint-disable @typescript-eslint/no-explicit-any */
import { message } from 'antd';

const API_URL = import.meta.env.VITE_API_URL_SERVER;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function clearSession() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('departement_id');
  localStorage.removeItem('user_id');
}

/**
 * Fetch authentifié : ajoute le token, gère la session expirée (401) et
 * uniformise les erreurs. Reproduit l'enveloppe de réponse existante
 * ({ success, data, message }) sans la déballer, pour rester compatible
 * avec les appelants actuels.
 */
export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearSession();
    message.error('Session expirée, veuillez vous reconnecter');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expirée, veuillez vous reconnecter');
  }

  if (!response.ok) {
    let msg = `Erreur ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      msg = data.message || msg;
    } catch {
      // réponse non JSON : on garde le message par défaut
    }
    throw new ApiError(response.status, msg);
  }

  return response.json();
}
