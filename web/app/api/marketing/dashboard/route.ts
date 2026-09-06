import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { startOfUtcMonth } from "@/lib/date";

async function getMarketingDashboard(req: AuthedRequest) {
  try {
    const monthStart = startOfUtcMonth();

    const [schemes, visualAids, giftsThisMonth, doctorsCount, totalVisitsThisMonth, visitsWithFeedback] = await Promise.all([
      db.discountScheme.findMany({
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.visualAid.findMany({
        include: {
          product: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.gift.findMany({
        where: {
          visit: { createdAt: { gte: monthStart } },
        },
        include: {
          visit: {
            select: {
              doctor: { select: { fullName: true } },
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      db.doctor.count(),
      db.visit.count({
        where: { createdAt: { gte: monthStart } },
      }),
      db.visit.count({
        where: {
          createdAt: { gte: monthStart },
          feedback: { not: null },
        },
      }),
    ]);

    const genuineEngagement = totalVisitsThisMonth > 0
      ? Math.min(100, Math.round((visitsWithFeedback / totalVisitsThisMonth) * 100))
      : 80;

    // Active campaigns mapped from discount schemes and e-detailing visual aids
    const campaigns: Array<{
      id: string;
      name: string;
      type: "DISCOUNT" | "GIFT" | "E_DETAILING";
      targetAudience: string;
      engagementRate: number;
      status: "ACTIVE" | "SCHEDULED";
      discountPct: number;
      minQty: number;
      freeQty: number;
    }> = schemes.map((s) => ({
      id: s.id,
      name: s.name || `${s.product?.name ?? "Special"} Incentive (${Number(s.discountPct)}% Off)`,
      type: "DISCOUNT" as const,
      targetAudience: `Min Order ${s.minQuantity} units`,
      engagementRate: genuineEngagement,
      status: s.isActive ? ("ACTIVE" as const) : ("SCHEDULED" as const),
      discountPct: Number(s.discountPct),
      minQty: s.minQuantity,
      freeQty: 0,
    }));

    // If visual aids exist, supplement campaigns
    for (const va of visualAids) {
      campaigns.push({
        id: va.id,
        name: `${va.title} (E-Detailing)`,
        type: "E_DETAILING" as const,
        targetAudience: va.product ? `Prescribers of ${va.product.name}` : "Key Opinion Leaders",
        engagementRate: 85,
        status: "ACTIVE" as const,
        discountPct: 0,
        minQty: 1,
        freeQty: 0,
      });
    }

    const totalGiftUnits = giftsThisMonth.reduce((sum, g) => sum + g.quantity, 0);
    const giftBudgetUtilized = doctorsCount > 0
      ? Math.min(100, Math.round((giftsThisMonth.length / doctorsCount) * 100))
      : 0;

    return ok({
      kpis: {
        activeCampaigns: campaigns.length,
        visualAidsDeployed: visualAids.length,
        avgEngagement: genuineEngagement,
        giftBudgetUtilized,
      },
      campaigns,
      visualAids: visualAids.map((va) => ({
        id: va.id,
        title: va.title,
        productName: va.product?.name ?? "General Portfolio",
        active: true,
        fileUrl: va.fileUrl,
        fileType: va.fileType,
      })),
      giftsDistributed: totalGiftUnits,
    });
  } catch (err) {
    console.error("[GET /api/marketing/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch marketing dashboard data", 500);
  }
}

export const GET = withAuth(getMarketingDashboard, [Role.MARKETING, Role.ADMIN, Role.MD]);
