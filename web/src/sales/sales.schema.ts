import { z } from "zod";
import { OrderStatus } from "@prisma/client";

export const CreateSalesOrderItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  price: z.coerce.number().min(0).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  freeQty: z.coerce.number().int().min(0).optional().default(0),
  batchNo: z.string().optional(),
  mfgDate: z.coerce.date().optional(),
  expDate: z.coerce.date().optional(),
  hsnCode: z.string().optional(),
  gstPct: z.coerce.number().min(0).max(100).optional(),
  packSize: z.string().optional(),
  mrp: z.coerce.number().min(0).optional(),
});

export const CreateSalesOrderSchema = z.object({
  chemistId: z.string().nullable().optional(),
  doctorId: z.string().nullable().optional(),
  distributorId: z.string().min(1, "Distributor ID is required"),
  items: z.array(CreateSalesOrderItemSchema).min(1, "At least one line item is required"),
  applyBestScheme: z.boolean().optional().default(true),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  reason: z.string().optional(),
});

export const RecordCollectionSchema = z.object({
  chemistId: z.string().min(1, "Chemist ID is required"),
  amount: z.coerce.number().positive("Collection amount must be positive"),
  refNumber: z.string().optional(),
});

export const GenerateInvoiceSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  lrNo: z.string().optional(),
  lrDate: z.coerce.date().optional(),
  cases: z.coerce.number().int().min(0).optional(),
  dueDate: z.coerce.date().optional(),
  transport: z.string().optional(),
  vehicleNo: z.string().optional(),
});

export const SalesOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  chemistId: z.string().optional(),
  distributorId: z.string().optional(),
  employeeId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateSalesOrderItemInput = z.infer<typeof CreateSalesOrderItemSchema>;
export type CreateSalesOrderInput = z.infer<typeof CreateSalesOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type RecordCollectionInput = z.infer<typeof RecordCollectionSchema>;
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;
export type SalesOrderQueryInput = z.infer<typeof SalesOrderQuerySchema>;
