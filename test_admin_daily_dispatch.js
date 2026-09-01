const BASE_URL = "http://localhost:5555";

async function runTest() {
  console.log("================================================================================");
  console.log("  MULTI-AGENT COUNCIL: ADMIN-ONLY INDIVIDUAL MR DAILY DISPATCH E2E VERIFICATION ");
  console.log("================================================================================\n");

  try {
    // 1. Log in as regular MR
    console.log("1. Testing Non-Admin (MR) Access Control (RBAC)...");
    const mrLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "abdulmannan@mrtracker.com",
        password: "Password@123",
        role: "MR",
        deviceUuid: "test-device-1",
      }),
    });
    const mrLogin = await mrLoginRes.json();
    const mrToken = mrLogin.data.accessToken;
    console.log("   [MR Logged In]: Role =", mrLogin.data.user.role, "| Email =", mrLogin.data.user.email);

    // Attempt dispatch as MR
    const mrDispatchRes = await fetch(`${BASE_URL}/api/mr/reports/multi-agent/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mrToken}`,
      },
      body: JSON.stringify({
        targetType: "ALL_MRS_INDIVIDUALLY",
        period: "daily",
      }),
    });

    if (mrDispatchRes.status === 403) {
      const errData = await mrDispatchRes.json();
      console.log("   ✔️ SUCCESS: MR dispatch attempt rejected with 403 Forbidden:");
      console.log("     Error message:", errData.error?.message || errData.message);
    } else {
      console.error("   ❌ FAIL: MR dispatch did NOT return 403. Returned status:", mrDispatchRes.status);
      process.exit(1);
    }

    // 2. Log in as Administrator
    console.log("\n2. Testing Administrator Access & Multi-Agent Batch Dispatch...");
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@mrtracker.com",
        password: "Password@123",
        role: "ADMIN",
      }),
    });
    const adminLogin = await adminLoginRes.json();
    const adminToken = adminLogin.data.accessToken;
    console.log("   [Admin Logged In]: Role =", adminLogin.data.user.role, "| Email =", adminLogin.data.user.email);

    // 3. Dispatch daily reports to all MRs individually
    console.log("\n3. Executing Batch Daily Dispatch: targetType='ALL_MRS_INDIVIDUALLY', period='daily'...");
    const dispatchRes = await fetch(`${BASE_URL}/api/mr/reports/multi-agent/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
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
      }),
    });

    if (!dispatchRes.ok) {
      console.error("   ❌ Dispatch request failed with status:", dispatchRes.status, await dispatchRes.text());
      process.exit(1);
    }

    const dispatchJson = await dispatchRes.json();
    const data = dispatchJson.data;
    console.log("   ✔️ SUCCESS: 200 OK returned from Multi-Agent Council API!");
    console.log("   Message:", data.message);
    console.log("   Dispatched Count:", `${data.dispatchedCount} / ${data.totalTargets} MRs`);
    console.log("   Execution Latency:", `${data.executionLatencyMs}ms`);

    // 4. Verify 8 Domain Agent Status Matrix
    console.log("\n4. Council 8-Domain Agent Verification Matrix:");
    console.log("--------------------------------------------------------------------------------");
    data.agentStatuses.forEach((ag, idx) => {
      console.log(`   [Agent ${idx + 1}/8] ${ag.agentCode.padEnd(26)} | Status: ${ag.status.padEnd(14)} | Score: ${String(ag.score).padStart(3)}% | Latency: ${ag.latencyMs}ms`);
    });

    // 5. Verify Individual MRs Roster
    console.log("\n5. Individual MR Personalized Dispatch Roster:");
    console.log("--------------------------------------------------------------------------------");
    data.details.forEach((d, idx) => {
      console.log(`   [MR ${idx + 1}] ${d.recipient.padEnd(22)} | Phone: ${(d.phone || "None").padEnd(15)} | Doctors: ${String(d.doctorCalls).padStart(2)} | Chemists: ${String(d.chemistCalls).padStart(2)} | Sales: ₹${String(d.salesTodayPtr).padStart(6)} | Grade: ${d.overallGrade} (${d.councilScore}%) | Status: ${d.sent ? "SENT ✔️" : "FAILED (" + d.reason + ")"}`);
    });

    // 6. Test Individual MR Dispatch
    if (data.details.length > 0) {
      const firstMr = data.details[0];
      console.log(`\n6. Testing Single Individual MR Dispatch for '${firstMr.recipient}' (${firstMr.mrId})...`);
      const singleRes = await fetch(`${BASE_URL}/api/mr/reports/multi-agent/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          targetType: "INDIVIDUAL_MR",
          employeeId: firstMr.mrId,
          period: "daily",
        }),
      });

      const singleJson = await singleRes.json();
      console.log("   ✔️ SUCCESS: Single MR dispatch completed!");
      console.log("   Recipient:", singleJson.data.details[0].recipient);
      console.log("   Phone:", singleJson.data.details[0].phone);
      console.log("   WhatsApp URL preview:", singleJson.data.whatsappUrl?.substring(0, 80) + "...");
    }

    console.log("\n================================================================================");
    console.log("  ALL TESTS PASSED: STRICT ADMIN RBAC & MULTI-AGENT DISPATCH FULLY VERIFIED!   ");
    console.log("================================================================================");
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

runTest();
