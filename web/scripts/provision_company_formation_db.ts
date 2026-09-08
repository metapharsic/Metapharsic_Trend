import { db } from "../lib/db";
import fs from "fs";
import path from "path";

async function provisionDatabase() {
  console.log("Provisioning database with real Company Formation & GST Certificate documents...");

  const baseDir = path.join(process.cwd(), "public", "uploads", "company-formation");

  const docDefs = [
    {
      id: "DOC-GST-001",
      fileRelPath: "/uploads/company-formation/gst/GST CERTIFICATE.pdf",
      title: "GST Registration Certificate (Metapharsic Life Sciences)",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-12-31"),
      authorName: "Central Board of Indirect Taxes & Customs",
      notes: "Official GSTIN Certificate for Metapharsic Life Sciences",
    },
    {
      id: "DOC-DRUG-001",
      fileRelPath: "/uploads/company-formation/certificates/Drug License on form No. 25 & 28 MBC.pdf",
      title: "Pharma Manufacturing & Sale License (Form 25 & 28)",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "2.0",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now -> 15-day alert!
      authorName: "Drugs Control Administration",
      notes: "Statutory License for Form 25 & 28 Pharmaceutical Formulations",
    },
    {
      id: "DOC-GMP-001",
      fileRelPath: "/uploads/company-formation/certificates/GMP & GLP 09.05.2027 to 01.09.2026  Latest.pdf",
      title: "WHO-GMP & GLP Quality Certification",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "3.1",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now -> 15-day alert!
      authorName: "State Licensing & Inspection Authority",
      notes: "WHO-GMP & Good Laboratory Practice (GLP) Renewal Compliance Certificate",
    },
    {
      id: "DOC-GMP-002",
      fileRelPath: "/uploads/company-formation/certificates/latest WHO-GMP.pdf",
      title: "WHO-GMP Compliance Certificate (Latest Edition)",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "3.0",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now -> 15-day alert!
      authorName: "WHO Licensing Board",
      notes: "World Health Organization Good Manufacturing Practice Certification",
    },
    {
      id: "DOC-DRUG-002",
      fileRelPath: "/uploads/company-formation/gst/Drug_license.pdf",
      title: "State Wholesale & Retail Drug License",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.2",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now -> 15-day alert!
      authorName: "Drugs Control Inspectorate",
      notes: "State Wholesale Drug Distribution License",
    },
    {
      id: "DOC-ISO-001",
      fileRelPath: "/uploads/company-formation/gst/ISO 9001.pdf",
      title: "ISO 9001:2015 Quality Management System Certificate",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-05-15"),
      authorName: "ISO International Registrar",
      notes: "Certified Quality System for Metapharsic Life Sciences",
    },
    {
      id: "DOC-MSME-001",
      fileRelPath: "/uploads/company-formation/gst/METAPHARSIC LIFESCIENCES MSME 5 PAGES.pdf",
      title: "Udyam MSME Registration Certificate (5 Pages)",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2028-12-31"),
      authorName: "Ministry of Micro, Small & Medium Enterprises",
      notes: "MSME Enterprise Udyam Registration Certificate",
    },
    {
      id: "DOC-DRUG-003",
      fileRelPath: "/uploads/company-formation/certificates/Drug Licence Retention.pdf",
      title: "Drug License Retention Fee Receipt & Certificate",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-03-31"),
      authorName: "Drugs Control Administration",
      notes: "Proof of annual retention fee payment for drug licenses",
    },
    {
      id: "DOC-DEED-001",
      fileRelPath: "/uploads/company-formation/gst/Partnership deed .pdf",
      title: "Metapharsic Life Sciences Partnership Deed",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Managing Partners & Legal Counsel",
      notes: "Original Constitutory Partnership Deed",
    },
    {
      id: "DOC-DEED-002",
      fileRelPath: "/uploads/company-formation/gst/Partnership deed1-4  .pdf",
      title: "Registered Partnership Deed (Pages 1-4)",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Registrar of Firms",
      notes: "Certified copy of partnership deed clauses 1 through 4",
    },
    {
      id: "DOC-LEASE-001",
      fileRelPath: "/uploads/company-formation/gst/Rental Agreement.pdf",
      title: "Registered Commercial Office Lease & Rental Agreement",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2026-10-01"),
      authorName: "Property Lessor & Metapharsic",
      notes: "Commercial Lease for Metapharsic Headquarters Premises",
    },
    {
      id: "DOC-LEASE-002",
      fileRelPath: "/uploads/company-formation/gst/NOC of Rental Agreement.pdf",
      title: "No Objection Certificate (NOC) for Commercial Premises",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Premises Owner",
      notes: "NOC for GST and Drug Licensing Office Registration",
    },
    {
      id: "DOC-TAX-001",
      fileRelPath: "/uploads/company-formation/gst/Property Tax Receipt.pdf",
      title: "Commercial Property Tax Clearance Receipt",
      category: "Report" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-03-31"),
      authorName: "Greater Municipal Corporation",
      notes: "Property tax payment receipt for registered office",
    },
    {
      id: "DOC-UTIL-001",
      fileRelPath: "/uploads/company-formation/gst/Electricity Bill Receipt.pdf",
      title: "Commercial Premises Electricity Utility Receipt",
      category: "Report" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2026-09-30"),
      authorName: "State Electricity Distribution Corp",
      notes: "Utility proof of address for regulatory filings",
    },
    {
      id: "DOC-TRADE-001",
      fileRelPath: "/uploads/company-formation/gst/TRADE CERTIFICATE.pdf",
      title: "Municipal Trade License Certificate",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2026-12-31"),
      authorName: "Municipal Licensing Officer",
      notes: "Commercial Trade Authorization Certificate",
    },
    {
      id: "DOC-LABOR-001",
      fileRelPath: "/uploads/company-formation/gst/LB CERTIFICATE.pdf",
      title: "Labor & Establishment Registration Certificate",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-06-30"),
      authorName: "Department of Labor",
      notes: "Shops & Establishments Registration License",
    },
    {
      id: "DOC-STAND-001",
      fileRelPath: "/uploads/company-formation/certificates/Market Standing Certificate 18.10.2023.pdf",
      title: "Pharma Market Standing & Track Record Certificate",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2026-10-18"),
      authorName: "Drugs Control Authority",
      notes: "3-Year Commercial Market Standing Certification",
    },
    {
      id: "DOC-CONV-001",
      fileRelPath: "/uploads/company-formation/certificates/Non Conviction Certificate.pdf",
      title: "Non-Conviction Certificate for Drug Licensing",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-01-15"),
      authorName: "Drug Licensing & Inspection Officer",
      notes: "Official Non-Conviction Certificate under Drugs & Cosmetics Rules",
    },
    {
      id: "DOC-GST-002",
      fileRelPath: "/uploads/company-formation/certificates/GST Registrationn Certificate.pdf",
      title: "GST Tax Department Registration Certificate (Signed)",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-12-31"),
      authorName: "Commercial Tax Officer",
      notes: "Official Signed Copy of GST Registration",
    },
    {
      id: "DOC-ID-001",
      fileRelPath: "/uploads/company-formation/gst/Attested copy of aadhar card Ma Khader.pdf",
      title: "Partner Identity Verification - Ma Khader (Aadhar)",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Metapharsic HR & Legal",
      notes: "Attested KYC Identity Proof for Partner Ma Khader",
    },
    {
      id: "DOC-ID-002",
      fileRelPath: "/uploads/company-formation/gst/Attested copy of aadhar card Property Tax.pdf",
      title: "Property Owner Identity Verification (Aadhar)",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Metapharsic HR & Legal",
      notes: "Attested KYC Proof for Office Property Owner",
    },
    {
      id: "DOC-ID-003",
      fileRelPath: "/uploads/company-formation/gst/Attested copy of aadhar card Shafiya Begum.pdf",
      title: "Partner Identity Verification - Shafiya Begum (Aadhar)",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Metapharsic HR & Legal",
      notes: "Attested KYC Identity Proof for Partner Shafiya Begum",
    },
    {
      id: "DOC-ID-004",
      fileRelPath: "/uploads/company-formation/gst/Attested copy of aadhar card Taranum Fatima.pdf",
      title: "Partner Identity Verification - Taranum Fatima (Aadhar)",
      category: "Policy" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Metapharsic HR & Legal",
      notes: "Attested KYC Identity Proof for Partner Taranum Fatima",
    },
    {
      id: "DOC-MANIFEST-001",
      fileRelPath: "/uploads/company-formation/master_control/Master_Project_Manifest.csv",
      title: "Metapharsic ERP Master Project Control Manifest",
      category: "SOP" as const,
      fileType: "CSV",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "System Architecture Board",
      notes: "Master Control Registry of Project Modules & Standards",
    },
    {
      id: "DOC-GOV-001",
      fileRelPath: "/uploads/company-formation/governance/Governance_Master_Tracker.csv",
      title: "Corporate Governance & Compliance Master Tracker",
      category: "Report" as const,
      fileType: "CSV",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Corporate Secretarial Desk",
      notes: "Compliance schedule and statutory register tracking log",
    },
    {
      id: "DOC-QA-001",
      fileRelPath: "/uploads/company-formation/qa_qc/QA_QC_Master_Tracker.csv",
      title: "QA/QC Pharmaceutical Quality Master Log",
      category: "Report" as const,
      fileType: "CSV",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "Quality Assurance Department",
      notes: "Log of BMR, BPR, CAPA, and QC batch release protocol trackers",
    },
  ];

  for (const doc of docDefs) {
    const fullAbsPath = path.join(process.cwd(), "public", doc.fileRelPath.replace(/^\//, "").replace(/\//g, path.sep));
    let fileSize = BigInt(1024);
    if (fs.existsSync(fullAbsPath)) {
      const stat = fs.statSync(fullAbsPath);
      fileSize = BigInt(stat.size);
    } else {
      console.warn(`File missing on disk: ${fullAbsPath}`);
    }

    const fileName = path.basename(doc.fileRelPath);

    await db.dmsDocument.upsert({
      where: { id: doc.id },
      update: {
        title: doc.title,
        category: doc.category,
        fileType: doc.fileType,
        currentVersion: doc.currentVersion,
        status: doc.status,
        expiryDate: doc.expiryDate,
        authorName: doc.authorName,
        fileUrl: doc.fileRelPath,
        fileName: fileName,
        fileSize: fileSize,
        notes: doc.notes,
      },
      create: {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        fileType: doc.fileType,
        currentVersion: doc.currentVersion,
        status: doc.status,
        expiryDate: doc.expiryDate,
        authorName: doc.authorName,
        fileUrl: doc.fileRelPath,
        fileName: fileName,
        fileSize: fileSize,
        notes: doc.notes,
      },
    });

    // Create initial version record if not present
    const existingVer = await db.dmsVersion.findFirst({
      where: { documentId: doc.id, versionLabel: doc.currentVersion },
    });

    if (!existingVer) {
      await db.dmsVersion.create({
        data: {
          documentId: doc.id,
          versionLabel: doc.currentVersion,
          fileUrl: doc.fileRelPath,
          fileSizeBytes: fileSize,
          changeLog: "Initial regulatory document registration",
          uploadedName: doc.authorName,
          approvedBy: "Legal & Regulatory Compliance Head",
          approvalDate: new Date(),
        },
      });
    }

    // Create audit record
    await db.dmsAuditTrail.create({
      data: {
        documentId: doc.id,
        action: "Created",
        userName: doc.authorName,
        details: `Document "${doc.title}" provisioned in DMS repository (${fileName})`,
        ipAddress: "127.0.0.1",
      },
    });
  }

  const count = await db.dmsDocument.count();
  console.log(`✅ Provisioning Complete! Total DMS Documents in DB: ${count}`);
}

provisionDatabase().catch(console.error).finally(() => process.exit());
