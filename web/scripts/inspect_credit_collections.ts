import { db } from "../lib/db";
import { CreditAgentsService } from "../services/credit-agents.service";

async function main() {
  const invCount = await db.invoice.count();
  const collCount = await db.collection.count();
  const chemCount = await db.chemist.count();
  const terrCount = await db.territory.count();
  const terrWithEmp = await db.territory.count({ where: { employeeId: { not: null } } });
  const terrWithoutEmp = await db.territory.count({ where: { employeeId: null } });

  console.log("=== DB COUNTS ===");
  console.log({ invCount, collCount, chemCount, terrCount, terrWithEmp, terrWithoutEmp });

  // Check Territories and assigned employees
  const territories = await db.territory.findMany({
    select: {
      id: true,
      name: true,
      employeeId: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { chemists: true } },
    },
  });
  console.log("\n=== TERRITORIES & EMPLOYEES ===");
  for (const t of territories) {
    console.log(`Territory: ${t.name.padEnd(25)} | Chemists: ${String(t._count.chemists).padEnd(4)} | MR: ${t.employee ? `${t.employee.firstName} ${t.employee.lastName} (${t.employeeId})` : "UNASSIGNED"}`);
  }

  // Check Employees and their User role
  const employees = await db.employee.findMany({
    include: { user: { select: { email: true, role: true } } },
  });
  console.log("\n=== EMPLOYEES ===");
  for (const e of employees) {
    console.log(`Emp: ${(e.firstName + " " + e.lastName).padEnd(25)} | ID: ${e.id} | Role: ${e.user?.role} | Email: ${e.user?.email}`);
  }

  // Test CreditAgentsService for each MR
  console.log("\n=== CREDIT PIPELINE PER MR ===");
  for (const e of employees) {
    if (e.user?.role === "MR") {
      const res = await CreditAgentsService.executeCreditPipeline({ employeeId: e.id });
      console.log(`MR ${e.firstName} ${e.lastName}: Chemists count = ${res.creditData.chemists.length}, Total Outstanding = ${res.creditData.summary.totalOutstanding}, Recent Collections = ${res.creditData.recentCollections.length}`);
    }
  }

  // Test Manager view
  const mgrRes = await CreditAgentsService.executeCreditPipeline();
  console.log("\n=== MANAGER VIEW ===");
  console.log(`Total Chemists = ${mgrRes.creditData.chemists.length}, Total Outstanding = ${mgrRes.creditData.summary.totalOutstanding}, Recent Collections = ${mgrRes.creditData.recentCollections.length}`);

  // Check orders with invoices and booked by MR
  const orders = await db.order.findMany({
    where: { invoice: { isNot: null } },
    select: {
      id: true,
      employeeId: true,
      chemistId: true,
      chemist: { select: { name: true, territoryId: true, territory: { select: { name: true, employeeId: true } } } },
      employee: { select: { firstName: true, lastName: true } },
      invoice: { select: { id: true, invoiceNo: true, grandTotal: true } },
    },
    take: 10,
  });
  console.log("\n=== SAMPLE ORDERS WITH INVOICES ===");
  for (const o of orders) {
    console.log(`Order: ${o.id.slice(0, 8)} | Inv: ${o.invoice?.invoiceNo} (₹${o.invoice?.grandTotal}) | Chemist: ${o.chemist?.name} (Territory: ${o.chemist?.territory?.name}, Terr Emp: ${o.chemist?.territory?.employeeId}) | Booked By Emp: ${o.employee?.firstName} ${o.employee?.lastName} (${o.employeeId})`);
  }

  // Check Collections in DB
  const collections = await db.collection.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      chemist: { select: { id: true, name: true, territoryId: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  console.log("\n=== RECENT 10 COLLECTIONS ===");
  for (const c of collections) {
    console.log(`Collection ${c.id.slice(0, 8)} | Amount: ${c.amount} | Ref: ${c.refNumber} | Chemist: ${c.chemist?.name} | MR: ${c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : "NONE"}`);
  }

  // Check AppModule for credit and collections
  const modules = await db.appModule.findMany({
    where: {
      OR: [
        { href: { contains: "collection" } },
        { href: { contains: "credit" } },
        { code: { contains: "collection" } },
        { code: { contains: "credit" } },
      ],
    },
  });
  console.log("\n=== CREDIT / COLLECTION APP MODULES ===");
  for (const m of modules) {
    console.log(`Module: ${m.code.padEnd(20)} | Label: ${m.label.padEnd(25)} | Href: ${m.href.padEnd(20)} | Roles: ${JSON.stringify(m.roles)} | Active: ${m.isActive}`);
  }

  process.exit(0);
}

main().catch(console.error);
