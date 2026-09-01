import { z } from "zod";

const emptyToNull = (val: unknown) => (val === "" || val === null || val === undefined ? null : val);

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  composition: z.preprocess(emptyToNull, z.string().nullable().optional()),
  strength: z.preprocess(emptyToNull, z.string().nullable().optional()),
  packSize: z.preprocess(emptyToNull, z.string().nullable().optional()),
  mrp: z.coerce.number().min(0).optional(),
  ptr: z.coerce.number().min(0).optional(),
  pts: z.coerce.number().min(0).optional(),
  marginStructure: z.preprocess(emptyToNull, z.string().nullable().optional()),
  therapySegment: z.preprocess(emptyToNull, z.string().nullable().optional()),
  hsnCode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  manufacturer: z.preprocess(emptyToNull, z.string().nullable().optional()),
  gstPct: z.coerce.number().min(0).max(100).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).optional().default(0),
  currentBatchNo: z.preprocess(emptyToNull, z.string().nullable().optional()),
  currentMfgDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  currentExpDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  composition: z.preprocess(emptyToNull, z.string().nullable().optional()),
  strength: z.preprocess(emptyToNull, z.string().nullable().optional()),
  packSize: z.preprocess(emptyToNull, z.string().nullable().optional()),
  mrp: z.coerce.number().min(0).optional(),
  ptr: z.coerce.number().min(0).optional(),
  pts: z.coerce.number().min(0).optional(),
  marginStructure: z.preprocess(emptyToNull, z.string().nullable().optional()),
  therapySegment: z.preprocess(emptyToNull, z.string().nullable().optional()),
  hsnCode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  manufacturer: z.preprocess(emptyToNull, z.string().nullable().optional()),
  gstPct: z.coerce.number().min(0).max(100).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).optional(),
  currentBatchNo: z.preprocess(emptyToNull, z.string().nullable().optional()),
  currentMfgDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  currentExpDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
});

export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  therapySegment: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;
