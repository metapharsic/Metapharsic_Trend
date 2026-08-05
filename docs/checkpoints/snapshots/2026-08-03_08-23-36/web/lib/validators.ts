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
  hospitalId: z.string().uuid("Valid hospital ID required").optional(),
  purpose: z.string().min(1, "Purpose is required"),
  feedback: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
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

// ─── Tour Plan ───────────────────────────────────────────────

export const SubmitTourPlanSchema = z.object({
  month: z.coerce.date(),
  days: z.array(
    z.object({
      date: z.coerce.date(),
      territoryId: z.string().uuid(),
      plannedDoctorId: z.string().uuid().optional(),
    })
  ).min(1, "At least one planned day is required"),
});

export const TourPlanDecisionSchema = z.object({
  tourPlanId: z.string().uuid(),
});

// ─── Orders ──────────────────────────────────────────────────

export const CreateOrderSchema = z.object({
  chemistId: z.string().uuid(),
  distributorId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ).min(1, "At least one item is required"),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

// ─── Expense Claims ──────────────────────────────────────────

export const ExpenseClaimSchema = z.object({
  amount: z.coerce.number().min(0.01),
  category: z.string().min(1),
  description: z.string().optional(),
});

export const ExpenseReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  auditNotes: z.string().optional(),
});
