// --------------------------------------------------------------------------
// API Fetch wrapper for all REST calls.
// Base URL is relative ("/api") so it goes through the nginx proxy.
// --------------------------------------------------------------------------

const BASE_URL = "/api";

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const WORKSPACE_KEY = "workspace_id";

// ── Token helpers ──────────────────────────────────────────────────────────

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

// ── Workspace helpers ──────────────────────────────────────────────────────

export function setWorkspaceId(id: string): void {
  localStorage.setItem(WORKSPACE_KEY, id);
}

export function getWorkspaceId(): string | null {
  return localStorage.getItem(WORKSPACE_KEY);
}

// ── Refresh logic ──────────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to get a new access token using the stored refresh token.
 * Uses a singleton promise so concurrent 401s only trigger one refresh.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      const newAccess: string = data.accessToken;
      const newRefresh: string = data.refreshToken ?? refreshToken;
      setTokens(newAccess, newRefresh);
      return newAccess;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Generic fetch ──────────────────────────────────────────────────────────

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Skip the automatic Authorization header (e.g. for login/signup). */
  noAuth?: boolean;
}

/**
 * Fetch wrapper that automatically adds auth & workspace headers,
 * handles 401 auto-refresh, and returns typed JSON.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { headers: extraHeaders = {}, noAuth, ...rest } = options;

  const buildHeaders = (token: string | null): Record<string, string> => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };

    if (token && !noAuth) {
      h["Authorization"] = `Bearer ${token}`;
    }

    const wsId = getWorkspaceId();
    if (wsId) {
      h["x-workspace-id"] = wsId;
    }

    return h;
  };

  let token = getAccessToken();
  let res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders(token),
  });

  // Auto-refresh on 401
  if (res.status === 401 && !noAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      token = newToken;
      res = await fetch(`${BASE_URL}${path}`, {
        ...rest,
        headers: buildHeaders(token),
      });
    } else {
      // Refresh failed — force logout
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  // Non-2xx after possible refresh
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as Record<string, unknown>)?.message ?? res.statusText;
    throw new ApiError(res.status, String(message));
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

// ── Error class ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
