const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const db = new PrismaClient();

// Base coords for Hyderabad territories (approx, spread slightly per entity)
const BASE = { lat: 17.3616, lng: 78.4747 };
function jitter(i) {
  return { lat: BASE.lat + (i % 7) * 0.004, lng: BASE.lng + (i % 5) * 0.004 };
}

const TERRITORIES = ['Santosh Nagar', 'Yakutpura', 'Rein Bazaar', 'Baba Nagar', 'Shanti Nagar', 'Taranaka'];

// Sheet product name -> real Product.name already in DB
const PRODUCT_ALIAS = {
  'Metacol 650': 'Metacol-650',
  'Metamox-CV': 'Metaclav-CV',
  'MetaCef-X': 'Metacef-200',
  'Rebameta DSR': 'Rabemeta-DSR',
  'Pantometa DSR': 'Pantometa-DSR',
  'Metace-p': 'Metace-P',
  'Metace-SP': 'Metace-SP',
};

// rows: [mrKey, date, entityName, type, area, doctorName, purpose, boxesPlaced, leadStatus, leadDetails, followUpDate, remarks]
const ROWS = [
  { mr: 'abdul', date: '2026-07-27', entity: 'Pure Health Care Polyclinic', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Shoail', purpose: 'Product Detailing', products: ['Metamox-CV', 'MetaCef-X'], samples: 10, boxes: 2, lead: 'NEW', leadDetails: 'Interested in trialing Rebameta DSR', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Fatima Clinic (Raza Medical)', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Fatima', purpose: 'Product Detailing', products: ['Metacol 650', 'Metamox-CV', 'MetaCef-X', 'Rebameta DSR', 'Pantometa DSR', 'Metace-p', 'Metace-SP'], followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Yakutpura Clinic (Beside Labbaik Hotel)', type: 'Clinic', area: 'Yakutpura', contact: 'Dr Abdul Sayeed', purpose: 'Follow-up', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'DR. Rasool Clinic', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Rasool', purpose: 'Product Detailing', products: ['Metacol 650', 'Metamox-CV', 'MetaCef-X', 'Rebameta DSR', 'Pantometa DSR', 'Metace-p', 'Metace-SP'], followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'DR. Arbaz (Rein Bazar) Al Raaf', type: 'Clinic', area: 'Rein Bazaar', contact: 'Dr Arbaz', purpose: 'Follow-up', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Madina Clinic', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Owais/ Dr Aslam', purpose: 'Product Detailing', products: ['Metamox-CV', 'MetaCef-X', 'Rebameta DSR'], followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: "People's Clinic", type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Haji Saheb', purpose: 'Product Detailing', products: ['Metacol 650', 'Metamox-CV', 'MetaCef-X', 'Metace-p', 'Metace-SP'], followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Zam Zam Clinic', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr', purpose: 'Product Detailing', products: ['Metamox-CV', 'MetaCef-X', 'Rebameta DSR', 'Metace-SP'], followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Shafi Clinic', type: 'Clinic', area: 'Yakutpura', contact: 'Dr Hashmi', purpose: 'Follow-up', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Baba Nagar Clinic', type: 'Clinic', area: 'Baba Nagar', contact: 'Dr Kalim', purpose: 'Follow-up', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Irfan Clinic', type: 'Clinic', area: 'Baba Nagar', contact: 'Dr Irfan', purpose: 'Follow-up', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Saba Medical', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Zakariya', purpose: 'Product Detailing', products: ['Rebameta DSR'], followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Santosh Nagar Dental', type: 'Clinic', area: 'Santosh Nagar', contact: 'Dr Amaan', purpose: 'Follow-up', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Orange Pharmacy', type: 'Pharmacy', area: 'Yakutpura', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Rahman Medical & General Store', type: 'Pharmacy', area: 'Yakutpura', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Shifa Pharmacy (Shifa Healthcare) Rein Bazar', type: 'Pharmacy', area: 'Rein Bazaar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Al-Jaffer Medical Hall', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Raza Medical', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Good Health', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Madina Medical Santosh Nagar', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Al-Raaf Clinic', type: 'Pharmacy', area: 'Rein Bazaar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Noman Pharmacy (Behind Santosh Nagar Water Tank)', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Osman Medical', type: 'Pharmacy', area: 'Baba Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Azaan Pharmacy', type: 'Pharmacy', area: 'Baba Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Anas Pharamcy', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },
  { mr: 'abdul', date: '2026-07-27', entity: 'Al Saba', type: 'Pharmacy', area: 'Santosh Nagar', purpose: 'Free strip promo', followUp: '2026-08-03' },

  { mr: 'krishna', date: '2026-07-27', entity: 'Jyothi Clinic', type: 'Clinic', area: 'Shanti Nagar', contact: 'Dr S Krishna Vardhan', purpose: 'Product Detailing', lead: 'NEW', followUp: '2026-07-28', remarks: 'Will discuss about Rebameta as per the chemist beside' },
  { mr: 'krishna', date: '2026-07-27', entity: 'MaxoCare', type: 'Clinic', area: 'Taranaka', contact: 'Dr Aliya Afreen', purpose: 'Box Placement', boxes: 1, lead: 'CONVERTED', followUp: '2026-07-28', remarks: 'Doctor Suggested, Metamox CV, Metace sp', products: ['Metamox-CV', 'Metace-SP'] },
  { mr: 'krishna', date: '2026-07-27', entity: 'Laxmi Multispeciality', type: 'Clinic', area: 'Taranaka', contact: 'Dr Karthik', purpose: 'Follow-up', lead: 'IN_PROGRESS', followUp: '2026-07-30', remarks: 'Explained doctor about the products. He is facing difficulty in memorizing names' },
  { mr: 'krishna', date: '2026-07-27', entity: 'Srinivasa Medical and general store', type: 'Pharmacy', area: 'Shanti Nagar', purpose: 'Box Placement', boxes: 1, lead: 'CONVERTED', followUp: '2026-07-30', remarks: 'Doctor Suggested to place metacol 650 only', products: ['Metacol 650'] },
  { mr: 'krishna', date: '2026-07-27', entity: 'Dr Samir S Bachar', type: 'Clinic', area: 'Shanti Nagar', contact: 'Dr Samir S Bachar', purpose: 'Box Placement', boxes: 1, lead: 'CONVERTED', followUp: '2026-07-30', remarks: 'Doctor Suggested to place all molecule. We will be placing only 5 strip of each' },
  { mr: 'krishna', date: '2026-07-27', entity: 'First Day, clinic', type: 'Clinic', area: 'Taranaka', contact: 'Dr Anil Kumar', purpose: 'Box Placement', boxes: 1, lead: 'CONVERTED', followUp: '2026-07-30', remarks: 'Doctor suggested to place all the medicine.' },
  { mr: 'krishna', date: '2026-07-27', entity: 'Meera Medical Hall', type: 'Pharmacy', area: 'Taranaka', contact: 'Dr Anil Kumar', purpose: 'Box Placement', boxes: 1, lead: 'CONVERTED', followUp: '2026-07-30', remarks: 'Placed All boxes. Need to give receipt Tomorrow.' },
];

async function main() {
  // 1. Products — map sheet names to existing real Product rows
  const productMap = {};
  for (const [sheetName, realName] of Object.entries(PRODUCT_ALIAS)) {
    const prod = await db.product.findUnique({ where: { name: realName } });
    if (!prod) throw new Error(`Product not found: ${realName}`);
    productMap[sheetName] = prod.id;
  }

  // 2. Territories
  const territoryMap = {};
  for (const name of TERRITORIES) {
    const t = await db.territory.upsert({
      where: { name },
      update: {},
      create: { name, region: 'Hyderabad', zone: 'Hyderabad' },
    });
    territoryMap[name] = t.id;
  }

  // 3. Employees: Abdul Mannan already exists; Krishna Murthy needs creation
  const abdul = await db.employee.findFirst({ where: { firstName: 'Abdul', lastName: 'Mannan' } });
  if (!abdul) throw new Error('Abdul Mannan not found');

  let krishna = await db.employee.findFirst({ where: { firstName: 'Krishna', lastName: 'Murthy' } });
  if (!krishna) {
    const hashedPassword = await bcrypt.hash('Krishna@123', 12);
    const user = await db.user.create({
      data: { email: 'krishna.murthy@trendmr.local', passwordHash: hashedPassword, role: 'MR', isActive: true },
    });
    krishna = await db.employee.create({
      data: { userId: user.id, firstName: 'Krishna', lastName: 'Murthy', phone: '9000000001' },
    });
    console.log('Created Krishna Murthy MR account. email: krishna.murthy@trendmr.local password: Krishna@123');
  }

  const empMap = { abdul: abdul.id, krishna: krishna.id };

  // Assign Krishna's territories (Shanti Nagar, Taranaka) if unassigned
  for (const tname of ['Shanti Nagar', 'Taranaka']) {
    const t = await db.territory.findUnique({ where: { name: tname } });
    if (t && !t.employeeId) {
      await db.territory.update({ where: { id: t.id }, data: { employeeId: krishna.id } });
    }
  }
  for (const tname of ['Santosh Nagar', 'Yakutpura', 'Rein Bazaar', 'Baba Nagar']) {
    const t = await db.territory.findUnique({ where: { name: tname } });
    if (t && !t.employeeId) {
      await db.territory.update({ where: { id: t.id }, data: { employeeId: abdul.id } });
    }
  }

  // 4. Entities (Doctor for Clinic, Chemist for Pharmacy) — dedupe by name
  const doctorMap = {};
  const chemistMap = {};
  let idx = 0;
  for (const row of ROWS) {
    idx++;
    const territoryId = territoryMap[row.area];
    if (!territoryId) continue;
    const { lat, lng } = jitter(idx);
    if (row.type === 'Clinic') {
      if (!doctorMap[row.entity]) {
        const doc = await db.doctor.create({
          data: {
            fullName: row.contact || row.entity,
            primarySpecialty: 'General Medicine',
            clinicAddress: row.entity,
            latitude: lat,
            longitude: lng,
            territoryId,
          },
        });
        doctorMap[row.entity] = doc.id;
      }
    } else {
      if (!chemistMap[row.entity]) {
        const chem = await db.chemist.create({
          data: {
            name: row.entity,
            contactPerson: row.entity,
            address: row.entity,
            latitude: lat,
            longitude: lng,
            territoryId,
          },
        });
        chemistMap[row.entity] = chem.id;
      }
    }
  }

  // 5. Visits + Samples + Leads
  let created = 0;
  for (const row of ROWS) {
    const employeeId = empMap[row.mr];
    const doctorId = doctorMap[row.entity] || null;
    const chemistId = chemistMap[row.entity] || null;
    if (!doctorId && !chemistId) continue;
    const target = doctorId ? doctorMap : chemistMap;
    void target;
    const entityId = doctorId || chemistId;
    const { lat, lng } = jitter(created + 1);

    const visit = await db.visit.create({
      data: {
        employeeId,
        doctorId,
        chemistId,
        purpose: row.purpose || 'Field Visit',
        feedback: row.remarks || null,
        latitude: lat,
        longitude: lng,
        boxesPlaced: row.boxes || null,
        createdAt: new Date(row.date),
      },
    });

    if (row.products && row.products.length) {
      for (const pname of row.products) {
        const productId = productMap[pname];
        if (!productId) continue;
        await db.sample.create({
          data: { visitId: visit.id, productId, quantity: row.samples || 5 },
        });
      }
    }

    if (row.lead) {
      await db.lead.create({
        data: {
          visitId: visit.id,
          employeeId,
          status: row.lead,
          details: row.leadDetails || row.remarks || null,
          followUpDate: row.followUp ? new Date(row.followUp) : null,
        },
      });
    }

    created++;
    void entityId;
  }

  console.log(`Loaded: ${Object.keys(doctorMap).length} doctors, ${Object.keys(chemistMap).length} chemists, ${created} visits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
