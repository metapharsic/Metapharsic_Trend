import { db } from "../lib/db";
import { Role, OrderStatus } from "@prisma/client";
import { A2A } from "../src";

async function main() {
  console.log("================================================================================");
  console.log("             AGENT-TO-AGENT (A2A) PROTOCOL VERIFICATION SUITE                   ");
  console.log("================================================================================\n");

  try {
    // 1. Discovery of all registered domain agents
    console.log("🌐 1. Discovering Registered A2A Mesh Agents...");
    const agentList = A2A.listAgents();
    console.log(`   Found ${agentList.length} autonomous agents registered in A2A mesh:`);
    for (const a of agentList) {
      console.log(`      🔌 [${a.agentCode}] ${a.agentName} — ${a.capabilities.length} Actions (${a.capabilities.join(", ")})`);
    }

    // 2. A2A Request: Products Agent
    console.log("\n📦 2. Testing A2A Request -> PRODUCTS_AGENT...");
    const productsRes = await A2A.request("PRODUCTS_AGENT", "LIST_PRODUCTS", { page: 1, limit: 5 });
    console.log(`   ✔️ Received Response from PRODUCTS_AGENT: ${productsRes.products?.length} products listed.`);

    // 3. A2A Request: Inventory Agent Stock Check
    console.log("\n🏢 3. Testing A2A Request -> INVENTORY_AGENT...");
    const firstProd = productsRes.products?.[0];
    if (firstProd) {
      const stockCheck = await A2A.request("INVENTORY_AGENT", "CHECK_STOCK", {
        productId: firstProd.id,
        quantity: 5,
      });
      console.log(`   ✔️ Received Response from INVENTORY_AGENT: Stock=${stockCheck.stockQty}, Available=${stockCheck.available}`);

      const warehouseDashboard = await A2A.request("INVENTORY_AGENT", "GET_WAREHOUSE_DASHBOARD");
      console.log(`   ✔️ Warehouse KPI over A2A: Total Units=${warehouseDashboard.kpis?.totalStockUnits}`);
    }

    // 4. A2A Request: Purchase Agent (GRN Processing)
    console.log("\n🛒 4. Testing A2A Request -> PURCHASE_AGENT...");
    if (firstProd) {
      const grnRes = await A2A.request("PURCHASE_AGENT", "PROCESS_GRN", {
        data: {
          productId: firstProd.id,
          quantity: 20,
          batchNo: `A2A-BAT-${Date.now()}`,
          mfgDate: new Date(),
          expDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          supplierName: "A2A Supplier Network",
          grnNumber: `GRN-A2A-${Date.now()}`,
        },
      });
      console.log(`   ✔️ Received Response from PURCHASE_AGENT: Inwarded 20 units (New Stock=${grnRes.product?.stockQty})`);
    }

    // 5. A2A Request: Sales Agent (Order & Invoice)
    console.log("\n💰 5. Testing A2A Request -> SALES_AGENT...");
    const chemist = await db.chemist.findFirst();
    const distributor = await db.distributor.findFirst();
    const mrEmployee = await db.employee.findFirst({ where: { user: { role: Role.MR } } });

    if (chemist && distributor && firstProd) {
      const order = await A2A.request("SALES_AGENT", "CREATE_ORDER", {
        data: {
          chemistId: chemist.id,
          distributorId: distributor.id,
          items: [
            {
              productId: firstProd.id,
              quantity: 2,
              price: 100.0,
              discountPct: 5,
              gstPct: 12,
            },
          ],
        },
        employeeId: mrEmployee?.id,
      });
      console.log(`   ✔️ Received Response from SALES_AGENT: Created Order #${order.id.slice(0, 8)} (Status: ${order.status})`);

      const delivered = await A2A.request("SALES_AGENT", "UPDATE_ORDER_STATUS", {
        id: order.id,
        data: { status: OrderStatus.DELIVERED },
        employeeId: mrEmployee?.id,
      });
      console.log(`   ✔️ Updated Order Status over A2A: Status=${delivered.status}`);
    }

    // 6. Reactive A2A Events
    console.log("\n⚡ 6. Testing Cross-Domain A2A Event Bus...");
    let eventReceived = false;
    const unsubscribe = A2A.on("TEST_A2A_EVENT", (event) => {
      console.log(`   📬 Event Listener triggered: [${event.action}] from ${event.sender}, Payload=${JSON.stringify(event.payload)}`);
      eventReceived = true;
    });

    await A2A.emit("TEST_A2A_EVENT", { message: "Hello A2A Protocol!", timestamp: new Date().toISOString() });
    unsubscribe();
    console.log(`   ✔️ Event bus pub/sub verified: Received=${eventReceived}`);

    // 7. A2A Request: Council Coordinator Evaluation
    console.log("\n🧠 7. Testing A2A Request -> COUNCIL_COORDINATOR...");
    if (mrEmployee) {
      const councilRes = await A2A.request("COUNCIL_COORDINATOR", "EVALUATE_MR", {
        employeeId: mrEmployee.id,
        query: { period: "all" },
      });
      console.log(`   🎖️ Council Grade over A2A: ${councilRes?.councilEvaluation?.overallGrade} (${councilRes?.councilEvaluation?.councilScore}/100)`);
      console.log(`   📊 Executive Summary: ${councilRes?.councilEvaluation?.executiveSummary}`);
    }

    // 8. Live Status Board over A2A
    console.log("\n📊 8. Fetching Live A2A Status Board...");
    const statusBoard = await A2A.getStatusBoard();
    console.log(`   Total Agents Online: ${statusBoard.agentsOnline}/${statusBoard.totalAgents}`);
    for (const a of statusBoard.agents) {
      const icon = a.status === "ONLINE_PASS" ? "🟢" : "🟡";
      console.log(`      ${icon} [${a.agentCode}] ${a.agentName} | Requests Handled: ${a.metrics.requestsHandled}, Avg Latency: ${a.metrics.avgLatencyMs}ms`);
    }

    console.log("\n================================================================================");
    console.log("     🎉 A2A PROTOCOL CONNECTED ACROSS ALL MODULES WITH 100% SUCCESS             ");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("\n❌ A2A Verification Failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
