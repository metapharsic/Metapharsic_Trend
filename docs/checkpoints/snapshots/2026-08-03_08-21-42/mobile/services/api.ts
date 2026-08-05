import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:5555/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Helper to log mobile events to backend logs/frontend folder
async function logMobileActivity(level: string, message: string, suggestion?: string) {
  try {
    // Avoid infinite recursion by not logging the log request itself
    await axios.post(`${BASE_URL}/logs/frontend`, { level, message, suggestion }, { timeout: 3000 });
  } catch (err) {
    console.error("Local logger failed:", err);
  }
}

// Request interceptor: attach token & log activity
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const authDataStr = await SecureStore.getItemAsync("mr-tracker-mobile-auth");
    if (authDataStr) {
      const parsed = JSON.parse(authDataStr);
      const token = parsed?.state?.accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    // Log outgoing requests except the logger endpoints
    if (config.url && !config.url.includes("/logs/frontend")) {
      logMobileActivity("INFO", `[REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    }
  } catch {
    // Ignore error
  }
  return config;
});

// Response interceptor: auto refresh token & log failures/suggestions
let isRefreshing = false;
let refreshQueue: ((token: string) => void)[] = [];

api.interceptors.response.use(
  (response) => {
    if (response.config.url && !response.config.url.includes("/logs/frontend")) {
      logMobileActivity("INFO", `[RESPONSE] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Log the failure and suggest resolution steps
    if (original && !original.url?.includes("/logs/frontend")) {
      let suggestion = "Check if network is active and server is running.";
      if (error.response) {
        const status = error.response.status;
        if (status === 400) {
          suggestion = "Verify payload format and parameters against Zod validators.";
        } else if (status === 401) {
          suggestion = "Verify login credentials. If already logged in, check refresh token rotation.";
        } else if (status === 403) {
          suggestion = "Ensure current account role has sufficient authorization.";
        } else if (status === 404) {
          suggestion = "Ensure target route path or target database entry ID exists.";
        } else if (status >= 500) {
          suggestion = "Database or internal backend crash. Review backend/database.log.";
        }
      } else {
        suggestion = "Backend server unreachable. Make sure the database is active on 5432 and Next.js is running on 5555.";
      }
      
      logMobileActivity(
        "ERROR",
        `[FAILURE] ${error.config?.method?.toUpperCase()} ${error.config?.url} | Code: ${error.code} | Status: ${error.response?.status || "NO_RESPONSE"} | Msg: ${error.message}`,
        suggestion
      );
    }

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
        const authDataStr = await SecureStore.getItemAsync("mr-tracker-mobile-auth");
        if (!authDataStr) throw new Error("No auth data");

        const parsed = JSON.parse(authDataStr);
        const refreshToken = parsed?.state?.refreshToken;
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;

        parsed.state.accessToken = newToken;
        await SecureStore.setItemAsync("mr-tracker-mobile-auth", JSON.stringify(parsed));

        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        await SecureStore.deleteItemAsync("mr-tracker-mobile-auth");
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
