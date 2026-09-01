import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export type LedgerLine = { accountCode: string; debit?: number; credit?: number };

export function assertBalanced(lines: LedgerLine[]) {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Ledger entry unbalanced: debit ${totalDebit} != credit ${totalCredit}`);
  }
}

export const SYSTEM_ACCOUNT_CODES = {
  // ─── Assets (1000 - 1999) ───────────────────────────────────
  cash: "1001",
  bank: "1002",
  pettyCash: "1003",
  accountsReceivable: "1100",
  allowanceDoubtfulAccounts: "1150",
  inventory: "1200",
  sampleInventory: "1250",
  inputCgst: "1301",
  inputSgst: "1302",
  inputIgst: "1303",
  prepaidExpenses: "1400",
  fixedAssets: "1500",
  accumulatedDepreciation: "1550",

  // ─── Liabilities (2000 - 2999) ──────────────────────────────
  accountsPayable: "2001",
  accruedExpenses: "2002",
  gstPayable: "2100", // Master Output GST Payable
  outputCgst: "2101",
  outputSgst: "2102",
  outputIgst: "2103",
  tdsPayable: "2200",
  salariesPayable: "2300",

  // ─── Equity (3000 - 3999) ───────────────────────────────────
  capitalAccount: "3001",
  retainedEarnings: "3101",

  // ─── Revenue & Income (4000 - 4999) ─────────────────────────
  salesRevenue: "4001",
  salesReturn: "4002",
  discountAllowed: "4003",
  otherIncome: "4101",

  // ─── Expenses (5000 - 5999) ─────────────────────────────────
  salaryExpense: "5001",
  travelAndFieldExpense: "5002", // Field Travel / Daily Allowance (DA)
  generalExpense: "5002", // Alias for backward compatibility
  marketingAndSamplesExpense: "5003",
  freightAndLogistics: "5004",
  rentAndWarehouseExpense: "5005",
  professionalAndAuditFees: "5006",
  bankCharges: "5007",
  officeAdminExpense: "5008",
  badDebtsExpense: "5009",
  depreciationExpense: "5010",
} as const;

export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
}> = [
  // Assets
  { code: SYSTEM_ACCOUNT_CODES.cash, name: "Cash in Hand", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.bank, name: "Bank Operating Account", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.pettyCash, name: "Petty Cash - Field Operations", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.accountsReceivable, name: "Accounts Receivable - Chemists & Stockists", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.allowanceDoubtfulAccounts, name: "Allowance for Doubtful Accounts", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.inventory, name: "Commercial Stock Inventory", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.sampleInventory, name: "Physician Sample Stock Inventory", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.inputCgst, name: "Input Tax Credit - CGST", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.inputSgst, name: "Input Tax Credit - SGST", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.inputIgst, name: "Input Tax Credit - IGST", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.prepaidExpenses, name: "Prepaid Expenses & Advances", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.fixedAssets, name: "Fixed Assets (Equipment & IT)", type: "ASSET" },
  { code: SYSTEM_ACCOUNT_CODES.accumulatedDepreciation, name: "Accumulated Depreciation", type: "ASSET" },

  // Liabilities
  { code: SYSTEM_ACCOUNT_CODES.accountsPayable, name: "Accounts Payable - Vendors & Suppliers", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.accruedExpenses, name: "Accrued Expenses", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.gstPayable, name: "GST Output Tax Liability (Master)", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.outputCgst, name: "Output CGST Payable", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.outputSgst, name: "Output SGST Payable", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.outputIgst, name: "Output IGST Payable", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.tdsPayable, name: "TDS / Tax Withholding Payable", type: "LIABILITY" },
  { code: SYSTEM_ACCOUNT_CODES.salariesPayable, name: "Salaries & Payroll Payable", type: "LIABILITY" },

  // Equity
  { code: SYSTEM_ACCOUNT_CODES.capitalAccount, name: "Owner's Capital Account", type: "EQUITY" },
  { code: SYSTEM_ACCOUNT_CODES.retainedEarnings, name: "Retained Earnings / Surplus", type: "EQUITY" },

  // Revenue
  { code: SYSTEM_ACCOUNT_CODES.salesRevenue, name: "Pharmaceutical Sales Revenue", type: "INCOME" },
  { code: SYSTEM_ACCOUNT_CODES.salesReturn, name: "Sales Returns & Damaged Stock Deductions", type: "INCOME" },
  { code: SYSTEM_ACCOUNT_CODES.discountAllowed, name: "Volume Schemes & Discounts Allowed", type: "INCOME" },
  { code: SYSTEM_ACCOUNT_CODES.otherIncome, name: "Other Operating & Interest Income", type: "INCOME" },

  // Expenses
  { code: SYSTEM_ACCOUNT_CODES.salaryExpense, name: "Salaries, Allowances & Incentives", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.travelAndFieldExpense, name: "Field Travel & Daily Allowance (DA)", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.marketingAndSamplesExpense, name: "Marketing, Detailing & Physician Samples", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.freightAndLogistics, name: "Freight, Shipping & Logistics", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.rentAndWarehouseExpense, name: "Rent, Rates & Warehouse Storage", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.professionalAndAuditFees, name: "Legal, Compliance & Professional Fees", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.bankCharges, name: "Bank Charges & Gateway Processing Fees", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.officeAdminExpense, name: "General Administration & Office Expenses", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.badDebtsExpense, name: "Bad Debts Written Off", type: "EXPENSE" },
  { code: SYSTEM_ACCOUNT_CODES.depreciationExpense, name: "Depreciation & Amortization Expense", type: "EXPENSE" },
];

/**
 * Builds the create-input for a balanced ledger transaction. Caller runs this inside
 * the same db.$transaction as the source event (Invoice/Collection/Expense/Payroll),
 * and must resolve accountCode -> ChartOfAccount.id beforehand (see finance routes).
 */
export function buildTransactionInput(params: {
  date: Date;
  narration: string;
  sourceType: "MANUAL" | "INVOICE" | "COLLECTION" | "EXPENSE" | "PAYROLL";
  sourceId?: string;
  createdById?: string;
  lines: Array<{ accountId: string; debit?: number; credit?: number }>;
}): Prisma.LedgerTransactionCreateInput {
  return {
    date: params.date,
    narration: params.narration,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    createdById: params.createdById,
    entries: {
      create: params.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit ?? 0,
        credit: l.credit ?? 0,
      })),
    },
  };
}

export type AutoPostSourceType = "INVOICE" | "COLLECTION" | "EXPENSE" | "PAYROLL";

/**
 * Deletes any previously auto-posted LedgerTransaction for a source record
 * (cascades to its LedgerEntry rows). Call before postAutoLedger when an
 * already-posted source is being edited (amount changed) or deleted — a
 * source event must never leave a stale ledger entry once it's mutated.
 */
export async function reverseAutoLedger(tx: TxClient, sourceType: AutoPostSourceType, sourceId: string) {
  await tx.ledgerTransaction.deleteMany({ where: { sourceType, sourceId } });
}

/**
 * Idempotent auto-posting entrypoint for the 4 existing-event integrations
 * (Invoice/Collection/Expense/Payroll). Call inside the SAME db.$transaction as
 * the source event's own write — never as a separate post-commit step, so a
 * failed post rolls back the source event too.
 */
export async function postAutoLedger(
  tx: TxClient,
  params: {
    sourceType: AutoPostSourceType;
    sourceId: string;
    date: Date;
    narration: string;
    lines: LedgerLine[];
  }
): Promise<{ posted: boolean; transactionId?: string }> {
  const existing = await tx.ledgerTransaction.findFirst({
    where: { sourceType: params.sourceType, sourceId: params.sourceId },
    select: { id: true },
  });
  if (existing) return { posted: false, transactionId: existing.id };

  assertBalanced(params.lines);

  const codes = [...new Set(params.lines.map((l) => l.accountCode))];
  const accounts = await tx.chartOfAccount.findMany({ where: { code: { in: codes } } });
  const codeToId = new Map(accounts.map((a) => [a.code, a.id]));
  const missing = codes.filter((c) => !codeToId.has(c));
  if (missing.length > 0) {
    throw new Error(`Ledger posting failed: unknown account code(s) ${missing.join(", ")}`);
  }

  const created = await tx.ledgerTransaction.create({
    data: buildTransactionInput({
      date: params.date,
      narration: params.narration,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      lines: params.lines.map((l) => ({
        accountId: codeToId.get(l.accountCode)!,
        debit: l.debit,
        credit: l.credit,
      })),
    }),
  });

  return { posted: true, transactionId: created.id };
}
