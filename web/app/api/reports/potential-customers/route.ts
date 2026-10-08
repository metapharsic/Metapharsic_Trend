import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { Role } from "@prisma/client";
import { PotentialCustomersAgentsService } from "@/services/potential-customers-agents.service";
import { generateProfessionalExcelWorkbook } from "@/lib/excel-export";

async function getPotentialCustomers(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const territoryId = searchParams.get("territoryId") || undefined;
    const exportFormat = searchParams.get("export") || searchParams.get("format");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

    // Execute multi-agent, multi-threaded intelligence pipeline
    const summary = await PotentialCustomersAgentsService.executePipeline(territoryId);

    if (exportFormat === "excel" || exportFormat === "xlsx") {
      // Build options for native .xlsx workbook
      const kpis = [
        { label: "Total Target Accounts", value: summary.totalAnalyzed, note: "Doctors & Retail Chemists" },
        { label: "Tier A+ (KOL / VIP)", value: summary.vipKolCount, note: "High-Authority Key Opinion Leaders" },
        { label: "Core Prescribers (Tier A)", value: summary.coreTierCount, note: "Consistent Weekly Script Volume" },
        { label: "Monthly Pipeline Potential", value: `₹${summary.totalEstimatedMonthlyPotentialInr.toLocaleString("en-IN")}`, note: "Estimated Aggregate Prescriptions" },
        { label: "Realized Invoiced Revenue", value: `₹${summary.totalRealizedRevenueInr.toLocaleString("en-IN")}`, note: "Delivered Primary & Secondary Invoices" },
        { label: "Urgent Priority Follow-ups", value: summary.urgentFollowupsCount, note: "Requires Visit within 24-48 Hours" },
      ];

      const potentialCustomersHeaders = [
        "Customer / Account Name",
        "Entity Type",
        "Specialty / Category",
        "Territory",
        "Assigned MR",
        "Potential Tier",
        "Score (0-100)",
        "Daily Footfall",
        "Est. Monthly Value",
        "Current Stage",
        "Urgency Window",
        "Conversion Highlights & Strategic Value Points",
        "Recommended Tactical Next Action",
      ];

      const rowsToExport = limit ? summary.topOpportunities.slice(0, limit) : summary.topOpportunities;

      const potentialCustomersRows = rowsToExport.map((item) => [
        item.name,
        item.customerType,
        item.specialty,
        item.territory,
        item.assignedMr,
        item.potentialTier,
        item.potentialScore,
        item.dailyPatientFootfall,
        `₹${item.estimatedMonthlyValueInr.toLocaleString("en-IN")}`,
        item.currentStage,
        item.urgencyLevel,
        item.keyHighlightPoints.join(" | "),
        item.recommendedTacticalAction,
      ]);

      const buffer = await generateProfessionalExcelWorkbook({
        reportTitle: "Executive Potential Customer & Healthcare Accounts Intelligence",
        reportSubtitle: "Multi-Agent Doctor Potential (DPS), Chemist Liquidation & Tactical Conversion Playbook",
        period: "ACTIVE CYCLE",
        kpis,
        potentialCustomersTable: {
          headers: potentialCustomersHeaders,
          rows: potentialCustomersRows,
        },
        detailHeaders: potentialCustomersHeaders,
        detailRows: potentialCustomersRows,
      });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Metapharsic_Potential_Customers_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    if (limit && summary.topOpportunities.length > limit) {
      return NextResponse.json({
        ...summary,
        topOpportunities: summary.topOpportunities.slice(0, limit),
      });
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("[GET /api/reports/potential-customers] Multi-Agent Pipeline Error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate potential customer intelligence", details: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getPotentialCustomers, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
  Role.MARKETING,
  Role.FINANCE,
]);
