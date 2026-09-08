import fs from "fs";
import path from "path";

const SOURCE_BASE = "C:\\Metapharsic_Life_Science\\Company formation";
const DEST_BASE = path.join(process.cwd(), "public", "uploads", "company-formation");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function copyCompanyFiles() {
  console.log("Copying Company Formation & GST Certificate documents...");
  ensureDir(DEST_BASE);

  const targets = [
    { src: path.join(SOURCE_BASE, "GST Certificate"), dest: path.join(DEST_BASE, "gst") },
    { src: path.join(SOURCE_BASE, "Certificates"), dest: path.join(DEST_BASE, "certificates") },
    { src: path.join(SOURCE_BASE, "00_Master_Control"), dest: path.join(DEST_BASE, "master_control") },
    { src: path.join(SOURCE_BASE, "01_Corporate_Governance"), dest: path.join(DEST_BASE, "governance") },
    { src: path.join(SOURCE_BASE, "02_Finance"), dest: path.join(DEST_BASE, "finance") },
    { src: path.join(SOURCE_BASE, "05_Pharma_Compliance"), dest: path.join(DEST_BASE, "pharma_compliance") },
    { src: path.join(SOURCE_BASE, "06_Manufacturing_QA_QC"), dest: path.join(DEST_BASE, "qa_qc") },
    { src: path.join(SOURCE_BASE, "07_HR"), dest: path.join(DEST_BASE, "hr") },
  ];

  let copiedCount = 0;

  for (const t of targets) {
    if (!fs.existsSync(t.src)) continue;
    ensureDir(t.dest);

    try {
      const files = fs.readdirSync(t.src, { recursive: true, withFileTypes: true });
      for (const f of files) {
        if (f.isFile()) {
          const ext = path.extname(f.name).toLowerCase();
          if ([".pdf", ".docx", ".xlsx", ".csv", ".jpg", ".png"].includes(ext)) {
            const parentRelPath = f.path ? path.relative(t.src, f.path) : "";
            const targetSubDir = path.join(t.dest, parentRelPath);
            ensureDir(targetSubDir);

            const srcFilePath = path.join(f.path || t.src, f.name);
            const destFilePath = path.join(targetSubDir, f.name);

            try {
              if (fs.existsSync(srcFilePath)) {
                fs.copyFileSync(srcFilePath, destFilePath);
                copiedCount++;
                console.log(`Copied: ${f.name} -> ${path.relative(process.cwd(), destFilePath)}`);
              }
            } catch (err: any) {
              console.warn(`Skipped unreadable file: ${srcFilePath} (${err.message})`);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`Error reading dir ${t.src}: ${err.message}`);
    }
  }

  console.log(`Total files successfully copied into public/uploads/company-formation: ${copiedCount}`);
}

copyCompanyFiles().catch(console.error);
