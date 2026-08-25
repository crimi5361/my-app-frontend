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
/**
 * Délai au-delà duquel on cesse d'attendre le serveur.
 *
 * MESURÉ : une question à l'assistante prend 11 à 28 secondes selon qu'elle
 * enchaîne une ou trois requêtes SQL. À quoi peuvent s'ajouter deux reprises du
 * modèle sur surcharge (1 s + 2 s) et une bascule de repli. 45 s couvre donc
 * largement le cas lent tout en bornant l'attente : au-delà, ce n'est plus une
 * réponse qui tarde, c'est une réponse qui ne viendra pas.
 *
 * Sans cette borne, `fetch` attend indéfiniment : l'écran restait sur son
 * indicateur de frappe, sans rien annoncer, et le fondateur ne savait pas s'il
 * devait patienter ou reposer sa question.
 */
const DELAI_MAX_MS = 45000;

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  // Un `signal` fourni par l'appelant reste prioritaire : on ne lui impose pas
  // notre borne s'il gère déjà son propre cycle de vie.
  const arret = options.signal ? null : new AbortController();
  const minuteur = arret ? setTimeout(() => arret.abort(), DELAI_MAX_MS) : null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options.signal ?? arret?.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError' && arret?.signal.aborted) {
      throw new ApiError(408, `Le serveur n'a pas répondu en ${DELAI_MAX_MS / 1000} secondes. `
        + 'Reposez votre question — si cela se reproduit, le service est probablement indisponible.');
    }
    throw e;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }

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
