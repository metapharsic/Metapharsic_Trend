import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum([
    "MD", "NSM", "ZSM", "RM", "ASM", "MR",
    "DISTRIBUTOR", "DOCTOR", "HR", "FINANCE",
    "WAREHOUSE", "MARKETING", "ADMIN"
  ]),
  deviceUuid: z.string().optional(),
});

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

export const UpdateVisitSchema = z.object({
  purpose: z.string().min(1, "Purpose is required").optional(),
  feedback: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
  boxesPlaced: z.coerce.number().int().min(0).optional(),
});

export const CreateVisitSchema = z.object({
  doctorId: z.string().uuid("Valid doctor ID required").optional(),
  chemistId: z.string().uuid("Valid chemist ID required").optional(),
  hospitalId: z.string().uuid("Valid hospital ID required").optional(),
  purpose: z.string().min(1, "Purpose is required"),
  feedback: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
  boxesPlaced: z.coerce.number().int().min(0).optional(),
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
  lead: z.object({
    status: z.enum(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"]).default("NEW"),
    details: z.string().optional(),
    followUpAction: z.string().optional(),
    followUpDate: z.coerce.date().optional(),
  }).optional(),
});

// ─── Leads ───────────────────────────────────────────────────

export const UpdateLeadSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"]).optional(),
  details: z.string().optional(),
  followUpAction: z.string().optional(),
  followUpDate: z.coerce.date().nullable().optional(),
});

// ─── Collections ─────────────────────────────────────────────

export const UpdateCollectionSchema = z.object({
  amount: z.coerce.number().min(0.01).optional(),
  refNumber: z.string().optional(),
});

// ─── Entity Ledger (financials) ─────────────────────────────────

export const CreateLedgerSchema = z.object({
  doctorId: z.string().uuid().optional(),
  chemistId: z.string().uuid().optional(),
  salesRevenue: z.coerce.number().min(0).optional(),
  creditGiven: z.coerce.number().min(0).optional(),
  amountCollected: z.coerce.number().min(0).optional(),
  outstandingCredit: z.coerce.number().min(0).optional(),
  promotionType: z.enum(["CASH", "GIFT"]).optional(),
  promotionValue: z.coerce.number().min(0).optional(),
  netRealizedProfit: z.coerce.number().optional(),
  potentialProfit: z.coerce.number().optional(),
});

export const UpdateLedgerSchema = CreateLedgerSchema.omit({ doctorId: true, chemistId: true });

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
      // GST invoice line detail — optional so a minimal booking still works,
      // but required in practice to produce a compliant tax invoice.
      batchNo: z.string().optional(),
      mfgDate: z.coerce.date().optional(),
      expDate: z.coerce.date().optional(),
      freeQty: z.number().int().min(0).optional(),
      discountPct: z.number().min(0).max(100).optional(),
      gstPct: z.number().min(0).max(100).optional(),
    })
  ).min(1, "At least one item is required"),
  lrNo: z.string().optional(),
  lrDate: z.coerce.date().optional(),
  cases: z.number().int().min(0).optional(),
  dueDate: z.coerce.date().optional(),
  transport: z.string().optional(),
  vehicleNo: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export const UpdateOrderItemsSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
      batchNo: z.string().optional(),
      mfgDate: z.coerce.date().optional(),
      expDate: z.coerce.date().optional(),
      freeQty: z.number().int().min(0).optional(),
      discountPct: z.number().min(0).max(100).optional(),
      gstPct: z.number().min(0).max(100).optional(),
    })
  ).min(1, "At least one item is required"),
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

export const UpdateExpenseSchema = z.object({
  amount: z.coerce.number().min(0.01).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
});
