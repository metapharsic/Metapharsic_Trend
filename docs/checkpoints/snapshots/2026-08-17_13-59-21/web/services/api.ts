/**
 * services/api.ts
 * Axios instance with JWT auth headers and automatic token refresh.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ── Request interceptor: attach access token ────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Read from localStorage (client-side only)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("mr-tracker-auth");
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

// ── Response interceptor: handle 401 with token refresh ─────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const stored = localStorage.getItem("mr-tracker-auth");
        const refreshToken = stored ? JSON.parse(stored).state?.refreshToken : null;
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;

        // Persist new token
        const parsed = JSON.parse(stored!);
        parsed.state.accessToken = newToken;
        localStorage.setItem("mr-tracker-auth", JSON.stringify(parsed));

        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh failed — clear auth and redirect to login
        localStorage.removeItem("mr-tracker-auth");
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
