import { db } from "../lib/db";
import { DmsCategory, DmsStatus, DmsWorkflowStep, DmsWorkflowStatus, DmsAuditAction } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

async function seedDms() {
  console.log("Seeding complete DMS package data into PostgreSQL database...");

  // Ensure public/uploads/dms directory exists
  const publicDmsDir = path.join(process.cwd(), "public", "uploads", "dms");
  if (!fs.existsSync(publicDmsDir)) {
    fs.mkdirSync(publicDmsDir, { recursive: true });
  }

  // Copy sample upload files if present in dms_extracted
  const sampleUploadDir = path.join(process.cwd(), "..", "dms_extracted", "uploads", "dms");
  if (fs.existsSync(sampleUploadDir)) {
    const files = fs.readdirSync(sampleUploadDir);
    for (const f of files) {
      const src = path.join(sampleUploadDir, f);
      const dest = path.join(publicDmsDir, f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
      }
    }
  }

  const documents = [
    {
      id: "DOC-001",
      title: "SOP for Tablet Compression",
      category: DmsCategory.SOP,
      fileType: "PDF",
      currentVersion: "2.1",
      status: DmsStatus.Active,
      expiryDate: new Date("2027-10-15"),
      authorName: "Dr. R. Singh",
      fileUrl: "/uploads/dms/DOC-001-v2.1.pdf",
      fileName: "DOC-001-v2.1.pdf",
      fileSize: BigInt(2516582),
    },
    {
      id: "DOC-004",
      title: "Fire Safety Certificate",
      category: DmsCategory.License,
      fileType: "PDF",
      currentVersion: "1.0",
      status: DmsStatus.Active,
      expiryDate: new Date("2026-12-31"),
      authorName: "Safety Officer",
      fileSize: BigInt(1153433),
    },
    {
      id: "DOC-005",
      title: "Employee Hygiene Policy",
      category: DmsCategory.Policy,
      fileType: "DOCX",
      currentVersion: "1.2",
      status: DmsStatus.Active,
      expiryDate: new Date("2026-11-15"),
      authorName: "HR Manager",
      fileSize: BigInt(838860),
    },
    {
      id: "DOC-007",
      title: "Equipment Validation Protocol",
      category: DmsCategory.Compliance,
      fileType: "PDF",
      currentVersion: "1.0",
      status: DmsStatus.Pending,
      expiryDate: new Date("2026-07-25"),
      authorName: "Validation Team",
      fileSize: BigInt(4718592),
    },
    {
      id: "DOC-008",
      title: "Annual Environmental Compliance Report",
      category: DmsCategory.Report,
      fileType: "XLSX",
      currentVersion: "1.0",
      status: DmsStatus.Pending,
      expiryDate: new Date("2026-11-25"),
      authorName: "EHS Head",
      fileSize: BigInt(3355443),
    },
    {
      id: "DOC-009",
      title: "GMP Training Manual",
      category: DmsCategory.Policy,
      fileType: "PDF",
      currentVersion: "3.0",
      status: DmsStatus.Active,
      expiryDate: new Date("2027-06-15"),
      authorName: "Training Coordinator",
      fileSize: BigInt(6081740),
    },
    {
      id: "DOC-010",
      title: "Material Safety Data Sheet - API",
      category: DmsCategory.Compliance,
      fileType: "PDF",
      currentVersion: "2.0",
      status: DmsStatus.Active,
      expiryDate: new Date("2027-09-25"),
      authorName: "QC Department",
      fileSize: BigInt(1572864),
    },
  ];

  for (const doc of documents) {
    await db.dmsDocument.upsert({
      where: { id: doc.id },
      update: doc,
      create: doc,
    });
  }

  const versions = [
    {
      documentId: "DOC-001",
      versionLabel: "1.0",
      fileUrl: "/uploads/dms/DOC-001-v1.pdf",
      fileSizeBytes: BigInt(2097152),
      changeLog: "Initial SOP release",
      uploadedName: "Dr. R. Singh",
      approvedBy: "QA Head",
      approvalDate: new Date("2022-01-15T10:00:00Z"),
    },
    {
      documentId: "DOC-001",
      versionLabel: "2.0",
      fileUrl: "/uploads/dms/DOC-001-v2.pdf",
      fileSizeBytes: BigInt(2411724),
      changeLog: "Updated compression parameters",
      uploadedName: "Dr. R. Singh",
      approvedBy: "QA Head",
      approvalDate: new Date("2023-05-10T14:30:00Z"),
    },
    {
      documentId: "DOC-001",
      versionLabel: "2.1",
      fileUrl: "/uploads/dms/DOC-001-v2.1.pdf",
      fileSizeBytes: BigInt(2516582),
      changeLog: "Minor adjustments for humidity thresholds",
      uploadedName: "Dr. R. Singh",
      approvedBy: "Quality Head",
      approvalDate: new Date("2023-10-16T16:45:00Z"),
    },
    {
      documentId: "DOC-005",
      versionLabel: "1.0",
      fileUrl: "/uploads/dms/DOC-005-v1.docx",
      fileSizeBytes: BigInt(734003),
      changeLog: "Original hygiene policy draft",
      uploadedName: "HR Manager",
      approvedBy: "Operations Lead",
      approvalDate: new Date("2022-06-01T09:00:00Z"),
    },
    {
      documentId: "DOC-005",
      versionLabel: "1.2",
      fileUrl: "/uploads/dms/DOC-005-v1.2.docx",
      fileSizeBytes: BigInt(838860),
      changeLog: "Updated for new statutory regulations",
      uploadedName: "HR Manager",
      approvedBy: "HR Director",
      approvalDate: new Date("2023-09-12T16:00:00Z"),
    },
  ];

  for (const ver of versions) {
    const existing = await db.dmsVersion.findFirst({
      where: { documentId: ver.documentId, versionLabel: ver.versionLabel },
    });
    if (!existing) {
      await db.dmsVersion.create({ data: ver });
    }
  }

  const workflows = [
    {
      id: "WF-001",
      documentId: "DOC-005",
      documentTitle: "Employee Hygiene Policy",
      currentStep: DmsWorkflowStep.Review,
      assignedTo: "HR Manager",
      dueDate: new Date("2026-11-15"),
      status: DmsWorkflowStatus.In_Progress,
    },
    {
      id: "WF-002",
      documentId: "DOC-008",
      documentTitle: "Annual Environmental Compliance Report",
      currentStep: DmsWorkflowStep.Approval,
      assignedTo: "EHS Head",
      dueDate: new Date("2026-11-25"),
      status: DmsWorkflowStatus.Pending,
    },
    {
      id: "WF-003",
      documentId: "DOC-001",
      documentTitle: "SOP for Tablet Compression",
      currentStep: DmsWorkflowStep.Published,
      assignedTo: "QA Manager",
      dueDate: new Date("2026-10-20"),
      status: DmsWorkflowStatus.Completed,
    },
    {
      id: "WF-004",
      documentId: "DOC-007",
      documentTitle: "Equipment Validation Protocol",
      currentStep: DmsWorkflowStep.Approval,
      assignedTo: "Validation Manager",
      dueDate: new Date("2026-07-25"),
      status: DmsWorkflowStatus.In_Progress,
    },
    {
      id: "WF-005",
      documentId: "DOC-009",
      documentTitle: "GMP Training Manual",
      currentStep: DmsWorkflowStep.Review,
      assignedTo: "Training Coordinator",
      dueDate: new Date("2026-07-05"),
      status: DmsWorkflowStatus.Completed,
    },
    {
      id: "WF-006",
      documentId: "DOC-004",
      documentTitle: "Fire Safety Certificate",
      currentStep: DmsWorkflowStep.Published,
      assignedTo: "Safety Officer",
      dueDate: new Date("2026-05-25"),
      status: DmsWorkflowStatus.Completed,
    },
    {
      id: "WF-007",
      documentId: "DOC-010",
      documentTitle: "Material Safety Data Sheet - API",
      currentStep: DmsWorkflowStep.Published,
      assignedTo: "QC Manager",
      dueDate: new Date("2026-10-05"),
      status: DmsWorkflowStatus.Completed,
    },
  ];

  for (const wf of workflows) {
    await db.dmsWorkflow.upsert({
      where: { id: wf.id },
      update: wf,
      create: wf,
    });
  }

  const auditTrails = [
    {
      id: "AT-001",
      documentId: "DOC-001",
      action: DmsAuditAction.Created,
      userId: "USR-001",
      userName: "Dr. R. Singh",
      details: "Document created with initial version 2.1",
      ipAddress: "192.168.1.100",
      createdAt: new Date("2026-10-15T09:30:00Z"),
    },
    {
      id: "AT-002",
      documentId: "DOC-001",
      action: DmsAuditAction.Viewed,
      userId: "USR-002",
      userName: "Production Manager",
      details: "Document viewed for implementation review",
      ipAddress: "192.168.1.105",
      createdAt: new Date("2026-10-15T10:15:00Z"),
    },
    {
      id: "AT-003",
      documentId: "DOC-001",
      action: DmsAuditAction.Modified,
      userId: "USR-001",
      userName: "Dr. R. Singh",
      details: "Updated version to 2.1 with new compression parameters",
      ipAddress: "192.168.1.100",
      createdAt: new Date("2026-10-16T14:20:00Z"),
    },
    {
      id: "AT-004",
      documentId: "DOC-001",
      action: DmsAuditAction.Approved,
      userId: "USR-003",
      userName: "Quality Head",
      details: "Document approved for implementation",
      ipAddress: "192.168.1.110",
      createdAt: new Date("2026-10-16T16:45:00Z"),
    },
    {
      id: "AT-005",
      documentId: "DOC-007",
      action: DmsAuditAction.Created,
      userId: "USR-004",
      userName: "Validation Team",
      details: "Equipment validation protocol created",
      ipAddress: "192.168.1.120",
      createdAt: new Date("2026-07-15T11:00:00Z"),
    },
    {
      id: "AT-006",
      documentId: "DOC-007",
      action: DmsAuditAction.Downloaded,
      userId: "USR-005",
      userName: "Validation Manager",
      details: "Document downloaded for review",
      ipAddress: "192.168.1.125",
      createdAt: new Date("2026-07-18T09:15:00Z"),
    },
    {
      id: "AT-007",
      documentId: "DOC-009",
      action: DmsAuditAction.Viewed,
      userId: "USR-006",
      userName: "Training Coordinator",
      details: "GMP training manual accessed for session preparation",
      ipAddress: "192.168.1.130",
      createdAt: new Date("2026-06-20T13:30:00Z"),
    },
    {
      id: "AT-008",
      documentId: "DOC-004",
      action: DmsAuditAction.Viewed,
      userId: "USR-007",
      userName: "Safety Officer",
      details: "Fire safety certificate reviewed during inspection",
      ipAddress: "192.168.1.135",
      createdAt: new Date("2026-05-20T10:45:00Z"),
    },
    {
      id: "AT-009",
      documentId: "DOC-010",
      action: DmsAuditAction.Created,
      userId: "USR-008",
      userName: "QC Department",
      details: "MSDS for API created with latest safety data",
      ipAddress: "192.168.1.140",
      createdAt: new Date("2026-09-30T15:20:00Z"),
    },
    {
      id: "AT-010",
      documentId: "DOC-005",
      action: DmsAuditAction.Modified,
      userId: "USR-009",
      userName: "HR Manager",
      details: "Employee hygiene policy updated for new regulations",
      ipAddress: "192.168.1.145",
      createdAt: new Date("2026-09-12T16:00:00Z"),
    },
  ];

  for (const audit of auditTrails) {
    await db.dmsAuditTrail.upsert({
      where: { id: audit.id },
      update: audit,
      create: audit,
    });
  }

  console.log("DMS full exported data seeding completed successfully!");
}

seedDms()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
