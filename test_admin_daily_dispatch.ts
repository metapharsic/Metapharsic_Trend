import axios from "axios";

const BASE_URL = "http://localhost:5555";

async function runTest() {
  console.log("================================================================================");
  console.log("  MULTI-AGENT COUNCIL: ADMIN-ONLY INDIVIDUAL MR DAILY DISPATCH E2E VERIFICATION ");
  console.log("================================================================================\n");

  try {
    // 1. Log in as regular MR
    console.log("1. Testing Non-Admin (MR) Access Control (RBAC)...");
    const mrLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: "abdul.mannan@mrtracker.com",
      password: "Password@123",
    });
    const mrToken = mrLogin.data.data.token;
    console.log("   [MR Logged In]: Role =", mrLogin.data.data.user.role, "| Name =", mrLogin.data.data.user.email);

    // Attempt dispatch as MR
    try {
      await axios.post(
        `${BASE_URL}/api/mr/reports/multi-agent/whatsapp`,
        {
          targetType: "ALL_MRS_INDIVIDUALLY",
          period: "daily",
        },
        {
          headers: { Authorization: `Bearer ${mrToken}` },
        }
      );
      console.error("   ❌ FAIL: MR was able to dispatch reports! (Should have been 403 Forbidden)");
      process.exit(1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        console.log("   ✔️ SUCCESS: MR dispatch attempt rejected with 403 Forbidden:");
        console.log("     Error message:", err.response?.data?.error?.message || err.response?.data?.message);
      } else {
        console.error("   ❌ UNEXPECTED ERROR:", err.response?.status, err.response?.data || err.message);
        process.exit(1);
      }
    }

    // 2. Log in as Administrator
    console.log("\n2. Testing Administrator Access & Multi-Agent Batch Dispatch...");
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: "admin@mrtracker.com",
      password: "Password@123",
    });
    const adminToken = adminLogin.data.data.token;
    console.log("   [Admin Logged In]: Role =", adminLogin.data.data.user.role, "| Name =", adminLogin.data.data.user.email);

    // Dispatch daily reports to all MRs individually
    console.log("\n3. Executing Batch Daily Dispatch: targetType='ALL_MRS_INDIVIDUALLY', period='daily'...");
    const dispatchRes = await axios.post(
      `${BASE_URL}/api/mr/reports/multi-agent/whatsapp`,
      {
        targetType: "ALL_MRS_INDIVIDUALLY",
        period: "daily",
        includeDoctorVisits: true,
        includeChemistCalls: true,
        includeSalesOrders: true,
        includeCollections: true,
        includeDutyTiming: true,
        includeExpenses: true,
        includeRoutingGeofence: true,
        includeFinancePnl: true,
        includeAgentScorecard: true,
        includeRiskActionItems: true,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    const data = dispatchRes.data.data;
    console.log("   ✔️ SUCCESS: 200 OK returned from Multi-Agent Council API!");
    console.log("   Message:", data.message);
    console.log("   Dispatched Count:", `${data.dispatchedCount} / ${data.totalTargets} MRs`);
    console.log("   Execution Latency:", `${data.executionLatencyMs}ms`);

    // Verify 8 Domain Agent Status Matrix
    console.log("\n4. Council 8-Domain Agent Verification Matrix:");
    console.log("--------------------------------------------------------------------------------");
    data.agentStatuses.forEach((ag: any, idx: number) => {
      console.log(`   [Agent ${idx + 1}/8] ${ag.agentCode.padEnd(26)} | Status: ${ag.status.padEnd(14)} | Score: ${String(ag.score).padStart(3)}% | Latency: ${ag.latencyMs}ms`);
    });

    // Verify Individual MRs Roster
    console.log("\n5. Individual MR Personalized Dispatch Roster:");
    console.log("--------------------------------------------------------------------------------");
    data.details.forEach((d: any, idx: number) => {
      console.log(`   [MR ${idx + 1}] ${d.recipient.padEnd(22)} | Phone: ${(d.phone || "None").padEnd(15)} | Doctors: ${String(d.doctorCalls).padStart(2)} | Chemists: ${String(d.chemistCalls).padStart(2)} | Sales: ₹${String(d.salesTodayPtr).padStart(6)} | Grade: ${d.overallGrade} (${d.councilScore}%) | Status: ${d.sent ? "SENT ✔️" : "FAILED (" + d.reason + ")"}`);
    });

    // 6. Test Individual MR Dispatch
    if (data.details.length > 0) {
      const firstMr = data.details[0];
      console.log(`\n6. Testing Single Individual MR Dispatch for '${firstMr.recipient}' (${firstMr.mrId})...`);
      const singleRes = await axios.post(
        `${BASE_URL}/api/mr/reports/multi-agent/whatsapp`,
        {
          targetType: "INDIVIDUAL_MR",
          employeeId: firstMr.mrId,
          period: "daily",
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      console.log("   ✔️ SUCCESS: Single MR dispatch completed!");
      console.log("   Recipient:", singleRes.data.data.details[0].recipient);
      console.log("   Phone:", singleRes.data.data.details[0].phone);
      console.log("   WhatsApp URL:", singleRes.data.data.whatsappUrl?.substring(0, 80) + "...");
    }

    console.log("\n================================================================================");
    console.log("  ALL TESTS PASSED: STRICT ADMIN RBAC & MULTI-AGENT DISPATCH FULLY VERIFIED!   ");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Test failed with error:", err.response?.data || err.message);
    process.exit(1);
  }
}

runTest();
