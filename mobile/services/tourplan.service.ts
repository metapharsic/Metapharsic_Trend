import { api } from "./api";

export interface TourPlanDay {
  id: string;
  date: string;
  territoryId: string;
  plannedDoctorId?: string | null;
  plannedDoctor?: {
    id: string;
    fullName: string;
    primarySpecialty: string;
    clinicAddress: string;
    latitude: number;
    longitude: number;
  } | null;
  activityType?: string;
  notes?: string | null;
}

export const tourPlanService = {
  // Fetch current month's approved tour plan
  getCurrentTourPlan: async () => {
    const res = await api.get("/sfa/tour-plan/current");
    return res.data.data?.tourPlan ?? null;
  },

  // Fetch AI-optimized route plan for today's visits
  getRoutePlan: async (params?: { latitude?: number; longitude?: number; startAt?: string }) => {
    const res = await api.get("/sfa/route-plan", { params });
    return res.data.data;
  },

  // Submit tour plan for approval
  submitTourPlan: async (month: string, days: Array<{ date: string; territoryId: string; plannedDoctorId?: string }>) => {
    const res = await api.post("/sfa/tour-plan/submit", { month, days });
    return res.data.data;
  },
};
