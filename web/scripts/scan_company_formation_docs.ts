import fs from "fs";
import path from "path";

const BASE_PATH = "C:\\Metapharsic_Life_Science\\Company formation";

function scanDir(dir: string, fileList: Array<{ name: string; fullPath: string; size: number; ext: string; category: string }> = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === "node_modules" || item === ".git" || item === "dist" || item.endsWith(".backup_broken") || item.endsWith(".backup_sidebar")) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else {
      const ext = path.extname(item).toLowerCase();
      if ([".pdf", ".docx", ".xlsx", ".csv", ".jpg", ".png", ".html", ".msi", ".zip"].includes(ext)) {
        let category = "Other";
        const lowerPath = fullPath.toLowerCase();
        if (lowerPath.includes("gst") || lowerPath.includes("tax")) category = "License";
        else if (lowerPath.includes("certif") || lowerPath.includes("gmp") || lowerPath.includes("iso")) category = "Compliance";
        else if (lowerPath.includes("sop")) category = "SOP";
        else if (lowerPath.includes("finance") || lowerPath.includes("invoice") || lowerPath.includes("balance") || lowerPath.includes("pnl")) category = "Report";
        else if (lowerPath.includes("governance") || lowerPath.includes("deed") || lowerPath.includes("agreement") || lowerPath.includes("noc")) category = "Policy";
        fileList.push({
          name: item,
          fullPath,
          size: stat.size,
          ext: ext.substring(1).toUpperCase(),
          category,
        });
      }
    }
  }
  return fileList;
}

const files = scanDir(BASE_PATH);
console.log(`Found ${files.length} files in ${BASE_PATH}:`);
console.table(files.map(f => ({ name: f.name, ext: f.ext, sizeKB: (f.size / 1024).toFixed(1), category: f.category })));
