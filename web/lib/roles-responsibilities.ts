import { Role } from "@prisma/client";

export interface RoleDefinition {
  code: Role;
  title: string;
  department: string;
  level: number;
  badgeColor: string;
  badgeBg: string;
  mandate: string;
  primaryResponsibilities: string[];
  keyKPIs: string[];
  approvalAuthority: string[];
  reportingLine: string;
  validManagerRoles: Role[];
}

export const ROLES_RESPONSIBILITIES_CATALOG: Record<Role, RoleDefinition> = {
  [Role.ADMIN]: {
    code: Role.ADMIN,
    title: "System Administrator",
    department: "Executive & IT",
    level: 0,
    badgeColor: "text-red-700",
    badgeBg: "bg-red-50 border-red-200",
    mandate: "Full governance of system security, user provisioning, master catalogs, workflow policies, and compliance auditing.",
    primaryResponsibilities: [
      "Provision and manage all user accounts, roles, and device bindings",
      "Configure company workflow settings (geofence thresholds, TP enforcement, OCR gates)",
      "Oversee system health, connection pools, and database backups",
      "Manage master territory trees, products, doctors, and distributor profiles",
      "Investigate and unlock flagged GPS / attendance compliance violations",
    ],
    keyKPIs: ["System Uptime 99.9%", "User Provisioning SLA < 2 hrs", "Zero Security Advisories"],
    approvalAuthority: ["Global System Overrides", "User Deletions", "Territory Reassignments"],
    reportingLine: "Direct to Managing Director (MD) / Board",
    validManagerRoles: [],
  },

  [Role.MD]: {
    code: Role.MD,
    title: "Managing Director",
    department: "Executive Management",
    level: 1,
    badgeColor: "text-violet-700",
    badgeBg: "bg-violet-50 border-violet-200",
    mandate: "Overall commercial growth, national revenue delivery, P&L performance, and organizational leadership.",
    primaryResponsibilities: [
      "Review national sales achievements versus annual operating targets",
      "Authorize high-value institutional tenders and hospital formulary listings",
      "Evaluate financial statements (P&L, Balance Sheet, Cash Flow, and DSO)",
      "Set strategic promotional policies, discount margin slabs, and payroll slabs",
    ],
    keyKPIs: ["National Revenue Growth %", "Gross Margin %", "Operating DSO (Days Sales Outstanding)"],
    approvalAuthority: ["Annual Budgets", "Institutional Tenders > ₹50L", "Executive Appointments"],
    reportingLine: "Board of Directors",
    validManagerRoles: [],
  },

  [Role.NSM]: {
    code: Role.NSM,
    title: "National Sales Manager",
    department: "Sales & Field Force",
    level: 2,
    badgeColor: "text-purple-700",
    badgeBg: "bg-purple-50 border-purple-200",
    mandate: "Drive nationwide sales execution across all zones, brand portfolio performance, and field force productivity.",
    primaryResponsibilities: [
      "Set and distribute zonal sales quotas to Zonal Sales Managers (ZSMs)",
      "Analyze pan-India coverage, doctor conversion rates, and DPS tier movements",
      "Formulate quarterly brand marketing plans and launch campaigns",
      "Resolve cross-zonal inventory allocations and supply bottlenecks",
    ],
    keyKPIs: ["Pan-India Target Achievement %", "Doctor DPS Growth Rate", "Sales Return Ratio < 1.5%"],
    approvalAuthority: ["Zonal Target Reallocations", "Special Price Concessions", "ZSM Leaves"],
    reportingLine: "Managing Director (MD)",
    validManagerRoles: [Role.MD, Role.ADMIN],
  },

  [Role.ZSM]: {
    code: Role.ZSM,
    title: "Zonal Sales Manager",
    department: "Sales & Field Force",
    level: 3,
    badgeColor: "text-indigo-700",
    badgeBg: "bg-indigo-50 border-indigo-200",
    mandate: "Lead multi-state sales operations, regional distributor networks, and regional manager supervision.",
    primaryResponsibilities: [
      "Supervise Regional Managers (RMs) and monitor region-wise secondary sales",
      "Review key institutional accounts and top distributor credit limits",
      "Conduct quarterly performance reviews and zonal field cycle meets",
      "Authorize high-value distributor return claims and credit notes",
    ],
    keyKPIs: ["Zonal Secondary Sales %", "Distributor Stock Turnover Rate", "RM Team Retention"],
    approvalAuthority: ["Regional Tour Plans", "Distributor Credit Limits > ₹10L", "RM Expense Claims"],
    reportingLine: "National Sales Manager (NSM)",
    validManagerRoles: [Role.NSM, Role.MD, Role.ADMIN],
  },

  [Role.RM]: {
    code: Role.RM,
    title: "Regional Manager",
    department: "Sales & Field Force",
    level: 4,
    badgeColor: "text-blue-700",
    badgeBg: "bg-blue-50 border-blue-200",
    mandate: "Regional field leadership, ASM coaching, key opinion leader (KOL) engagement, and sales target delivery.",
    primaryResponsibilities: [
      "Manage Area Sales Managers (ASMs) and review territory call coverage",
      "Conduct joint field work with ASMs for Tier-A specialty physician detailing",
      "Oversee regional stockist collections and reduce overdue receivables",
      "Approve regional tour plans and monthly expense budgets",
    ],
    keyKPIs: ["Regional Sales Target %", "Tier-A Doctor Detailing Frequency", "Team Collection Efficiency"],
    approvalAuthority: ["ASM Tour Plans", "Monthly Expense Claims > ₹20K", "ASM Leave Requests"],
    reportingLine: "Zonal Sales Manager (ZSM)",
    validManagerRoles: [Role.ZSM, Role.NSM, Role.ADMIN],
  },

  [Role.ASM]: {
    code: Role.ASM,
    title: "Area Sales Manager",
    department: "Sales & Field Force",
    level: 5,
    badgeColor: "text-teal-700",
    badgeBg: "bg-teal-50 border-teal-200",
    mandate: "First-line field manager overseeing Medical Representatives (MRs), daily field execution, and territory quotas.",
    primaryResponsibilities: [
      "Review and approve MR Monthly Tour Plans (MTP/TP) and daily schedules",
      "Audit MR Daily Call Reports (DCR), GPS compliance, and Call Quality Scores (CQS)",
      "Verify and approve MR daily travel allowances and expense bill receipts",
      "Conduct weekly field accompaniment and detailing coaching",
      "Audit chemist damaged/expiry return claims and verify stock on site",
    ],
    keyKPIs: ["Area Secondary Sales Target %", "MR Daily Call Average ≥ 10/day", "Expense Audit Compliance 100%"],
    approvalAuthority: ["MR Monthly Tour Plans", "MR Daily Expense Claims", "MR Return Claims", "MR Leaves"],
    reportingLine: "Regional Manager (RM)",
    validManagerRoles: [Role.RM, Role.ZSM, Role.ADMIN],
  },

  [Role.MR]: {
    code: Role.MR,
    title: "Medical Representative",
    department: "Field Sales & CRM",
    level: 6,
    badgeColor: "text-emerald-700",
    badgeBg: "bg-emerald-50 border-emerald-200",
    mandate: "Frontline brand promotion, doctor detailing, chemist secondary booking, and territory coverage.",
    primaryResponsibilities: [
      "Execute planned doctor, chemist, and hospital calls per approved Tour Plan",
      "Present scientific product visual aids and distribute promotional samples",
      "Submit real-time DCR call sheets with GPS coordinates and feedback notes",
      "Book chemist secondary orders and collect cheques/cash against invoices",
      "Audit expiry/damaged stock at retail chemists and submit claims for credit notes",
    ],
    keyKPIs: ["Daily Doctor Calls ≥ 8/day", "Chemist Calls ≥ 4/day", "Monthly Secondary Sales Target %", "CQS ≥ 75"],
    approvalAuthority: ["Self DCR Call Submission", "Secondary Order Booking", "Chemist Claim Initiation"],
    reportingLine: "Area Sales Manager (ASM)",
    validManagerRoles: [Role.ASM, Role.RM, Role.ADMIN],
  },

  [Role.DISTRIBUTOR]: {
    code: Role.DISTRIBUTOR,
    title: "Distributor / Stockist",
    department: "Commercial & Channel",
    level: 7,
    badgeColor: "text-amber-700",
    badgeBg: "bg-amber-50 border-amber-200",
    mandate: "Wholesale stock holding, order fulfillment for retail chemists, invoice generation, and credit compliance.",
    primaryResponsibilities: [
      "Receive and confirm secondary sales orders booked by territory MRs",
      "Dispatch orders to retail chemists and generate delivery challans/invoices",
      "Manage account balances, credit utilization, and invoice payment settlements",
      "Process verified damaged/expired return credit notes",
    ],
    keyKPIs: ["Order Fulfillment Rate > 95%", "Delivery Lead Time < 24 hrs", "Payment Settlement Timeliness"],
    approvalAuthority: ["Order Confirmation & Shipment", "Invoice Settlement Receipts"],
    reportingLine: "Regional Manager (RM) / Finance",
    validManagerRoles: [Role.RM, Role.ADMIN],
  },

  [Role.DOCTOR]: {
    code: Role.DOCTOR,
    title: "Healthcare Practitioner / Doctor",
    department: "Medical Partner",
    level: 8,
    badgeColor: "text-sky-700",
    badgeBg: "bg-sky-50 border-sky-200",
    mandate: "Medical partner reviewing scientific visual aids, clinical trial papers, and providing drug efficacy feedback.",
    primaryResponsibilities: [
      "Review pharmaceutical product formulations and prescribing information",
      "Acknowledge receipt of allocated physician trial samples",
      "Submit drug therapy feedback and clinical queries",
    ],
    keyKPIs: ["Sample Receipt Verification", "Clinical Feedback Activity"],
    approvalAuthority: ["Sample Acknowledgement"],
    reportingLine: "External Partner",
    validManagerRoles: [],
  },

  [Role.FINANCE]: {
    code: Role.FINANCE,
    title: "Finance & Accounts Manager",
    department: "Finance & Accounting",
    level: 2,
    badgeColor: "text-emerald-800",
    badgeBg: "bg-emerald-50 border-emerald-300",
    mandate: "Chart of Accounts maintenance, balanced double-entry ledger postings, GST returns, and financial audits.",
    primaryResponsibilities: [
      "Maintain master Chart of Accounts (COA) and post journal vouchers",
      "Verify automatic ledger entries for Invoices, Collections, Expenses, and Payroll",
      "Generate Trial Balance, Profit & Loss Statements, and Balance Sheet reports",
      "Oversee GST tax liabilities (CGST, SGST, IGST) and input tax credits",
      "Reconcile bank accounts, debtor ledgers, and distributor credit limits",
    ],
    keyKPIs: ["Ledger Balance Integrity 100%", "Month-End Close < 3 Days", "Tax Compliance Accuracy 100%"],
    approvalAuthority: ["Manual Journal Vouchers", "Credit Limit Authorizations", "Financial Year Close"],
    reportingLine: "Managing Director (MD)",
    validManagerRoles: [Role.MD, Role.ADMIN],
  },

  [Role.HR]: {
    code: Role.HR,
    title: "HR & Talent Manager",
    department: "Human Resources",
    level: 2,
    badgeColor: "text-pink-700",
    badgeBg: "bg-pink-50 border-pink-200",
    mandate: "Field force headcount management, payroll incentive computations, leave tracking, and LMS training compliance.",
    primaryResponsibilities: [
      "Manage employee onboarding, territory assignments, and reporting hierarchy",
      "Review and approve employee leave requests and freeze tour plan calendars",
      "Run monthly payroll incentive engine based on target sales achievements",
      "Monitor field force training course enrollments and quiz certifications (LMS)",
    ],
    keyKPIs: ["Monthly Payroll Accuracy 100%", "Field Training Completion > 90%", "Employee Attrition < 8%"],
    approvalAuthority: ["Leave Requests", "Payroll Incentive Slabs", "LMS Course Publishing"],
    reportingLine: "Managing Director (MD)",
    validManagerRoles: [Role.MD, Role.ADMIN],
  },

  [Role.WAREHOUSE]: {
    code: Role.WAREHOUSE,
    title: "Warehouse & Inventory Manager",
    department: "Supply Chain & Logistics",
    level: 5,
    badgeColor: "text-amber-800",
    badgeBg: "bg-amber-50 border-amber-300",
    mandate: "Stock inventory control, batch numbering, manufacturing/expiry date tracking, and sample kit dispatches.",
    primaryResponsibilities: [
      "Track physical stock quantities across all product SKUs and batch numbers",
      "Allocate and dispatch physician sample inventory to MR territories",
      "Quarantine near-expiry and damaged stock returned from distributor channels",
      "Maintain minimum reorder levels to prevent field stock-outs",
    ],
    keyKPIs: ["Inventory Accuracy > 99%", "Stock-out Incidents = 0", "Sample Dispatch SLA < 24 hrs"],
    approvalAuthority: ["Sample Inventory Dispatches", "Batch Stock Adjustments"],
    reportingLine: "Operations / Finance",
    validManagerRoles: [Role.ADMIN, Role.FINANCE],
  },

  [Role.MARKETING]: {
    code: Role.MARKETING,
    title: "Product Marketing Manager",
    department: "Marketing & Strategy",
    level: 3,
    badgeColor: "text-orange-700",
    badgeBg: "bg-orange-50 border-orange-200",
    mandate: "Therapeutic brand strategy, digital e-detailing collateral, promotional schemes, and market intelligence.",
    primaryResponsibilities: [
      "Design and upload digital visual aids and interactive detailing slide decks",
      "Configure discount volume schemes and simulate gross margin impacts",
      "Analyze doctor prescribing trends (DPS) by therapeutic segment and geography",
      "Coordinate physician roundtables, clinical webinars, and promotional gift catalogs",
    ],
    keyKPIs: ["Brand Market Share %", "Scheme Margin ROI", "Visual Aid Detailing Adoption > 80%"],
    approvalAuthority: ["Visual Aid Publishing", "Promotional Schemes", "Gift Catalog Additions"],
    reportingLine: "National Sales Manager (NSM) / MD",
    validManagerRoles: [Role.NSM, Role.MD, Role.ADMIN],
  },
};

/**
 * Returns list of appropriate manager candidate roles for a given employee role
 */
export function getEligibleManagerRoles(role: Role): Role[] {
  return ROLES_RESPONSIBILITIES_CATALOG[role]?.validManagerRoles ?? [];
}
