import { api } from "./api";

export interface AttendanceResponse {
  attendance: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    latitude?: number;
    longitude?: number;
    status: string;
  };
  success: boolean;
}

export const attendanceService = {
  checkIn: async (latitude: number = 0, longitude: number = 0, faceToken?: string): Promise<AttendanceResponse> => {
    const res = await api.post("/mr/attendance/check-in", { latitude, longitude, faceToken });
    return res.data.data;
  },

  checkOut: async (latitude: number = 0, longitude: number = 0): Promise<AttendanceResponse> => {
    const res = await api.post("/mr/attendance/check-out", { latitude, longitude });
    return res.data.data;
  },

  getTodayStatus: async (): Promise<{ checkedIn: boolean; checkedOut: boolean; checkInTime?: string; checkOutTime?: string }> => {
    try {
      const res = await api.get("/mr/attendance/today");
      return res.data.data;
    } catch {
      return { checkedIn: false, checkedOut: false };
    }
  },
};
