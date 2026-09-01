// One-off historical DCR sheet import. Approximate GPS (jittered around territory
// reference point) since sheet has no coordinates — flagged locationUnavailable.
// Run: node scripts/import-dcr-data.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = new PrismaClient();

// Yakutpura-area reference (existing entities in DB sit here)
const YAKUTPURA_REF = { lat: 17.4207, lon: 78.5475 };
// Tarnaka-area reference (Hyderabad, distinct zone from Yakutpura)
const TARNAKA_REF = { lat: 17.4239, lon: 78.5202 };

function jitter(ref, seed) {
  // deterministic small offset so entities don't all stack on one point
  const h = crypto.createHash("md5").update(seed).digest();
  const dx = (h[0] / 255 - 0.5) * 0.01; // ~ +/-0.5km
  const dy = (h[1] / 255 - 0.5) * 0.01;
  return { lat: ref.lat + dx, lon: ref.lon + dy };
}

function normProduct(s) {
  return s.toLowerCase().replace(/[\s-]/g, "");
}

const PRODUCT_ALIASES = {
  metamoxcv: "Metamox-CV",
  metacefx: null, // no match in catalog — skip
  metacol650: "Metacol-650",
  rebametadsr: "Rabemeta-DSR",
  rabemetadsr: "Rabemeta-DSR",
  pantometadsr: "Pantometa-DSR",
  metacep: "Metace-P",
  metacesp: "Metace-SP",
};

