import { db } from "../lib/db";

async function main() {
  console.log("Updating DMS document file URLs and names in database...");

  const updates = [
    { id: "DOC-001", fileUrl: "/uploads/dms/DOC-001-v2.1.pdf", fileName: "DOC-001-v2.1.pdf", fileSize: 2516582 },
    { id: "DOC-004", fileUrl: "/uploads/dms/DOC-004-v1.pdf", fileName: "DOC-004-v1.pdf", fileSize: 1153433 },
    { id: "DOC-005", fileUrl: "/uploads/dms/DOC-005-v1.2.docx", fileName: "DOC-005-v1.2.docx", fileSize: 838860 },
    { id: "DOC-007", fileUrl: "/uploads/dms/DOC-007-v1.pdf", fileName: "DOC-007-v1.pdf", fileSize: 4718592 },
    { id: "DOC-008", fileUrl: "/uploads/dms/DOC-008-v1.xlsx", fileName: "DOC-008-v1.xlsx", fileSize: 3355443 },
    { id: "DOC-009", fileUrl: "/uploads/dms/DOC-009-v3.pdf", fileName: "DOC-009-v3.pdf", fileSize: 6081740 },
    { id: "DOC-010", fileUrl: "/uploads/dms/DOC-010-v2.pdf", fileName: "DOC-010-v2.pdf", fileSize: 1572864 },
  ];

  for (const item of updates) {
    const res = await db.dmsDocument.updateMany({
      where: { id: item.id },
      data: {
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        fileSize: BigInt(item.fileSize),
      },
    });
    console.log(`Updated ${item.id}:`, res.count);
  }

  // Also remove duplicate DOC-0000x placeholders if any exist
  const del = await db.dmsDocument.deleteMany({
    where: { id: { startsWith: "DOC-0000" } },
  });
  console.log("Deleted duplicate DOC-0000x placeholders:", del.count);

  // Upsert Certificates and HR files into DMS
  const certs = [
    {
      id: "DOC-CERT-001",
      title: "GST Certificate - American Airlines Services India LLP",
      category: "License" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2027-12-31"),
      authorName: "Finance / Compliance Team",
      fileUrl: "/uploads/certificates/1780850803222_GST_CERTIFICATE.pdf",
      fileName: "1780850803222_GST_CERTIFICATE.pdf",
      fileSize: BigInt(244494),
      notes: "GST Registration Certificate",
    },
    {
      id: "DOC-CERT-002",
      title: "American Airlines Services India LLP Agreement",
      category: "Compliance" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: new Date("2028-06-30"),
      authorName: "Legal Department",
      fileUrl: "/uploads/certificates/1780338875966_American_Airlines_Services_India_LLP__3_.pdf",
      fileName: "1780338875966_American_Airlines_Services_India_LLP__3_.pdf",
      fileSize: BigInt(1746584),
      notes: "Corporate Partnership Agreement",
    },
    {
      id: "DOC-HR-001",
      title: "Employee Intermediate Certificate",
      category: "Report" as const,
      fileType: "PDF",
      currentVersion: "1.0",
      status: "Active" as const,
      expiryDate: null,
      authorName: "HR Department",
      fileUrl: "/uploads/hr/92d8ba25-5a31-47bc-be44-980bdb0bad7e/1780333537664-Intermediate Certificate.pdf",
      fileName: "1780333537664-Intermediate Certificate.pdf",
      fileSize: BigInt(3774920),
      notes: "HR Educational Record Certificate",
    },
  ];

  for (const c of certs) {
    await db.dmsDocument.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
    console.log(`Upserted ${c.id}`);
  }

  const all = await db.dmsDocument.findMany({ select: { id: true, title: true, fileUrl: true, fileName: true, fileSize: true } });
  console.log("Final DMS Documents in Database:");
  console.table(all.map(d => ({ ...d, fileSize: d.fileSize.toString() })));
}

main().catch(console.error).finally(() => process.exit());
