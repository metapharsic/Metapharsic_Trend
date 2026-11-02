import { db } from "@/lib/db";
import { Prisma, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, apiError } from "@/lib/api-response";
import { z } from "zod";
import { postAutoLedger, reverseAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";
import { computeInvoiceTotals, round2 } from "@/lib/gst";
import { CreditAgentsService } from "@/services/credit-agents.service";
import { CacheService } from "@/services/cache.service";

const EditInvoiceItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  freeQty: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().positive("Price must be greater than 0"),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  gstPct: z.coerce.number().min(0).max(100).default(0),
  batchNo: z.string().optional().nullable(),
  mfgDate: z.string().or(z.date()).optional().nullable(),
  expDate: z.string().or(z.date()).optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  packSize: z.string().optional().nullable(),
  mrp: z.coerce.number().optional().nullable(),
});

const UpdateInvoiceSchema = z.object({
  paid: z.boolean().optional(),
  invoiceNo: z.string().min(1).optional(),
  date: z.string().or(z.date()).optional(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  partyName: z.string().optional().nullable(),
  partyGstNo: z.string().optional().nullable(),
  partyAddress: z.string().optional().nullable(),
  partyDlNo: z.string().optional().nullable(),
  partyPhone: z.string().optional().nullable(),
  lrNo: z.string().optional().nullable(),
  lrDate: z.string().or(z.date()).optional().nullable(),
  cases: z.coerce.number().int().min(0).optional().nullable(),
  transport: z.string().optional().nullable(),
  vehicleNo: z.string().optional().nullable(),
  items: z.array(EditInvoiceItemSchema).optional(),
});

/**
 * GET /api/invoices/[id]
 * Retrieves invoice with order, chemist, doctor, distributor, and detailed line items.
 */
async function getInvoice(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const invoice = await db.invoice.findFirst({
      where: {
        OR: [{ id }, { orderId: id }],
      },
      include: {
        order: {
          include: {
            chemist: {
              select: {
                id: true,
                name: true,
                address: true,
                mobile: true,
                gstNo: true,
                licenseNo: true,
                territoryId: true,
                subArea: true,
                beatName: true,
                territory: { select: { id: true, name: true } },
              },
            },
            doctor: {
              select: {
                id: true,
                fullName: true,
                clinicAddress: true,
                mobile: true,
                territoryId: true,
                subArea: true,
                beatName: true,
                territory: { select: { id: true, name: true } },
              },
            },
            distributor: { select: { id: true, name: true, address: true, gstNo: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    pts: true,
                    ptr: true,
                    price: true,
                    mrp: true,
                    gstPct: true,
                    hsnCode: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) return notFound("Invoice not found");

    return ok({ invoice });
  } catch (err) {
    console.error("[GET /api/invoices/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch invoice", 500);
  }
}

/**
 * PUT /api/invoices/[id]
 * Updates invoice fields, line items, and payment status.
 * NOTE: Full invoice editing is strictly restricted to Role.ADMIN (and Role.MD).
 */
async function updateInvoice(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateInvoiceSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.invoice.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      include: {
        order: {
          include: {
            items: true,
            chemist: true,
            distributor: true,
          },
        },
      },
    });
    if (!existing) return notFound("Invoice not found");

    const isEditAction =
      parsed.data.items !== undefined ||
      parsed.data.partyName !== undefined ||
      parsed.data.partyGstNo !== undefined ||
      parsed.data.partyAddress !== undefined ||
      parsed.data.partyDlNo !== undefined ||
      parsed.data.partyPhone !== undefined ||
      parsed.data.invoiceNo !== undefined ||
      parsed.data.lrNo !== undefined ||
      parsed.data.lrDate !== undefined ||
      parsed.data.cases !== undefined ||
      parsed.data.dueDate !== undefined ||
      parsed.data.transport !== undefined ||
      parsed.data.vehicleNo !== undefined ||
      parsed.data.date !== undefined;

    const isAdmin = req.user.role === Role.ADMIN || req.user.role === Role.MD;

    // Strict RBAC security guard: ONLY Admin (and MD) have privilege to edit invoice contents/items
    if (isEditAction && !isAdmin) {
      return forbidden("Only administrators are privileged to edit invoices.");
    }

    // ─────────────────────────────────────────────────────────────
    // CASE 1: Full Admin Edit of Invoice Line Items and Metadata
    // ─────────────────────────────────────────────────────────────
    if (isEditAction) {
      if (parsed.data.invoiceNo && parsed.data.invoiceNo !== existing.invoiceNo) {
        const duplicate = await db.invoice.findFirst({
          where: { invoiceNo: parsed.data.invoiceNo, NOT: { id: existing.id } },
        });
        if (duplicate) {
          return badRequest(`Invoice number "${parsed.data.invoiceNo}" is already in use.`);
        }
      }

      const updated = await db.$transaction(async (tx) => {
        let totals: ReturnType<typeof computeInvoiceTotals> | null = null;

        if (parsed.data.items && parsed.data.items.length > 0) {
          const gstLines = parsed.data.items.map((i) => ({
            price: Number(i.price),
            quantity: i.quantity,
            discountPct: Number(i.discountPct || 0),
            gstPct: Number(i.gstPct || 0),
          }));
          totals = computeInvoiceTotals(gstLines);

          // Clear previous order items
          await tx.orderItem.deleteMany({
            where: { orderId: existing.orderId },
          });

          // Insert new line items
          await tx.orderItem.createMany({
            data: parsed.data.items.map((item) => ({
              orderId: existing.orderId,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              freeQty: item.freeQty ?? 0,
              discountPct: item.discountPct ?? 0,
              gstPct: item.gstPct ?? 0,
              batchNo: item.batchNo ?? null,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
              expDate: item.expDate ? new Date(item.expDate) : null,
              hsnCode: item.hsnCode ?? null,
              packSize: item.packSize ?? null,
              mrp: item.mrp ?? null,
            })),
          });
        }

        const updateData: Prisma.InvoiceUpdateInput = {};

        if (totals) {
          updateData.amount = totals.grandTotal;
          updateData.grandTotal = totals.grandTotal;
          updateData.totalItems = parsed.data.items!.length;
          updateData.totalQty = totals.totalQty;
          updateData.totalDiscount = totals.totalDiscount;
          updateData.totalGst = totals.totalGst;
          updateData.roundOff = totals.roundOff;
        }

        if (parsed.data.invoiceNo) updateData.invoiceNo = parsed.data.invoiceNo;
        if (parsed.data.partyName !== undefined) updateData.partyName = parsed.data.partyName;
        if (parsed.data.partyGstNo !== undefined) updateData.partyGstNo = parsed.data.partyGstNo;
        if (parsed.data.partyAddress !== undefined) updateData.partyAddress = parsed.data.partyAddress;
        if (parsed.data.partyDlNo !== undefined) updateData.partyDlNo = parsed.data.partyDlNo;
        if (parsed.data.partyPhone !== undefined) updateData.partyPhone = parsed.data.partyPhone;
        if (parsed.data.lrNo !== undefined) updateData.lrNo = parsed.data.lrNo;
        if (parsed.data.lrDate !== undefined) updateData.lrDate = parsed.data.lrDate ? new Date(parsed.data.lrDate) : null;
        if (parsed.data.cases !== undefined) updateData.cases = parsed.data.cases;
        if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
        if (parsed.data.transport !== undefined) updateData.transport = parsed.data.transport;
        if (parsed.data.vehicleNo !== undefined) updateData.vehicleNo = parsed.data.vehicleNo;
        if (parsed.data.date !== undefined && parsed.data.date) updateData.createdAt = new Date(parsed.data.date);
        if (parsed.data.paid !== undefined) updateData.paid = parsed.data.paid;

        const inv = await tx.invoice.update({
          where: { id: existing.id },
          data: updateData,
          include: {
            order: {
              include: {
                items: { include: { product: true } },
                chemist: true,
                distributor: true,
              },
            },
          },
        });

        // Re-synchronize Double-Entry General Ledger
        await reverseAutoLedger(tx, "INVOICE", existing.id);
        await reverseAutoLedger(tx, "INVOICE", `${existing.id}-payment`);

        const grandTotalNum = Number(inv.grandTotal ?? inv.amount);
        const gstNum = Number(inv.totalGst ?? 0);
        const salesNum = round2(grandTotalNum - gstNum);
        const partyTitle = inv.partyName || existing.order.chemist?.name || "Customer";

        await postAutoLedger(tx, {
          date: inv.createdAt,
          narration: `Invoice ${inv.invoiceNo} raised for ${partyTitle} (Admin Updated)`,
          sourceType: "INVOICE",
          sourceId: inv.id,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, debit: grandTotalNum, credit: 0 },
            { accountCode: SYSTEM_ACCOUNT_CODES.salesRevenue, debit: 0, credit: salesNum },
            ...(gstNum > 0 ? [{ accountCode: SYSTEM_ACCOUNT_CODES.gstPayable, debit: 0, credit: gstNum }] : []),
          ],
        });

        if (inv.paid) {
          await postAutoLedger(tx, {
            sourceType: "INVOICE",
            sourceId: `${inv.id}-payment`,
            date: new Date(),
            narration: `Payment received — Invoice ${inv.invoiceNo}`,
            lines: [
              { accountCode: SYSTEM_ACCOUNT_CODES.bank, debit: grandTotalNum },
              { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: grandTotalNum },
            ],
          });
        }

        // Reconcile FIFO Chemist Invoices Paid Status & Credit Exposure
        if (existing.order.chemistId) {
          await CreditAgentsService.reconcileChemistInvoicePaidStatus(tx, existing.order.chemistId);
        }

        return inv;
      });

      CacheService.invalidate("invoices-totals");
      return ok({ invoice: updated });
    }

    // ─────────────────────────────────────────────────────────────
    // CASE 2: Legacy Payment Status Toggle (paid: true / false)
    // ─────────────────────────────────────────────────────────────
    const newPaidStatus = parsed.data.paid ?? existing.paid;
    const shouldPost = newPaidStatus && !existing.paid;
    const shouldReverse = !newPaidStatus && existing.paid;

    const updated = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: existing.id },
        data: { paid: newPaidStatus },
      });

      if (shouldPost) {
        await postAutoLedger(tx, {
          sourceType: "INVOICE",
          sourceId: `${existing.id}-payment`,
          date: new Date(),
          narration: `Payment received — Invoice ${inv.invoiceNo}`,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.bank, debit: Number(inv.grandTotal ?? inv.amount) },
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: Number(inv.grandTotal ?? inv.amount) },
          ],
        });
      } else if (shouldReverse) {
        await reverseAutoLedger(tx, "INVOICE", `${existing.id}-payment`);
      }

      if (existing.order.chemistId) {
        await CreditAgentsService.reconcileChemistInvoicePaidStatus(tx, existing.order.chemistId);
      }

      return inv;
    });

    CacheService.invalidate("invoices-totals");
    return ok({ invoice: updated });
  } catch (err) {
    console.error("[PUT /api/invoices/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update invoice", 500);
  }
}

