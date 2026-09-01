const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// MRP here is per-strip, derived from box rate ÷ 10 strips/box.
const updates = [
  { sku: "MET-P-100", mrp: 6.3 },
  { sku: "MET-SP-100", mrp: 10.1 },
  { sku: "PAN-DSR-100", mrp: 10.1 },
  { sku: "RAB-DSR-100", mrp: 9.2 },
  { sku: "MET-CV-100", mrp: 47.4 },
  { sku: "MET-CEF-200", mrp: 29.8 },
  { sku: "MET-COL-650", mrp: 11.2 },
];

async function main() {
  for (const u of updates) {
    const ptr = Math.round(u.mrp * 0.8 * 100) / 100;
    const pts = Math.round(ptr * 0.92 * 100) / 100;
    const product = await db.product.update({
      where: { sku: u.sku },
      data: { mrp: u.mrp, ptr, pts, price: ptr },
    });
    console.log(`${product.name} (${u.sku}): MRP ${u.mrp} PTR ${ptr} PTS ${pts}`);
  }
}

main().finally(() => db.$disconnect());
