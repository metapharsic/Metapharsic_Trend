/**
 * MR Task Roles & Responsibilities Catalog
 * 
 * Defines granular operational tasks that an Administrator can delegate or assign to an MR.
 * Each task represents a distinct frontline capability within pharmaceutical field operations.
 */

export interface MrTaskRoleDefinition {
  code: string;
  name: string;
  category: "Regulatory & Compliance" | "Core Detailing" | "Commercial & Orders" | "Financial Operations" | "Territory Expansion" | "Market Intelligence";
  criticality: "CRITICAL" | "HIGH" | "MEDIUM" | "STANDARD";
  iconName: string;
  badgeColor: string;
  badgeBg: string;
  mandate: string;
  description: string;
  statutoryBasis?: string;
}

export const MR_TASK_ROLES_CATALOG: MrTaskRoleDefinition[] = [
  {
    code: "TASK_DL_COLLECTION",
    name: "Chemist Drug License (DL) Collection & Compliance",
    category: "Regulatory & Compliance",
    criticality: "CRITICAL",
    iconName: "FileCheck",
    badgeColor: "text-purple-700",
    badgeBg: "bg-purple-50 border-purple-200",
    mandate: "Authorized to collect, audit, and upload Form 20-B/21-B Drug License copies from retail chemists and trigger Multi-Agent verification.",
    description: "Inspects physical or digital DL certificates at client pharmacies, records validity periods, and synchronizes regulatory standing under the Drugs & Cosmetics Act 1940.",
    statutoryBasis: "Drugs & Cosmetics Act 1940 & Rules 1945 (Forms 20-B, 21-B)",
  },
  {
    code: "TASK_DOCTOR_DETAILING",
    name: "Doctor Detailing & Scientific Sampling",
    category: "Core Detailing",
    criticality: "HIGH",
    iconName: "Stethoscope",
    badgeColor: "text-blue-700",
    badgeBg: "bg-blue-50 border-blue-200",
    mandate: "Authorized to present brand visual aids, share clinical literature, and disburse physician trial sample packs.",
    description: "Conducts structured detailing calls with medical practitioners, captures prescription commitments, and maintains sample accountability ledgers.",
  },
  {
    code: "TASK_CHEMIST_POB_ORDERS",
    name: "Chemist Secondary Order Booking (POB)",
    category: "Commercial & Orders",
    criticality: "HIGH",
    iconName: "ShoppingBag",
    badgeColor: "text-emerald-700",
    badgeBg: "bg-emerald-50 border-emerald-200",
    mandate: "Authorized to negotiate and book secondary sales orders (Personal Order Booking) with retail pharmacies.",
    description: "Captures SKU-level chemist orders, applies promotional schemes, and routes dispatch bookings to assigned stockists.",
  },
  {
    code: "TASK_PAYMENT_COLLECTION",
    name: "Payment & Cheque Collection",
    category: "Financial Operations",
    criticality: "HIGH",
    iconName: "Wallet",
    badgeColor: "text-amber-700",
    badgeBg: "bg-amber-50 border-amber-200",
    mandate: "Authorized to collect cheques, demand drafts, or digital payment receipts against overdue distributor invoices.",
    description: "Monitors chemist outstanding aging (DSO), issues official collection receipts, and reconciles distributor ledgers.",
  },
  {
    code: "TASK_NEW_CLIENT_ONBOARDING",
    name: "New Client Master Onboarding (Doctors & Chemists)",
    category: "Territory Expansion",
    criticality: "MEDIUM",
    iconName: "UserPlus",
    badgeColor: "text-indigo-700",
    badgeBg: "bg-indigo-50 border-indigo-200",
    mandate: "Authorized to scout, GPS geo-tag, and onboard new clinic and retail pharmacy accounts into master profiles.",
    description: "Gathers clinic timings, footfall estimates, drug license credentials, and maps new clients to territorial beats.",
  },
  {
    code: "TASK_STOCK_AUDIT_SURVEY",
    name: "Retail Stock Audit & Inventory Survey",
    category: "Market Intelligence",
    criticality: "STANDARD",
    iconName: "Boxes",
    badgeColor: "text-cyan-700",
    badgeBg: "bg-cyan-50 border-cyan-200",
    mandate: "Authorized to conduct chemist shelf audits, monitor brand availability, and track competitor prescription movements.",
    description: "Counts shelf inventory of key molecules, audits fast-moving pack sizes, and reports competitor trade schemes.",
  },
  {
    code: "TASK_CLAIMS_EXPIRY_HANDLING",
    name: "Damaged & Near-Expiry Stock Claim Initiation",
    category: "Regulatory & Compliance",
    criticality: "MEDIUM",
    iconName: "AlertTriangle",
    badgeColor: "text-rose-700",
    badgeBg: "bg-rose-50 border-rose-200",
    mandate: "Authorized to physically verify damaged or expired stock at pharmacies and submit return claims for credit notes.",
    description: "Verifies batch numbers and expiry stamps on unsellable inventory and submits structured claim documentation to ASM/Distributor.",
  },
  {
    code: "TASK_INSTITUTIONAL_TENDERS",
    name: "Hospital Formulary & Institutional Supply Calls",
    category: "Core Detailing",
    criticality: "STANDARD",
    iconName: "Building2",
    badgeColor: "text-teal-700",
    badgeBg: "bg-teal-50 border-teal-200",
    mandate: "Authorized to visit institutional hospital pharmacies, nursing homes, and government rate contract purchasing desks.",
    description: "Facilitates formulary entry, reviews rate contract supply requirements, and tracks institutional consumption.",
  },
];

export const ALL_MR_TASK_CODES = MR_TASK_ROLES_CATALOG.map((t) => t.code);

export const TASK_DL_COLLECTION = "TASK_DL_COLLECTION";
export const TASK_DOCTOR_DETAILING = "TASK_DOCTOR_DETAILING";
export const TASK_CHEMIST_POB_ORDERS = "TASK_CHEMIST_POB_ORDERS";
export const TASK_PAYMENT_COLLECTION = "TASK_PAYMENT_COLLECTION";
export const TASK_NEW_CLIENT_ONBOARDING = "TASK_NEW_CLIENT_ONBOARDING";
export const TASK_STOCK_AUDIT_SURVEY = "TASK_STOCK_AUDIT_SURVEY";
export const TASK_CLAIMS_EXPIRY_HANDLING = "TASK_CLAIMS_EXPIRY_HANDLING";
export const TASK_INSTITUTIONAL_TENDERS = "TASK_INSTITUTIONAL_TENDERS";

/**
 * Parses assigned tasks from raw JSON string, array, or null/undefined.
 * If null/empty and role is MR, defaults to standard core field suite.
 */
export function parseAssignedTasks(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "string") return [...ALL_MR_TASK_CODES];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [...ALL_MR_TASK_CODES];
  } catch {
    // If comma separated
    if (raw.includes(",")) return raw.split(",").map((s) => s.trim()).filter(Boolean);
    return [...ALL_MR_TASK_CODES];
  }
}

/**
 * Checks whether an MR has a specific task role assigned.
 */
export function hasMrTask(assignedTasks: string | string[] | null | undefined, taskCode: string): boolean {
  const tasks = parseAssignedTasks(assignedTasks);
  return tasks.includes(taskCode);
}
