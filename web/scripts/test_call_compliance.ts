import { db } from "../lib/db";
import { CallComplianceAgentsService } from "../services/call-compliance-agents.service";

async function runComplianceTests() {
  console.log("================================================================");
  console.log("    CALL COMPLIANCE, MANDATORY PHONE & SILENT GPS VERIFICATION  ");
  console.log("================================================================\n");

  // 1. Test PhoneVerificationAgent
  console.log("--- 1. Testing PhoneVerificationAgent ---");
  const emptyCheck = CallComplianceAgentsService.verifyMandatoryPhone("");
  console.log("Empty phone check (should fail):", !emptyCheck.isValid, "| Error:", emptyCheck.error);
  if (emptyCheck.isValid) throw new Error("Empty phone was marked valid!");

  const shortCheck = CallComplianceAgentsService.verifyMandatoryPhone("12345");
  console.log("Short phone check (should fail):", !shortCheck.isValid, "| Error:", shortCheck.error);
  if (shortCheck.isValid) throw new Error("Short phone was marked valid!");

  const validCheck = CallComplianceAgentsService.verifyMandatoryPhone("+91 98765-43210");
  console.log("Formatted phone check (should pass):", validCheck.isValid, "| Clean:", validCheck.cleanPhone);
  if (!validCheck.isValid || validCheck.cleanPhone !== "9876543210") throw new Error("Formatted phone parsing failed!");

  // 2. Test SilentGpsTelemetryAgent
  console.log("\n--- 2. Testing SilentGpsTelemetryAgent ---");
  const noGps = CallComplianceAgentsService.processSilentGpsTelemetry({ latitude: 0, longitude: 0 });
  console.log("Zero GPS coords (not mandatory, should be graceful):", {
    hasGps: noGps.hasGps,
    locationUnavailable: noGps.locationUnavailable,
  });
  if (noGps.hasGps || !noGps.locationUnavailable) throw new Error("Zero GPS was marked as hasGps!");

  const activeGps = CallComplianceAgentsService.processSilentGpsTelemetry({
    latitude: 17.385044,
    longitude: 78.486671,
    accuracy: 12.5,
  });
  console.log("Active GPS coords (captured silently):", {
    hasGps: activeGps.hasGps,
    lat: activeGps.latitude,
    lon: activeGps.longitude,
    accuracy: activeGps.accuracyMeters,
  });
  if (!activeGps.hasGps || activeGps.locationUnavailable) throw new Error("Active GPS was not captured!");

  // 3. Test EntityContactSyncAgent on database
  console.log("\n--- 3. Testing EntityContactSyncAgent DB Synchronization ---");
  const doctor = await db.doctor.findFirst({ select: { id: true, fullName: true, mobile: true, whatsApp: true } });
  if (doctor) {
    console.log(`Original Doctor: ${doctor.fullName} | Mobile: ${doctor.mobile}`);
    const testPhone = "9988776655";
    const syncRes = await CallComplianceAgentsService.syncEntityContactNumber({
      doctorId: doctor.id,
      phone: testPhone,
    });
    console.log("Sync response:", syncRes);

    const updatedDoc = await db.doctor.findUnique({
      where: { id: doctor.id },
      select: { mobile: true, whatsApp: true },
    });
    console.log(`Updated Doctor in DB | Mobile: ${updatedDoc?.mobile} | WhatsApp: ${updatedDoc?.whatsApp}`);
    if (updatedDoc?.mobile !== testPhone) throw new Error("Doctor phone was not synced!");
  }

  // 4. Test Admin Compliance Audit Formatter
  console.log("\n--- 4. Testing AdminComplianceAuditAgent ---");
  const auditLog = CallComplianceAgentsService.formatAdminAuditLog({
    id: "sample-visit-id",
    latitude: 17.385044,
    longitude: 78.486671,
    locationUnavailable: false,
    doctor: { fullName: "Dr. Sample", mobile: "9988776655" },
  });
  console.log("Admin Audit Log Output:", auditLog);
  if (!auditLog.hasGps || !auditLog.googleMapsUrl) throw new Error("Admin audit log formatting failed!");

  console.log("\n================================================================");
  console.log("  ALL CALL COMPLIANCE, PHONE & SILENT GPS TESTS PASSED (100%)  ");
  console.log("================================================================");
}

runComplianceTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
