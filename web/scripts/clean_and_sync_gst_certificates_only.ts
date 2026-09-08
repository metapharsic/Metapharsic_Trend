import { db } from "../lib/db";
import fs from "fs";
import path from "path";

async function cleanAndSyncGstOnly() {
  console.log("Cleaning out dummy sample documents and syncing ONLY GST Certificate & Certificates files...");

  // 1. Delete all existing DMS records (documents, versions, workflows, audit trails)
  await db.dmsAuditTrail.deleteMany({});
  await db.dmsWorkflow.deleteMany({});
  await db.dmsVersion.deleteMany({});
  await db.dmsDocument.deleteMany({});
  console.log("Deleted all legacy dummy DMS records from database.");

  // 2. Define the exact set of 23 official files from GST Certificate & Certificates
  const gstFiles = [
    {
      id: "GST-DOC-001",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\GST CERTIFICATE.pdf",
      destRelPath: "/uploads/company-formation/gst/GST CERTIFICATE.pdf",
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
      id: "GST-DOC-002",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Drug_license.pdf",
      title: "State Wholesale & Retail Drug License",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.2",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days -> Alert
      authorName: "Drugs Control Inspectorate",
      notes: "State Wholesale Drug Distribution License",
    },
    {
      id: "GST-DOC-003",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\ISO 9001.pdf",
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
      id: "GST-DOC-004",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\METAPHARSIC LIFESCIENCES MSME 5 PAGES.pdf",
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
      id: "GST-DOC-005",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\TRADE CERTIFICATE.pdf",
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
      id: "GST-DOC-006",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\LB CERTIFICATE.pdf",
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
      id: "GST-DOC-007",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Partnership deed .pdf",
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
      id: "GST-DOC-008",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Partnership deed1-4  .pdf",
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
      id: "GST-DOC-009",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Rental Agreement.pdf",
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
      id: "GST-DOC-010",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\NOC of Rental Agreement.pdf",
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
      id: "GST-DOC-011",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Property Tax Receipt.pdf",
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
      id: "GST-DOC-012",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Electricity Bill Receipt.pdf",
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
      id: "GST-DOC-013",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Attested copy of aadhar card Ma Khader.pdf",
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
      id: "GST-DOC-014",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Attested copy of aadhar card Property Tax.pdf",
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
      id: "GST-DOC-015",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Attested copy of aadhar card Shafiya Begum.pdf",
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
      id: "GST-DOC-016",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\GST Certificate\\Attested copy of aadhar card Taranum Fatima.pdf",
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
      id: "CERT-DOC-001",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\Drug License on form No. 25 & 28 MBC.pdf",
      title: "Pharma Manufacturing & Sale License (Form 25 & 28)",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "2.0",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days -> Alert
      authorName: "Drugs Control Administration",
      notes: "Statutory License for Form 25 & 28 Pharmaceutical Formulations",
    },
    {
      id: "CERT-DOC-002",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\GMP & GLP 09.05.2027 to 01.09.2026  Latest.pdf",
      title: "WHO-GMP & GLP Quality Certification",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "3.1",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days -> Alert
      authorName: "State Licensing & Inspection Authority",
      notes: "WHO-GMP & Good Laboratory Practice (GLP) Renewal Compliance Certificate",
    },
    {
      id: "CERT-DOC-003",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\latest WHO-GMP.pdf",
      title: "WHO-GMP Compliance Certificate (Latest Edition)",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "3.0",
      status: "Expiring" as const,
      expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days -> Alert
      authorName: "WHO Licensing Board",
      notes: "World Health Organization Good Manufacturing Practice Certification",
    },
    {
      id: "CERT-DOC-004",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\Drug Licence Retention.pdf",
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
      id: "CERT-DOC-005",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\Market Standing Certificate 18.10.2023.pdf",
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
      id: "CERT-DOC-006",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\Non Conviction Certificate.pdf",
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
      id: "CERT-DOC-007",
      srcPath: "C:\\Metapharsic_Life_Science\\Company formation\\Certificates\\GST Registrationn Certificate.pdf",
      destRelPath: "/uploads/company-formation/certificates/GST Registrationn Certificate.pdf",
      title: "GST Tax Department Registration Certificate (Signed)",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-12-31"),
      authorName: "Commercial Tax Officer",
      notes: "Official Signed Copy of GST Registration",
    },
  ];

  console.log(`Provisioning exactly ${gstFiles.length} GST Certificate & Certificates documents...`);

  for (const item of gstFiles) {
    const destRelPath = item.destRelPath || (
      item.srcPath.includes("GST Certificate")
        ? `/uploads/company-formation/gst/${path.basename(item.srcPath)}`
        : `/uploads/company-formation/certificates/${path.basename(item.srcPath)}`
    );
    const fullAbsDest = path.join(process.cwd(), "public", destRelPath.replace(/^\//, "").replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(fullAbsDest), { recursive: true });

    if (fs.existsSync(item.srcPath)) {
      fs.copyFileSync(item.srcPath, fullAbsDest);
    } else {
      console.warn(`Source missing: ${item.srcPath}`);
    }

    let fileSize = BigInt(1024);
    if (fs.existsSync(fullAbsDest)) {
      fileSize = BigInt(fs.statSync(fullAbsDest).size);
    }

    const fileName = path.basename(destRelPath);

    await db.dmsDocument.create({
      data: {
        id: item.id,
        title: item.title,
        category: item.category,
        fileType: item.fileType,
        currentVersion: item.currentVersion,
        status: item.status,
        expiryDate: item.expiryDate,
        authorName: item.authorName,
        fileUrl: destRelPath,
        fileName: fileName,
        fileSize: fileSize,
        notes: item.notes,
      },
    });

    await db.dmsVersion.create({
      data: {
        documentId: item.id,
        versionLabel: item.currentVersion,
        fileUrl: destRelPath,
        fileSizeBytes: fileSize,
        changeLog: "Official Company Formation & GST Registration Filing",
        uploadedName: item.authorName,
        approvedBy: "Legal & Regulatory Compliance Head",
        approvalDate: new Date(),
      },
    });

    await db.dmsAuditTrail.create({
      data: {
        documentId: item.id,
        action: "Created",
        userName: item.authorName,
        details: `Official document "${item.title}" registered (${fileName})`,
        ipAddress: "127.0.0.1",
      },
    });
  }

  const finalCount = await db.dmsDocument.count();
  console.log(`🎉 SUCCESS! Cleaned all dummy documents. Total DMS Documents in DB: ${finalCount}`);
}

cleanAndSyncGstOnly().catch(console.error).finally(() => process.exit());
