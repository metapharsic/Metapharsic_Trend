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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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

    if (error?.response?.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

