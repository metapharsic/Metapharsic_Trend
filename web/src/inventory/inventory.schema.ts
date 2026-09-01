import { z } from "zod";
import { InventoryMovementType } from "@prisma/client";

export const StockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  type: z.nativeEnum(InventoryMovementType),
  delta: z.coerce.number().int().refine((val) => val !== 0, {
    message: "Delta must not be zero",
  }),
  note: z.string().optional(),
});

export const RestockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Restock quantity must be positive"),
  batchNo: z.string().optional(),
  mfgDate: z.coerce.date().optional(),
  expDate: z.coerce.date().optional(),
  note: z.string().optional(),
});

export const SampleAllocationSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Allocation quantity must be positive"),
});

export const BatchSampleAllocationSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  allocations: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
    })
  ).min(1, "At least one sample allocation required"),
});

export const InventoryMovementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().optional(),
  type: z.nativeEnum(InventoryMovementType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
export type RestockInput = z.infer<typeof RestockSchema>;
export type SampleAllocationInput = z.infer<typeof SampleAllocationSchema>;
export type BatchSampleAllocationInput = z.infer<typeof BatchSampleAllocationSchema>;
export type InventoryMovementQueryInput = z.infer<typeof InventoryMovementQuerySchema>;
