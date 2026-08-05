import { api } from "./api";
import type { AuthUser } from "@/types";

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  loginMR: async (email: string, password: string, deviceUuid: string): Promise<LoginResponse> => {
    const res = await api.post("/auth/login/mr", { email, password, deviceUuid });
    return res.data.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/auth/logout", { refreshToken });
  },
};