// Sno, Date(MM/DD/YYYY), MR, Entity, Type, Area, Contact, Purpose, Info, ProductsDetailed,
// SamplesQty, BoxesQty, LeadGen, LeadStatus, LeadDetails, FollowUpDate, Remarks
const ROWS = [
  [-1, "07/27/2026", "Abdul Mannan", "Pure Health Care Polyclinic", "Clinic", "Santosh Nagar", "Dr Shoail", "Product Detailing", "Discussed new promotion strategy and portfolio expansion", "Metamox-CV,MetaCef -X", 10, 2, true, "NEW", "Interested in trialing Rebameta DSR", "08/03/2026", "Current: 10+7 -> Proposed: 10+10 (20%)"],
  [0, "07/27/2026", "Abdul Mannan", "Fatima Clinic (Raza Medical)", "Clinic", "Santosh Nagar", "Dr Fatima", "Product Detailing", "", "Metacol 650,Metamox-CV,Metacef -X,Rebameta DSR,Pantometa DSR,Metace-p,Metace-SP", null, null, false, "", "", "08/03/2026", "Current: 10+7 -> Proposed: 10+7 (20%)"],
  [1, "07/27/2026", "Abdul Mannan", "Yakutpura Clinic (Beside Labbaik Hotel)", "Clinic", "Yakutpura", "Dr Abdul Sayeed", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Current: 10+10 (20%) -> Proposed: 0"],
  [2, "07/27/2026", "Abdul Mannan", "DR. Rasool Clinic", "Clinic", "Santosh Nagar", "Dr Rasool", "Product Detailing", "", "Metacol 650,Metamox-CV,Metacef -X,Rebameta DSR,Pantometa DSR,Metace-p,Metace-SP", null, null, false, "", "", "08/03/2026", "Current: 10+5 -> Proposed: 10+2 (20%)"],
  [3, "07/27/2026", "Abdul Mannan", "DR. Arbaz (Rein Bazar) Al Raaf", "Clinic", "Rein Bazaar", "Dr Arbaz", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Current: 10+7 -> Proposed: 0"],
  [4, "07/27/2026", "Abdul Mannan", "Madina Clinic", "Clinic", "Santosh Nagar", "Dr Owais/Dr Aslam", "Product Detailing", "", "Metamox-CV,MetaCef -X,Rebameta DSR", null, null, false, "", "", "08/03/2026", "Current: 10+7 -> Proposed: 10+7 (20%)"],
  [5, "07/27/2026", "Abdul Mannan", "People's Clinic", "Clinic", "Santosh Nagar", "Dr Haji Saheb", "Product Detailing", "", "Metacol 650,Metamox-CV,Metacef -X,Metace-p,Metace-SP", null, null, false, "", "", "08/03/2026", "Current: 10+7 -> Proposed: 10+7 (20%)"],
  [6, "07/27/2026", "Abdul Mannan", "Zam Zam Clinic", "Clinic", "Santosh Nagar", "Dr", "Product Detailing", "", "Metamox-CV,MetaCef -X,Rebameta DSR,Metace-SP", null, null, false, "", "", "08/03/2026", "Current: 10+7 -> Proposed: 10+5 (20%)"],
  [7, "07/27/2026", "Abdul Mannan", "Shafi Clinic", "Clinic", "Yakutpura", "Dr Hashmi", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Current: 10+7 -> Proposed: 10+7 (20%)"],
  [8, "07/27/2026", "Abdul Mannan", "Baba Nagar Clinic", "Clinic", "", "Dr Kalim", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Current: 10+6 -> Proposed: 10+6 (20%)"],
  [9, "07/27/2026", "Abdul Mannan", "Irfan Clinic", "Clinic", "", "Dr Irfan", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Current: 10+5 -> Proposed: 10+5 (20%)"],
  [10, "07/27/2026", "Abdul Mannan", "Saba Medical", "Clinic", "Santosh Nagar", "Dr Zakariya", "Product Detailing", "", "Rebameta DSR", null, null, false, "", "", "08/03/2026", "Current: 10+5 -> Proposed: 10+5 (20%)"],
  [11, "07/27/2026", "Abdul Mannan", "Santosh Nagar Dental", "Dental Clinic", "", "Dr Amaan", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Current: -> Proposed:"],
  [12, "07/27/2026", "Abdul Mannan", "Orange Pharmacy", "Pharmacy", "Yakutpura", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [13, "07/27/2026", "Abdul Mannan", "Rahman Medical & General Store", "Pharmacy", "Yakutpura", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [14, "07/27/2026", "Abdul Mannan", "Shifa Pharmacy (Shifa Healthcare) Rein Bazar", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [15, "07/27/2026", "Abdul Mannan", "Al-Jaffer Medical Hall", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [16, "07/27/2026", "Abdul Mannan", "Raza Medical", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [17, "07/27/2026", "Abdul Mannan", "Good Health", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [18, "07/27/2026", "Abdul Mannan", "Madina Medical Santosh Nagar", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [19, "07/27/2026", "Abdul Mannan", "Al-Raaf Clinic", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [20, "07/27/2026", "Abdul Mannan", "Noman Pharmacy (Behind Santosh Nagar Water Tank)", "Pharmacy", "Santosh Nagar", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [21, "07/27/2026", "Abdul Mannan", "Osman Medical", "Pharmacy", "Baba Nagar", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo: 10+5"],
  [22, "07/27/2026", "Abdul Mannan", "Azaan Pharmacy", "Pharmacy", "Baba Nagar", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo: 10+5"],
  [23, "07/27/2026", "Abdul Mannan", "Anas Pharamcy", "Pharmacy", "Santosh Nagar", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [24, "07/27/2026", "Abdul Mannan", "Al Saba", "Pharmacy", "", "", "Product Detailing", "", "", null, null, false, "", "", "08/03/2026", "Free strip promo"],
  [25, "07/27/2026", "Krishna Murthy", "Jyothi Clinic", "Clinic", "Shanti Nagar", "Dr S Krishna Vardhan", "Product Detailing", "Need to visit tomorrow again i.e. 28/7/2026", null, 0, 0, true, "NEW", "Will discuss about Rebameta as per the chemist beside", "07/28/2026", ""],
  [26, "07/27/2026", "Krishna Murthy", "MaxoCare", "Clinic", "Taranaka", "Dr Aliya Afreen", "Box Placement", "Need to place boxes tomorrow", null, 0, 0, true, "CONVERTED", "Doctor suggested Metamox CV, Metace SP", "07/28/2026", ""],
  [29, "07/27/2026", "Krishna Murthy", "Laxmi Multispeciality", "Clinic", "Taranaka", "Dr Karthik", "Follow-up", "Will be placing the box very soon", null, 0, 0, false, "IN_PROGRESS", "Explained doctor about the products. He is facing difficulty memorizing names", "07/30/2026", ""],
  [30, "07/27/2026", "Krishna Murthy", "Srinivasa Medical and general store", "Pharmacy", "Shanti Nagar", "", "Box Placement", "Doctor suggested to place metacol 650", "Metacol 650", 0, 0, true, "CONVERTED", "Doctor suggested to place metacol 650 only", "07/30/2026", ""],
  [31, "07/27/2026", "Krishna Murthy", "Dr Samir S Bachar", "Clinic", "Shanti Nagar", "Dr Samir S Bachar", "Box Placement", "Doctor suggested to place all medicine", null, 0, 0, true, "CONVERTED", "Doctor suggested to place all molecule. Will place only 5 strips of each", "07/30/2026", ""],
  [32, "07/27/2026", "Krishna Murthy", "First Day Clinic", "Clinic", "Taranaka", "Dr Anil Kumar", "Box Placement", "Doctor suggested to place all medicine", null, 0, 0, true, "CONVERTED", "Doctor suggested to place all the medicine", "07/30/2026", ""],
  [33, "07/27/2026", "Krishna Murthy", "Meera Medical Hall", "Pharmacy", "Taranaka", "Dr Anil Kumar", "Box Placement", "Doctor suggested to place all medicine", null, 0, 3, true, "CONVERTED", "Placed all boxes. Need to give receipt tomorrow", "07/30/2026", ""],
];

async function ensureTerritory(name, zone) {
  if (!name) return null;
  let t = await db.territory.findUnique({ where: { name } });
  if (!t) {
    t = await db.territory.create({ data: { name, region: "Hyderabad", zone } });
    console.log("created territory:", name);
  }
  return t;
}

async function ensureMr(fullName) {
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || firstName;
  let employee = await db.employee.findFirst({
    where: { firstName, lastName, user: { role: "MR" } },
  });
  if (employee) return employee;

  const email = `${fullName.toLowerCase().replace(/\s+/g, ".")}@trendmr.local`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  const user = await db.user.create({ data: { email, passwordHash, role: "MR", isActive: true } });
  employee = await db.employee.create({
    data: { userId: user.id, firstName, lastName, phone: "0000000000" },
  });
  console.log(`created MR ${fullName} — email: ${email} (placeholder password, must be reset)`);
  return employee;
}

async function ensureEntity(type, name, territoryId, contactName, ref, seed) {
  const coords = jitter(ref, seed);
  if (type === "Clinic" || type === "Dental Clinic") {
    let doc = await db.doctor.findFirst({ where: { fullName: name, territoryId } });
    if (!doc) {
      doc = await db.doctor.create({
        data: {
          fullName: name,
          primarySpecialty: type === "Dental Clinic" ? "Dentistry" : "General Practice",
          clinicAddress: name,
          latitude: coords.lat,
          longitude: coords.lon,
          territoryId,
          mobile: null,
        },
      });
      console.log("created doctor:", name);
    }
    return { kind: "doctor", id: doc.id };
  } else {
    let chem = await db.chemist.findFirst({ where: { name, territoryId } });
    if (!chem) {
      chem = await db.chemist.create({
        data: {
          name,
          contactPerson: contactName || "Store Owner",
          address: name,
          latitude: coords.lat,
          longitude: coords.lon,
          territoryId,
        },
      });
      console.log("created chemist:", name);
    }
    return { kind: "chemist", id: chem.id };
  }
}

function resolveProducts(productsField) {
  if (!productsField) return [];
  const names = productsField.split(",").map((s) => s.trim()).filter(Boolean);
  const resolved = [];
  for (const n of names) {
    const key = normProduct(n);
    const mapped = PRODUCT_ALIASES[key];
    if (mapped === undefined) {
      console.log("  ! unmatched product, skipped:", n);
      continue;
    }
    if (mapped === null) {
      console.log("  ! product not in catalog, skipped:", n);
      continue;
    }
    resolved.push(mapped);
  }
  return resolved;
}

function parseDate(mmddyyyy) {
  const [m, d, y] = mmddyyyy.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 10, 0, 0)); // pin midday IST-ish to avoid TZ day-shift
}

async function main() {
  const productCache = await db.product.findMany();
  const productByName = Object.fromEntries(productCache.map((p) => [p.name, p]));

  let created = 0;
  let skipped = 0;

  for (const row of ROWS) {
    const [
      sno, dateStr, mrName, entityName, type, area, contact, purpose, info,
      productsField, samplesQty, boxesQty, leadGen, leadStatus, leadDetails, followUpStr, remarks,
    ] = row;

    if (!entityName) { skipped++; continue; }

    const employee = await ensureMr(mrName);

    const zone = area === "Shanti Nagar" || area === "Taranaka" ? "Tarnaka Zone" : "Yakutpura Zone";
    const ref = zone === "Tarnaka Zone" ? TARNAKA_REF : YAKUTPURA_REF;
    const territoryName = area || (zone === "Tarnaka Zone" ? "Taranaka" : "Yakutpura");
    const territory = await ensureTerritory(territoryName, zone);

    const target = await ensureEntity(type, entityName, territory.id, contact, ref, entityName + sno);
    const coords = jitter(ref, entityName + sno);

    const resolvedProductNames = resolveProducts(productsField);
    const productIds = resolvedProductNames
      .map((n) => productByName[n]?.id)
      .filter(Boolean);

    const createdAt = parseDate(dateStr);
    const followUpDate = followUpStr ? parseDate(followUpStr) : null;

    const visit = await db.visit.create({
      data: {
        employeeId: employee.id,
        doctorId: target.kind === "doctor" ? target.id : undefined,
        chemistId: target.kind === "chemist" ? target.id : undefined,
        purpose: purpose || "Field visit",
        feedback: [info, remarks].filter(Boolean).join(" | ") || null,
        latitude: coords.lat,
        longitude: coords.lon,
        locationUnavailable: true, // historical import — GPS approximated, not device-captured
        boxesPlaced: boxesQty || null,
        followUpDate,
        createdAt,
      },
    });

    for (const productId of productIds) {
      await db.sample.create({
        data: { visitId: visit.id, productId, quantity: samplesQty || 1 },
      });
    }

    if (leadGen) {
      await db.lead.create({
        data: {
          visitId: visit.id,
          employeeId: employee.id,
          status: leadStatus || "NEW",
          details: leadDetails || null,
          followUpAction: leadDetails || null,
          followUpDate,
        },
      });
    }

    created++;
  }

  console.log(`\nDone. ${created} visits created, ${skipped} rows skipped (blank entity).`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
