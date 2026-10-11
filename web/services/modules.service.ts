import { db } from "../lib/db";
import { Role } from "@prisma/client";
import fs from "fs";
import path from "path";

export interface SidebarItemDto {
  id: string;
  code: string;
  label: string;
  href: string;
  icon: string;
  category: string;
  categoryOrder: number;
  sortOrder: number;
  roles: string[];
  labelByRole?: Record<string, string> | null;
  isArtifact: boolean;
  moduleType: string;
  badge?: string | null;
  isActive: boolean;
  description?: string | null;
}

export interface SidebarCategoryGroupDto {
  category: string;
  categoryOrder: number;
  items: SidebarItemDto[];
}

export const NAV_CATEGORY_ORDER = [
  "Executive & Dashboards",
  "Field Force & CRM",
  "Commercial & Channels",
  "Finance, HR & People",
  "Analytics & Marketing",
  "Administration & Profile",
] as const;

export const INITIAL_MODULES_DATA = [
  // ── 1. Executive & Dashboards (categoryOrder: 1) ───────────────────────────────────
  {
    code: "NAV_MD_DASHBOARD",
    label: "MD Executive Dashboard",
    href: "/md",
    icon: "LayoutGrid",
    category: "Executive & Dashboards",
    categoryOrder: 1,
    sortOrder: 1,
    roles: [Role.MD, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "National executive overview, revenue, coverage, and operations for Managing Director",
  },
  {
    code: "NAV_ASM_DASHBOARD",
    label: "ASM Area Dashboard",
    href: "/asm",
    icon: "LayoutGrid",
    category: "Executive & Dashboards",
    categoryOrder: 1,
    sortOrder: 2,
    roles: [Role.ASM, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Area sales performance, team roster, and doctor coverage for Area Sales Managers",
  },
  {
    code: "NAV_MR_DASHBOARD",
    label: "MR Field Dashboard",
    href: "/mr",
    icon: "LayoutGrid",
    category: "Executive & Dashboards",
    categoryOrder: 1,
    sortOrder: 3,
    roles: [Role.MR, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "MR daily command center, calls summary, samples, and field route status",
  },
  {
    code: "NAV_COUNCIL_EXECUTIVE",
    label: "Multi-Agent AI Council",
    href: "/mr/reports/council",
    icon: "Sparkles",
    category: "Executive & Dashboards",
    categoryOrder: 1,
    sortOrder: 4,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.MR],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "8-domain multi-agent autonomous audit council, grades, and intelligence dossiers",
  },
  {
    code: "NAV_ADMIN_CONTROL",
    label: "Admin Control Center",
    href: "/admin",
    icon: "ShieldCheck",
    category: "Executive & Dashboards",
    categoryOrder: 1,
    sortOrder: 5,
    roles: [Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "System governance, live workforce pulse, compliance oversight, and company health",
  },

  // ── 2. Field Force & CRM (categoryOrder: 2) ────────────────────────────────────────
  {
    code: "NAV_MR_CALLS",
    label: "My Calls & DCR",
    href: "/mr/calls",
    icon: "ClipboardCheck",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 1,
    roles: [Role.MR, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Daily Call Reports (DCR), doctor detailing, chemist POB, and visit logging",
  },
  {
    code: "NAV_MR_CALL_REPORTS",
    label: "My Call Reports",
    href: "/mr/reports",
    icon: "BarChart3",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 2,
    roles: [Role.MR, Role.ADMIN],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Historical detailing analytics, doctor-chemist ratios, and performance trends",
  },
  {
    code: "NAV_COUNCIL_AUDIT_WHATSAPP",
    label: "Multi-Agent Audit & WhatsApp",
    href: "/mr/reports/council",
    icon: "Sparkles",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 3,
    roles: [Role.MR, Role.ADMIN, Role.ASM, Role.RM, Role.ZSM, Role.NSM, Role.MD],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Live interactive WhatsApp work dispatch, agent evaluation matrix, and directives",
  },
  {
    code: "NAV_TOUR_PLANS",
    label: "Tour Plans (MTP/TP)",
    href: "/tour-plans",
    icon: "CalendarDays",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 4,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.MR],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Monthly Tour Plans calendar, routing beats, and manager approval workflows",
  },
  {
    code: "NAV_TERRITORIES",
    label: "Territory Tree",
    href: "/territories",
    icon: "MapPinned",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 5,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Hierarchical territory master, zones, states, headquarter areas, and alignments",
  },
  {
    code: "NAV_DOCTORS",
    label: "Doctor CRM & Potential",
    href: "/doctors",
    icon: "Stethoscope",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 6,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Doctor master registry, DPS potential scoring, specialty profiles, and tiers",
  },
  {
    code: "NAV_HOSPITALS",
    label: "Hospital & Institutional",
    href: "/hospitals",
    icon: "Building2",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 7,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Institutional sales, hospital rate contracts, tenders, and formulary approvals",
  },
  {
    code: "NAV_MASTER_PROFILES",
    label: "Master Entity Profiles",
    href: "/entities",
    icon: "Contact",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 8,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Unified 360-degree registry for Doctors, Chemists, Distributors, and Employees",
  },
  {
    code: "NAV_MR_LEADS",
    label: "Lead Pipeline",
    href: "/mr/leads",
    icon: "Target",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 9,
    roles: [Role.MR, Role.ADMIN, Role.ASM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Prospect pipeline, qualification stages, converted doctors, and commercial beats",
  },
  {
    code: "NAV_FIELD_ACTIVITY_MONITOR",
    label: "Field Activity Monitor",
    href: "/admin/mr-activity",
    icon: "ClipboardCheck",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 10,
    roles: [Role.ADMIN, Role.ASM, Role.RM, Role.ZSM, Role.NSM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Real-time field activity monitor, geofenced timestamps, and live beats tracking",
  },
  {
    code: "NAV_MR_CLAIMS",
    label: "Expiry & Damage Claims",
    href: "/mr/claims",
    icon: "AlertTriangle",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 11,
    roles: [Role.MR, Role.ADMIN, Role.ASM],
    labelByRole: { ADMIN: "Claims Review", ASM: "Claims Review" },
    isArtifact: false,
    moduleType: "MODULE",
    description: "Expiry, breakage, and damage returns management with credit note audit trail",
  },
  {
    code: "NAV_MR_ATTENDANCE",
    label: "Field Attendance",
    href: "/mr/attendance",
    icon: "Clock",
    category: "Field Force & CRM",
    categoryOrder: 2,
    sortOrder: 12,
    roles: [Role.MR, Role.ADMIN, Role.ASM],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Biometric and geo-verified daily field check-in and check-out logs",
  },

  // ── 3. Commercial & Channels (categoryOrder: 3) ────────────────────────────────────
  {
    code: "NAV_SECONDARY_ORDERS",
    label: "Secondary Orders",
    href: "/orders",
    icon: "Package",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 1,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.MR, Role.DISTRIBUTOR],
    labelByRole: { MR: "My Orders", DISTRIBUTOR: "Orders & Invoices" },
    isArtifact: false,
    moduleType: "MODULE",
    description: "Chemist secondary order booking, SKU quantities, PTR pricing, and schemes",
  },
  {
    code: "NAV_CREDIT_COLLECTIONS",
    label: "Credit & Collections",
    href: "/collections",
    icon: "Wallet",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 2,
    roles: [Role.MR, Role.ASM, Role.ADMIN, Role.FINANCE],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Chemist payments, Cheque/NEFT receipts, overdue aging, and collections",
  },
  {
    code: "NAV_STOCK_INVENTORY",
    label: "Stock Inventory",
    href: "/inventory",
    icon: "Package",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 3,
    roles: [Role.ADMIN, Role.WAREHOUSE, Role.ASM, Role.MR],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Central warehouse batches, MR sample kits, stock movements, and burn rate",
  },
  {
    code: "NAV_FINANCIAL_BALANCES",
    label: "Entity Credit & Balances",
    href: "/admin/financials",
    icon: "IndianRupee",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 4,
    roles: [Role.ADMIN, Role.ASM, Role.FINANCE],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Customer credit limits, ledger balances, and payment terms oversight",
  },
  {
    code: "NAV_WAREHOUSE_OPS",
    label: "Warehouse Operations",
    href: "/warehouse",
    icon: "Package",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 5,
    roles: [Role.WAREHOUSE, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "GRN goods inward, batch dispatching, pick lists, and warehouse inventory",
  },
  {
    code: "NAV_DISTRIBUTOR_PORTAL",
    label: "Distributor Portal",
    href: "/distributor",
    icon: "Package",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 6,
    roles: [Role.DISTRIBUTOR, Role.ADMIN, Role.MD],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Stockist portal for order dispatching, invoice download, and claims review",
  },
  {
    code: "NAV_DOCTOR_PORTAL",
    label: "Doctor Portal",
    href: "/doctor",
    icon: "Stethoscope",
    category: "Commercial & Channels",
    categoryOrder: 3,
    sortOrder: 7,
    roles: [Role.DOCTOR, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Doctor access portal for medical literature, sample tracking, and queries",
  },

  // ── 4. Finance, HR & People (categoryOrder: 4) ─────────────────────────────────────
  {
    code: "NAV_ACCOUNTS_JOTTER",
    label: "Admin Accounts Jotter",
    href: "/admin/accounts-jotter",
    icon: "BookOpen",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 1,
    roles: [Role.ADMIN, Role.FINANCE, Role.MD],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Quick journal entries, direct double-entry voucher posting, and quick adjustments",
  },
  {
    code: "NAV_FINANCE_GL",
    label: "Finance & General Ledger",
    href: "/finance",
    icon: "Calculator",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 2,
    roles: [Role.FINANCE, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Balanced double-entry financial core, debits, credits, and trial balance",
  },
  {
    code: "NAV_CHART_OF_ACCOUNTS",
    label: "Chart of Accounts",
    href: "/finance/accounts",
    icon: "IndianRupee",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 3,
    roles: [Role.FINANCE, Role.ADMIN, Role.MD],
    isArtifact: false,
    moduleType: "MODULE",
    description: "30-account standard pharmaceutical chart of accounts and sub-ledgers",
  },
  {
    code: "NAV_JOURNAL_ENTRIES",
    label: "Journal Entries",
    href: "/finance/journal",
    icon: "IndianRupee",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 4,
    roles: [Role.FINANCE, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Immutable transaction journal ledger, debit/credit balancing, and audit stamps",
  },
  {
    code: "NAV_FINANCIAL_STATEMENTS",
    label: "Financial Statements",
    href: "/finance/reports",
    icon: "IndianRupee",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 5,
    roles: [Role.FINANCE, Role.ADMIN, Role.MD],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "P&L income statement, balance sheet, and trial balance financial reports",
  },
  {
    code: "NAV_EXPENSES_DA",
    label: "Expense Claims & DA",
    href: "/expenses",
    icon: "Receipt",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 6,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.MR, Role.FINANCE],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Daily allowance, travel claims, receipt OCR hashing, and approval workflow",
  },
  {
    code: "NAV_USER_MANAGEMENT",
    label: "User Management & Roles",
    href: "/users",
    icon: "UserCog",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 7,
    roles: [Role.ADMIN, Role.HR, Role.MD],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Employee role assignments, credentials provisioning, and territory alignment",
  },
  {
    code: "NAV_HR_DASHBOARD",
    label: "HR Dashboard",
    href: "/hr",
    icon: "Users2",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 8,
    roles: [Role.HR, Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Workforce headcount, attendance percentage, leaves pipeline, and HR overview",
  },
  {
    code: "NAV_HRMS_PAYROLL",
    label: "HRMS & Payroll",
    href: "/hrms",
    icon: "Users2",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 9,
    roles: [Role.ADMIN, Role.HR],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Automated salary processing, sales incentive calculation, and payslips",
  },
  {
    code: "NAV_LMS_TRAINING",
    label: "Training & Certifications",
    href: "/lms",
    icon: "GraduationCap",
    category: "Finance, HR & People",
    categoryOrder: 4,
    sortOrder: 10,
    roles: [Role.ADMIN, Role.HR, Role.ASM, Role.RM, Role.ZSM, Role.NSM, Role.MD, Role.MR],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Product detailing courses, pharmacology quizzes, and field certifications",
  },

  // ── 5. Analytics & Marketing (categoryOrder: 5) ────────────────────────────────────
  {
    code: "NAV_EXECUTIVE_BI",
    label: "Executive BI Reports",
    href: "/reports",
    icon: "BarChart3",
    category: "Analytics & Marketing",
    categoryOrder: 5,
    sortOrder: 1,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "10-report business intelligence catalog, product profitability, and territory ranks",
  },
  {
    code: "NAV_MR_DAILY_CALLS_REPORT",
    label: "MR Daily Calls Report",
    href: "/reports/mr-daily-calls",
    icon: "BarChart3",
    category: "Analytics & Marketing",
    categoryOrder: 5,
    sortOrder: 2,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.MR],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Doctor visit breakdown, duration, CQS metrics, and daily Excel reports",
  },
  {
    code: "NAV_SCHEME_SIMULATOR",
    label: "Scheme Margin Simulator",
    href: "/simulator",
    icon: "Calculator",
    category: "Analytics & Marketing",
    categoryOrder: 5,
    sortOrder: 3,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.FINANCE, Role.MARKETING],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Commercial discount simulator, gross margins, free goods, and live DB publishing",
  },
  {
    code: "NAV_MARKETING_INTELLIGENCE",
    label: "Marketing & Campaign Intelligence",
    href: "/marketing",
    icon: "BarChart3",
    category: "Analytics & Marketing",
    categoryOrder: 5,
    sortOrder: 4,
    roles: [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.MARKETING],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Visual aids detailing engagement rates, campaign performance, and product brand pull",
  },

  // ── 6. Administration & Profile (categoryOrder: 6) ─────────────────────────────────
  {
    code: "NAV_DMS_DOCUMENTS",
    label: "Document Management (DMS)",
    href: "/dms",
    icon: "Folder",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 1,
    roles: [Role.ADMIN],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Statutory licenses, GMP certifications, GST certificates, and 15-day expiry alerts",
  },
  {
    code: "NAV_PTR_SIMULATOR",
    label: "PTR & Scheme Simulator",
    href: "/admin/ptr-calculator",
    icon: "Calculator",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 2,
    roles: [Role.ADMIN, Role.MD],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Top-down MRP commercial pricing calculator with net realization breakdown",
  },
  {
    code: "NAV_QUICK_ACCOUNTS_JOTTER",
    label: "Quick Accounts Jotter",
    href: "/admin/accounts-jotter",
    icon: "BookOpen",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 3,
    roles: [Role.ADMIN, Role.FINANCE],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Rapid single-screen accounting adjustments for administrative controllers",
  },
  {
    code: "NAV_SYSTEM_DIAGNOSTICS",
    label: "System Health & Diagnostics",
    href: "/admin/diagnostics",
    icon: "ShieldAlert",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 4,
    roles: [Role.ADMIN, Role.MD],
    isArtifact: true,
    moduleType: "ARTIFACT",
    description: "Real-time error trace telemetry, PM2 process metrics, and health diagnostics",
  },
  {
    code: "NAV_COMPANY_SETTINGS",
    label: "Company Settings",
    href: "/admin/company-settings",
    icon: "Building2",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 5,
    roles: [Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Legal entity profile, GSTIN, Drug License numbers, bank details, and invoice terms",
  },
  {
    code: "NAV_WORKFLOW_SETTINGS",
    label: "Workflow Settings",
    href: "/admin/workflow-settings",
    icon: "Settings2",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 6,
    roles: [Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Geofence thresholds, required photos, MTP enforcement, and system guardrails",
  },
  {
    code: "NAV_SYSTEM_CONFIG",
    label: "System Configuration",
    href: "/admin/system-config",
    icon: "Settings2",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 7,
    roles: [Role.ADMIN],
    isArtifact: false,
    moduleType: "MODULE",
    description: "Automated git synchronization, ad-hoc commit deployment, and OTA software updates",
  },
  {
    code: "NAV_MY_PROFILE",
    label: "My Profile",
    href: "/profile",
    icon: "UserCircle2",
    category: "Administration & Profile",
    categoryOrder: 6,
    sortOrder: 8,
    roles: [
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
      Role.HR,
      Role.FINANCE,
      Role.WAREHOUSE,
      Role.MARKETING,
      Role.MR,
      Role.DISTRIBUTOR,
      Role.DOCTOR,
    ],
    isArtifact: false,
    moduleType: "MODULE",
    description: "User security credentials, assigned territory, contact info, and activity log",
  },
];

export class ModulesService {
  /**
   * Provisions all initial navigation modules & artifact entries into the PostgreSQL database.
   * Safe and idempotent upsert.
   */
  public static async provisionDefaultModules(prismaClient = db) {
    const results = [];
    for (const item of INITIAL_MODULES_DATA) {
      const res = await prismaClient.appModule.upsert({
        where: { code: item.code },
        update: {
          label: item.label,
          href: item.href,
          icon: item.icon,
          category: item.category,
          categoryOrder: item.categoryOrder,
          sortOrder: item.sortOrder,
          roles: item.roles,
          labelByRole: (item as any).labelByRole ?? undefined,
          isArtifact: item.isArtifact,
          moduleType: item.moduleType,
          description: item.description,
          isActive: true,
        },
        create: {
          code: item.code,
          label: item.label,
          href: item.href,
          icon: item.icon,
          category: item.category,
          categoryOrder: item.categoryOrder,
          sortOrder: item.sortOrder,
          roles: item.roles,
          labelByRole: (item as any).labelByRole ?? undefined,
          isArtifact: item.isArtifact,
          moduleType: item.moduleType,
          description: item.description,
          isActive: true,
        },
      });
      results.push(res);
    }
    return results;
  }

  /**
   * Provisions default system artifacts into the PostgreSQL database.
   */
  public static async provisionDefaultArtifacts(prismaClient = db) {
    const reportDir = path.resolve(process.cwd(), "reports-output");
    const mrReportMdPath = path.join(reportDir, "mr-multiagent-detailed-report.md");
    const mrReportJsonPath = path.join(reportDir, "mr-multiagent-reports.json");
    const itemReportMdPath = path.join(reportDir, "item-supply-chain-history-report.md");
    const itemReportJsonPath = path.join(reportDir, "item-supply-chain-history-report.json");

    const defaultArtifacts = [
      {
        code: "ART_MR_MULTIAGENT_REPORT",
        title: "Trend MR Pharma OS — Multi-Agent Granular MR Audit & Performance Report",
        artifactType: "INTELLIGENCE_COUNCIL",
        category: "Field Force & Council",
        fileFormat: "MARKDOWN",
        filePath: "/reports-output/mr-multiagent-detailed-report.md",
        content: fs.existsSync(mrReportMdPath) ? fs.readFileSync(mrReportMdPath, "utf8") : "# Multi-Agent Report Placeholder",
        metadata: { auditedRoles: ["MR"], councilAgents: 8, source: "ReportsService" },
      },
      {
        code: "ART_MR_MULTIAGENT_JSON",
        title: "MR Multi-Agent Audit Council JSON Dataset",
        artifactType: "REPORT_DATA",
        category: "Field Force & Council",
        fileFormat: "JSON",
        filePath: "/reports-output/mr-multiagent-reports.json",
        content: fs.existsSync(mrReportJsonPath) ? fs.readFileSync(mrReportJsonPath, "utf8") : "[]",
        metadata: { format: "json", agentStatusesIncluded: true },
      },
      {
        code: "ART_SUPPLY_CHAIN_REPORT",
        title: "Item Supply Chain & Batch Movement Audit Report",
        artifactType: "SUPPLY_CHAIN_ANALYSIS",
        category: "Commercial & Inventory",
        fileFormat: "MARKDOWN",
        filePath: "/reports-output/item-supply-chain-history-report.md",
        content: fs.existsSync(itemReportMdPath) ? fs.readFileSync(itemReportMdPath, "utf8") : "# Supply Chain Report Placeholder",
        metadata: { tracksBatches: true, complianceVerified: true },
      },
      {
        code: "ART_SUPPLY_CHAIN_JSON",
        title: "Supply Chain Audit Log Dataset",
        artifactType: "REPORT_DATA",
        category: "Commercial & Inventory",
        fileFormat: "JSON",
        filePath: "/reports-output/item-supply-chain-history-report.json",
        content: fs.existsSync(itemReportJsonPath) ? fs.readFileSync(itemReportJsonPath, "utf8") : "[]",
        metadata: { format: "json", scope: "inventory_movements" },
      },
      {
        code: "ART_GST_CERTIFICATE",
        title: "Metapharsic Life Sciences GST Registration Certificate",
        artifactType: "COMPLIANCE_DOCUMENT",
        category: "Administration & Formation",
        fileFormat: "PDF",
        filePath: "/uploads/company-formation/gst/GST CERTIFICATE.pdf",
        content: null,
        metadata: { registrationAuthority: "CBIC", state: "Maharashtra" },
      },
      {
        code: "ART_WHO_GMP_CERT",
        title: "WHO-GMP Quality Certification Dossier",
        artifactType: "COMPLIANCE_DOCUMENT",
        category: "Administration & Formation",
        fileFormat: "PDF",
        filePath: "/uploads/company-formation/certificates/latest WHO-GMP.pdf",
        content: null,
        metadata: { standard: "WHO-GMP", auditFrequency: "Annual" },
      },
      {
        code: "ART_DRUG_LICENSE",
        title: "Statutory Pharma Manufacturing & Sale License (Form 25 & 28)",
        artifactType: "LEGAL_LICENSE",
        category: "Administration & Formation",
        fileFormat: "PDF",
        filePath: "/uploads/company-formation/certificates/Drug License on form No. 25 & 28 MBC.pdf",
        content: null,
        metadata: { forms: ["Form 25", "Form 28"], regulatoryBody: "FDA" },
      },
    ];

    const results = [];
    for (const art of defaultArtifacts) {
      const res = await prismaClient.systemArtifact.upsert({
        where: { code: art.code },
        update: {
          title: art.title,
          artifactType: art.artifactType,
          category: art.category,
          fileFormat: art.fileFormat,
          filePath: art.filePath,
          content: art.content,
          metadata: art.metadata,
          status: "ACTIVE",
        },
        create: {
          code: art.code,
          title: art.title,
          artifactType: art.artifactType,
          category: art.category,
          fileFormat: art.fileFormat,
          filePath: art.filePath,
          content: art.content,
          metadata: art.metadata,
          status: "ACTIVE",
          generatedBy: "SYSTEM_AGENT",
          version: "1.0.0",
        },
      });
      results.push(res);
    }
    return results;
  }

  /**
   * Fetches all active modules strictly from PostgreSQL database.
   * Auto-provisions if table is empty.
   */
  public static async getAllModules(includeInactive = false, prismaClient = db) {
    let rows = await prismaClient.appModule.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ categoryOrder: "asc" }, { sortOrder: "asc" }],
    });

    if (rows.length === 0) {
      await this.provisionDefaultModules(prismaClient);
      rows = await prismaClient.appModule.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ categoryOrder: "asc" }, { sortOrder: "asc" }],
      });
    }

    return rows;
  }

  /**
   * Fetches modules matching a specific role strictly from PostgreSQL database.
   */
  public static async getModulesForRole(role: Role, prismaClient = db): Promise<SidebarItemDto[]> {
    const all = await this.getAllModules(false, prismaClient);
    return all
      .filter((m) => m.roles.includes(role))
      .map((item) => {
        let label = item.label;
        if (item.labelByRole && typeof item.labelByRole === "object") {
          const override = (item.labelByRole as Record<string, string>)[role];
          if (override) label = override;
        }
        return {
          id: item.id,
          code: item.code,
          label,
          href: item.href,
          icon: item.icon,
          category: item.category,
          categoryOrder: item.categoryOrder,
          sortOrder: item.sortOrder,
          roles: item.roles,
          labelByRole: item.labelByRole as Record<string, string> | null,
          isArtifact: item.isArtifact,
          moduleType: item.moduleType,
          badge: item.badge,
          isActive: item.isActive,
          description: item.description,
        };
      });
  }

  /**
   * Fetches structured grouped sidebar navigation strictly from PostgreSQL database.
   */
  public static async getSidebarForRole(role?: Role, prismaClient = db): Promise<SidebarCategoryGroupDto[]> {
    const modules = role ? await this.getModulesForRole(role, prismaClient) : (await this.getAllModules(false, prismaClient)).map(m => ({
      ...m,
      labelByRole: m.labelByRole as Record<string, string> | null
    }));

    // Group by category, retaining categoryOrder
    const categoriesMap = new Map<string, { categoryOrder: number; items: SidebarItemDto[] }>();

    for (const mod of modules) {
      if (!categoriesMap.has(mod.category)) {
        categoriesMap.set(mod.category, {
          categoryOrder: mod.categoryOrder,
          items: [],
        });
      }
      categoriesMap.get(mod.category)!.items.push(mod);
    }

    const groups: SidebarCategoryGroupDto[] = [];
    for (const [category, { categoryOrder, items }] of categoriesMap.entries()) {
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      groups.push({
        category,
        categoryOrder,
        items,
      });
    }

    groups.sort((a, b) => a.categoryOrder - b.categoryOrder);
    return groups;
  }

  /**
   * Fetches system artifacts strictly from PostgreSQL database.
   */
  public static async getArtifacts(params?: { artifactType?: string; category?: string }, prismaClient = db) {
    let artifacts = await prismaClient.systemArtifact.findMany({
      where: {
        status: "ACTIVE",
        ...(params?.artifactType ? { artifactType: params.artifactType } : {}),
        ...(params?.category ? { category: params.category } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (artifacts.length === 0) {
      await this.provisionDefaultArtifacts(prismaClient);
      artifacts = await prismaClient.systemArtifact.findMany({
        where: {
          status: "ACTIVE",
          ...(params?.artifactType ? { artifactType: params.artifactType } : {}),
          ...(params?.category ? { category: params.category } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return artifacts;
  }
}
