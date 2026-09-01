import { api } from "./api";
import { storageService } from "./storage.service";

export interface SubmitVisitPayload {
  doctorId?: string;
  chemistId?: string;
  hospitalId?: string;
  purpose: string;
  feedback?: string;
  latitude: number;
  longitude: number;
  durationMinutes?: number;
  boxesPlaced?: number;
  samples?: { productId: string; quantity: number }[];
  photoUri?: string;
}

export interface VisitResponse {
  visitId: string;
  success: boolean;
}

export const visitService = {
  // Fetch today's visits list
  getVisits: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get("/mr/visits", { params });
    return res.data.data;
  },

  // Submit a DCR call (with online/offline handling)
  submitVisit: async (payload: SubmitVisitPayload): Promise<VisitResponse> => {
    try {
      const formData = new FormData();
      if (payload.doctorId) formData.append("doctorId", payload.doctorId);
      if (payload.chemistId) formData.append("chemistId", payload.chemistId);
      if (payload.hospitalId) formData.append("hospitalId", payload.hospitalId);
      formData.append("purpose", payload.purpose);
      if (payload.feedback) formData.append("feedback", payload.feedback);
      formData.append("latitude", String(payload.latitude));
      formData.append("longitude", String(payload.longitude));
      if (payload.durationMinutes !== undefined) {
        formData.append("durationMinutes", String(payload.durationMinutes));
      }
      if (payload.boxesPlaced !== undefined) {
        formData.append("boxesPlaced", String(payload.boxesPlaced));
      }
      if (payload.samples && payload.samples.length > 0) {
        formData.append("samples", JSON.stringify(payload.samples));
      }

      if (payload.photoUri) {
        formData.append("photo", {
          uri: payload.photoUri,
          name: `visit_${Date.now()}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }

      const res = await api.post("/mr/visits", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data;
    } catch (err) {
      // If network fails, queue visit locally for background sync
      const queuedId = `offline_visit_${Date.now()}`;
      await storageService.enqueueVisit({
        id: queuedId,
        queuedAt: new Date().toISOString(),
        payload: {
          doctorId: payload.doctorId,
          chemistId: payload.chemistId,
          hospitalId: payload.hospitalId,
          purpose: payload.purpose,
          feedback: payload.feedback,
          latitude: payload.latitude,
          longitude: payload.longitude,
          durationMinutes: payload.durationMinutes,
          samples: payload.samples,
        },
      });

      return {
        visitId: queuedId,
        success: true,
      };
    }
  },

  // Flush queued visits when connectivity returns
  flushOfflineVisits: async (): Promise<number> => {
    const queue = await storageService.getQueuedVisits();
    if (queue.length === 0) return 0;

    let synced = 0;
    for (const item of queue) {
      try {
        const formData = new FormData();
        if (item.payload.doctorId) formData.append("doctorId", item.payload.doctorId);
        if (item.payload.chemistId) formData.append("chemistId", item.payload.chemistId);
        if (item.payload.hospitalId) formData.append("hospitalId", item.payload.hospitalId);
        formData.append("purpose", item.payload.purpose);
        if (item.payload.feedback) formData.append("feedback", item.payload.feedback);
        formData.append("latitude", String(item.payload.latitude));
        formData.append("longitude", String(item.payload.longitude));
        if (item.payload.durationMinutes !== undefined) {
          formData.append("durationMinutes", String(item.payload.durationMinutes));
        }
        if (item.payload.samples) {
          formData.append("samples", JSON.stringify(item.payload.samples));
        }

        await api.post("/mr/visits", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        synced++;
      } catch {
        // Stop sync on persistent failure
        break;
      }
    }

    if (synced === queue.length) {
      await storageService.clearQueuedVisits();
    }
    return synced;
  },
};
