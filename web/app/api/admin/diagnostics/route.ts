import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

async function handler(req: AuthedRequest) {
  const startTime = Date.now();
  try {
    // 1. Test Postgres Database Connection & Latency
    await db.$queryRaw`SELECT 1 as ping;`;
    const dbLatencyMs = Date.now() - startTime;

    // 2. Query Core Table Record Counts
    const [
      usersCount,
      employeesCount,
      visitsCount,
      ordersCount,
      doctorsCount,
      chemistsCount,
      productsCount,
      ledgerCount,
      anomalyCount,
      companySettings,
    ] = await Promise.all([
      db.user.count({ where: { isActive: true } }),
      db.employee.count(),
      db.visit.count(),
      db.order.count(),
      db.doctor.count(),
      db.chemist.count(),
      db.product.count(),
      db.ledgerTransaction.count(),
      db.anomalyReview.count({ where: { status: "PENDING" } }),
      db.companySettings.findUnique({ where: { id: "singleton" } }),
    ]);

    // 3. System Environment Details
    const memoryUsage = process.memoryUsage();

    return ok({
      status: "HEALTHY",
      checkedAt: new Date().toISOString(),
      database: {
        status: "CONNECTED",
        latencyMs: dbLatencyMs,
        client: "Prisma ORM (PostgreSQL 16)",
      },
      counts: {
        activeUsers: usersCount,
        employees: employeesCount,
        doctors: doctorsCount,
        chemists: chemistsCount,
        products: productsCount,
        visitsLogged: visitsCount,
        ordersBooked: ordersCount,
        ledgerTransactions: ledgerCount,
        pendingAnomalies: anomalyCount,
      },
      company: {
        name: companySettings?.name || "Metapharsic Lifesciences",
        logoConfigured: Boolean(companySettings?.logoPath),
        logoPath: companySettings?.logoPath || null,
        gstin: companySettings?.gstin || "Configured",
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
        rssMemoryMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/diagnostics] Diagnostic failure:", err);
    return ok({
      status: "DEGRADED",
      checkedAt: new Date().toISOString(),
      database: {
        status: "ERROR",
        latencyMs: Date.now() - startTime,
        error: err?.message || "Failed to communicate with PostgreSQL",
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  }
}

export const GET = withAuth(handler, [Role.ADMIN, Role.MD, Role.NSM]);
