function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured.replace(/\/$/, "");
    }
    if (typeof window !== "undefined") {
      const path = configured.startsWith("/") ? configured : `/${configured}`;
      return `${window.location.origin}${path}`.replace(/\/$/, "");
    }
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "/api";
}

export const API_BASE = resolveApiBase();
const TOKEN_KEY = "alshaib_auth_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("alshaib-auth-change"));
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; params?: Record<string, string | number | boolean | undefined> };

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const base = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  const rel = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(rel, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message ?? data?.title ?? `HTTP ${res.status}`;
    if (res.status === 401 && typeof window !== "undefined") {
      setToken(null);
    }
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    apiRequest<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  delete: (path: string) => apiRequest<void>(path, { method: "DELETE" }),
};