/**
 * DELETE /api/invoices/[id]
 * Deletes invoice and purges associated ledger postings.
 */
async function deleteInvoice(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const existing = await db.invoice.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
      include: { order: true },
    });
    if (!existing) return notFound("Invoice not found");

    if (req.user.role === Role.MR) {
      return forbidden("Representatives (MR) are not authorized to delete invoices. Statutory tax records require administrator authorization.");
    }

    await db.$transaction(async (tx) => {
      // Clear ledger postings associated with this invoice (sale & payment)
      await reverseAutoLedger(tx, "INVOICE", existing.id);
      if (existing.paid) {
        await reverseAutoLedger(tx, "INVOICE", `${existing.id}-payment`);
      }

      await tx.invoice.delete({ where: { id: existing.id } });

      if (existing.order.chemistId) {
        await CreditAgentsService.reconcileChemistInvoicePaidStatus(tx, existing.order.chemistId);
      }
    });

    CacheService.invalidate("invoices-totals");
    return ok({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/invoices/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete invoice", 500);
  }
}

export const GET = withAuth(getInvoice, [Role.ADMIN, Role.MD, Role.ASM, Role.MR, Role.FINANCE]);
export const PUT = withAuth(updateInvoice, [Role.ADMIN, Role.MD, Role.ASM]);
export const DELETE = withAuth(deleteInvoice, [Role.ADMIN, Role.MD, Role.ASM]);
