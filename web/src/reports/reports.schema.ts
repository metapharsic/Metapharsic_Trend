import { z } from "zod";

export const ReportTimeframeSchema = z.enum([
  "today",
  "daily",
  "this_month",
  "last_month",
  "weekly",
  "monthly",
  "qtd",
  "ytd",
  "all",
  "custom",
]);

export const BiReportQuerySchema = z.object({
  report: z.string().optional(),
  timeframe: ReportTimeframeSchema.optional().default("this_month"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  territoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const MultiAgentReportQuerySchema = z.object({
  employeeId: z.string().optional(),
  period: ReportTimeframeSchema.optional().default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeDoctorVisits: z.coerce.boolean().optional().default(true),
});

export const WhatsAppDispatchSchema = z.object({
  targetType: z.enum(["SINGLE_MR", "ALL_MRS_INDIVIDUALLY", "ADMIN_SUMMARY"]),
  employeeId: z.string().optional(),
  period: ReportTimeframeSchema.optional().default("daily"),
  includeDoctorVisits: z.boolean().optional().default(true),
});

export type ReportTimeframe = z.infer<typeof ReportTimeframeSchema>;
export type BiReportQueryInput = z.infer<typeof BiReportQuerySchema>;
export type MultiAgentReportQueryInput = z.infer<typeof MultiAgentReportQuerySchema>;
export type WhatsAppDispatchInput = z.infer<typeof WhatsAppDispatchSchema>;
