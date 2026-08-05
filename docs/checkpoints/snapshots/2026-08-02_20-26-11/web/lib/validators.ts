import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────

export const MRLoginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  deviceUuid: z.string().min(1, "Device UUID is required"),
});

export const ManagerLoginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token required"),
});

// ─── Visits ──────────────────────────────────────────────────

export const CreateVisitSchema = z.object({
  doctorId: z.string().uuid("Valid doctor ID required").optional(),
  chemistId: z.string().uuid("Valid chemist ID required").optional(),
  purpose: z.string().min(1, "Purpose is required"),
  feedback: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  samples: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
  gifts: z.array(z.object({
    giftCatalogId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
  competitorLogs: z.array(z.object({
    brandName: z.string(),
    activityIntensity: z.string(),
    notes: z.string().optional(),
  })).optional(),
});

// ─── Pagination ──────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
