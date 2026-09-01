import { api } from "./api";
import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "@/types";

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const AUTH_STORAGE_KEY = "mr-tracker-mobile-auth";
const DEVICE_UUID_KEY = "mr-tracker-device-uuid";

export const authService = {
  // Get or initialize persistent Device UUID for hardware binding
  getDeviceUuid: async (): Promise<string> => {
    try {
      let uuid = await SecureStore.getItemAsync(DEVICE_UUID_KEY);
      if (!uuid) {
        uuid = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await SecureStore.setItemAsync(DEVICE_UUID_KEY, uuid);
      }
      return uuid;
    } catch {
      return "device_fallback_default";
    }
  },

  loginMR: async (email: string, password: string, deviceUuid?: string): Promise<LoginResponse> => {
    const activeDeviceUuid = deviceUuid || (await authService.getDeviceUuid());
    const res = await api.post("/auth/login/mr", { email, password, deviceUuid: activeDeviceUuid });
    const data: LoginResponse = res.data.data;

    // Persist session to secure store
    await authService.saveSession(data);
    return data;
  },

  saveSession: async (session: LoginResponse): Promise<void> => {
    try {
      const payload = {
        state: {
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        },
      };
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("Failed to persist session securely", err);
    }
  },

  getSession: async (): Promise<LoginResponse | null> => {
    try {
      const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state ?? null;
    } catch {
      return null;
    }
  },

  logout: async (): Promise<void> => {
    try {
      const session = await authService.getSession();
      if (session?.refreshToken) {
        await api.post("/auth/logout", { refreshToken: session.refreshToken }).catch(() => {});
      }
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
    } catch (err) {
      console.warn("Error during logout cleanup", err);
    }
  },
};
