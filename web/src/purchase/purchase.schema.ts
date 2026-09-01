import { z } from "zod";
import { TenderStatus } from "@prisma/client";

export const CreatePurchaseOrderSchema = z.object({
  supplierName: z.string().min(1, "Supplier/Manufacturer name is required"),
  invoiceNumber: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, "Product ID is required"),
      quantity: z.coerce.number().int().positive("Quantity must be positive"),
      unitPurchasePrice: z.coerce.number().min(0, "Purchase price must be positive"),
      batchNo: z.string().min(1, "Batch number is required"),
      mfgDate: z.coerce.date(),
      expDate: z.coerce.date(),
      gstPct: z.coerce.number().min(0).max(100).optional().default(12),
      hsnCode: z.string().optional(),
    })
  ).min(1, "At least one item is required in purchase order"),
  note: z.string().optional(),
});

export const InwardStockReceiptSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Inward quantity must be positive"),
  unitCost: z.coerce.number().min(0).optional(),
  batchNo: z.string().min(1, "Batch number is required"),
  mfgDate: z.coerce.date(),
  expDate: z.coerce.date(),
  supplierName: z.string().optional(),
  grnNumber: z.string().optional(),
  note: z.string().optional(),
});

export const CreateHospitalTenderSchema = z.object({
  hospitalId: z.string().min(1, "Hospital ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  tenderNo: z.string().min(1, "Tender number is required"),
  contractRate: z.coerce.number().min(0, "Contract rate must be non-negative"),
  quantity: z.coerce.number().int().min(0).optional().default(0),
  status: z.nativeEnum(TenderStatus).optional().default(TenderStatus.DRAFT),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
});

export const UpdateTenderStatusSchema = z.object({
  status: z.nativeEnum(TenderStatus),
});

export const CreateHospitalFormularySchema = z.object({
  hospitalId: z.string().min(1, "Hospital ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  included: z.boolean().default(true),
  notes: z.string().optional(),
});

export const CreateDiscountSchemeSchema = z.object({
  name: z.string().min(1, "Scheme name is required"),
  productId: z.string().nullable().optional(),
  minQuantity: z.coerce.number().int().min(1).default(1),
  discountPct: z.coerce.number().min(0).max(100).default(0.0),
  isActive: z.boolean().default(true),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
});

export const PurchaseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hospitalId: z.string().optional(),
  productId: z.string().optional(),
  status: z.nativeEnum(TenderStatus).optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type InwardStockReceiptInput = z.infer<typeof InwardStockReceiptSchema>;
export type CreateHospitalTenderInput = z.infer<typeof CreateHospitalTenderSchema>;
export type UpdateTenderStatusInput = z.infer<typeof UpdateTenderStatusSchema>;
export type CreateHospitalFormularyInput = z.infer<typeof CreateHospitalFormularySchema>;
export type CreateDiscountSchemeInput = z.infer<typeof CreateDiscountSchemeSchema>;
export type PurchaseQueryInput = z.infer<typeof PurchaseQuerySchema>;
