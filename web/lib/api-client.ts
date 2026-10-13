import axios from "axios";
import { systemHealth } from "./system-health";

export const apiClient = axios.create();

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Record comprehensive diagnostic forensic information into systemHealth
    if (typeof window !== "undefined") {
      const url = error?.config?.url || "Unknown API";
      const method = error?.config?.method || "GET";
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      const data = error?.response?.data;
      const errorMsg =
        data?.error?.message ||
        data?.message ||
        error?.message ||
        "Request failed";

      systemHealth.recordError({
        url,
        method,
        status,
        statusText,
        errorMessage: errorMsg,
        errorDetails: data?.error?.details || data || error?.stack,
        requestPayload: error?.config?.data ? (typeof error.config.data === "string" ? error.config.data.slice(0, 500) : error.config.data) : undefined,
      });
    }

    if (
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers = originalRequest.headers ?? {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const res = await axios.post("/api/auth/refresh", { refreshToken });
          const newAccessToken = res.data?.data?.accessToken;
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken);
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            processQueue(null, newAccessToken);
            return apiClient(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      } else {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

