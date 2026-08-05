const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const PRODUCT_ALIAS = {
  'Metacef-X': 'Metacef-200',
  'Metamox-CV': 'Metaclav-CV',
  'Metace SP': 'Metace-SP',
  'Metace-SP': 'Metace-SP',
  'Metace': 'Metace-P',
  'RabemetA-DSR': 'Rabemeta-DSR',
};

// Territory / employee anchor: everything below lives in Santosh Nagar & Yakutpura, run by Abdul Mannan.
// Meera Medical Hall is the one chemist that already sits in Shanti Nagar & Taranaka (Krishna Murthy).
const TERRITORY_NAME = 'Santosh Nagar & Yakutpura';
const EMP_ABDUL = { firstName: 'Abdul', lastName: 'Mannan' };
const EMP_KRISHNA = { firstName: 'Krishna', lastName: 'Murthy' };

const INVOICES = [
  {
    invoiceNo: 'WHO-202607070011', date: '2026-06-21', dueDate: '2026-06-21', cases: 4, paid: false,
    billTo: 'Al Raaf clinic', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607070010', date: '2026-06-21', dueDate: '2026-06-21', cases: 4, paid: false,
    billTo: 'Madina Medical Hall', chemistAlias: 'Madina Medical', mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607240001', date: '2026-07-24', dueDate: '2026-07-24', cases: 4, paid: false,
    billTo: 'Meera Medical & General Store', chemistAlias: 'Meera Medical Hall', mr: 'krishna',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
      { p: 'Metace SP', qty: 10, free: 0, mrp: 130.19, val: 1041.50 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
    ],
    taxable: 5022.30, cgst: 125.56, sgst: 125.56, grandTotal: 5273.00,
  },
  {
    invoiceNo: 'WHO-202607260001', date: '2026-07-26', dueDate: '2026-07-26', cases: 3, paid: false,
    billTo: 'New Al Hashmat Medical and General Stores', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metace', qty: 10, free: 0, mrp: 68.50, val: 548.00 },
      { p: 'RabemetA-DSR', qty: 10, free: 0, mrp: 110.50, val: 884.40 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
    ],
    taxable: 2273.20, cgst: 56.83, sgst: 56.83, grandTotal: 2387.00,
  },
  {
    invoiceNo: 'WHO-202607200001', date: '2026-07-20', dueDate: '2026-07-20', cases: 6, paid: false,
    billTo: 'New Mahalaxmi Medical & General', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 4, free: 4, mrp: 196.77, val: 787.08 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
      { p: 'RabemetA-DSR', qty: 10, free: 0, mrp: 110.50, val: 884.40 },
      { p: 'RabemetA-DSR', qty: 4, free: 4, mrp: 110.50, val: 442.00 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
      { p: 'Metacef-X', qty: 4, free: 4, mrp: 105.10, val: 420.40 },
    ],
    taxable: 4944.68, cgst: 123.62, sgst: 123.62, grandTotal: 3542.00,
  },
  {
    invoiceNo: 'WHO-202607070009', date: '2026-06-21', dueDate: '2026-06-21', cases: 4, paid: false,
    billTo: 'Orange Pharmacy', chemistAlias: 'Orange Pharmacy', mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607260002', date: '2026-07-26', dueDate: '2026-07-26', cases: 2, paid: false,
    billTo: 'Osman Medical and General Stores', chemistAlias: 'Usman Medical', mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
    ],
    taxable: 2410.80, cgst: 60.27, sgst: 60.27, grandTotal: 2531.00,
  },
  {
    invoiceNo: 'WHO-202607070005', date: '2026-07-07', dueDate: '2026-07-07', cases: 4, paid: false,
    billTo: 'Pure Health Care Pharmacy', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607150001', date: '2026-07-15', dueDate: '2026-07-15', cases: 4, paid: false,
    billTo: 'Rahman Medical', chemistAlias: 'Rahman Medical & General Store', mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
      { p: 'Metamox-CV', qty: 10, free: 10, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 10, free: 10, mrp: 105.10, val: 1051.00 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
    ],
    taxable: 5429.50, cgst: 135.74, sgst: 135.74, grandTotal: 2682.00,
  },
  {
    invoiceNo: 'WHO-202607070008', date: '2026-06-18', dueDate: '2026-06-18', cases: 4, paid: false,
    billTo: 'Rasool Clinic', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607070006', date: '2026-06-17', dueDate: '2026-06-17', cases: 4, paid: false,
    billTo: 'Santosh Nagar Dental', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607100001', date: '2026-07-10', dueDate: '2026-07-10', cases: 2, paid: false,
    billTo: 'Good Health Pharmacy', chemistAlias: 'Good Health', mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
    ],
    taxable: 1786.70, cgst: 44.66, sgst: 44.66, grandTotal: 1140.00,
  },
  {
    invoiceNo: 'WHO-202607160002', date: '2026-07-16', dueDate: '2026-07-16', cases: 4, paid: false,
    billTo: 'Shifa Pharmacy', chemistAlias: 'Shia Pharmacy', mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
    ],
    taxable: 4523.89, cgst: 113.10, sgst: 113.10, grandTotal: 2637.00,
  },
  {
    invoiceNo: 'WHO-202607160001', date: '2026-07-16', dueDate: '2026-07-16', cases: 4, paid: false,
    billTo: 'Zam Zam Medical', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1570.00 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 840.80 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
    ],
    taxable: 4523.89, cgst: 113.10, sgst: 113.10, grandTotal: 2637.00,
  },
  {
    invoiceNo: 'WHO-202607080001', date: '2026-07-08', dueDate: '2026-07-08', cases: 2, paid: true,
    billTo: 'Abdul Malik', chemistAlias: null, mr: 'abdul',
    items: [
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
    ],
    taxable: 3345.09, cgst: 83.64, sgst: 83.64, grandTotal: 2135.00,
  },
  {
    invoiceNo: 'WHO-202607070007', date: '2026-06-17', dueDate: '2026-06-17', cases: 4, paid: false,
    billTo: 'Al Jaffer Medical Hall', chemistAlias: 'Al-Jaffer Medical Hall', mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
      { p: 'Metamox-CV', qty: 10, free: 0, mrp: 196.77, val: 1967.70 },
      { p: 'Metacef-X', qty: 7, free: 7, mrp: 105.10, val: 735.70 },
      { p: 'Metamox-CV', qty: 7, free: 7, mrp: 196.77, val: 1377.39 },
    ],
    taxable: 5131.79, cgst: 128.30, sgst: 128.30, grandTotal: 3275.00,
  },
  {
    invoiceNo: 'WHO-202607070007-B', date: '2026-06-17', dueDate: '2026-06-17', cases: 2, paid: false,
    billTo: 'Al Jaffer Medical Hall', chemistAlias: 'Al-Jaffer Medical Hall', mr: 'abdul',
    items: [
      { p: 'Metacef-X', qty: 5, free: 5, mrp: 105.10, val: 525.50 },
      { p: 'Metacef-X', qty: 10, free: 0, mrp: 105.10, val: 1051.00 },
    ],
    taxable: 1576.50, cgst: 39.40, sgst: 39.40, grandTotal: 1130.00,
  },
];

async function main() {
  const products = await db.product.findMany();
  const productByName = {};
  for (const p of products) productByName[p.name] = p;

  const territory = await db.territory.findFirst({ where: { name: TERRITORY_NAME } });
  if (!territory) throw new Error(`Territory not found: ${TERRITORY_NAME}`);

  const abdul = await db.employee.findFirst({ where: EMP_ABDUL });
  const krishna = await db.employee.findFirst({ where: EMP_KRISHNA });
  if (!abdul || !krishna) throw new Error('MR employee record missing');
  const empMap = { abdul: abdul.id, krishna: krishna.id };

  const distributor = await db.distributor.findFirst();
  if (!distributor) throw new Error('No distributor found');

  const chemistCache = {};
  let created = 0;
  let skipped = 0;

  for (const inv of INVOICES) {
    const existingInvoice = await db.invoice.findUnique({ where: { invoiceNo: inv.invoiceNo } });
    if (existingInvoice) {
      skipped++;
      continue;
    }

    // Resolve or create chemist for the billing party
    let chemist;
    const lookupName = inv.chemistAlias || inv.billTo;
    if (chemistCache[lookupName]) {
      chemist = chemistCache[lookupName];
    } else {
      chemist = await db.chemist.findFirst({ where: { name: lookupName } });
      if (!chemist) {
        chemist = await db.chemist.create({
          data: {
            name: inv.billTo,
            contactPerson: inv.billTo,
            address: inv.billTo,
            latitude: 17.3616,
            longitude: 78.4747,
            territoryId: territory.id,
          },
        });
      }
      chemistCache[lookupName] = chemist;
    }

    const employeeId = empMap[inv.mr];

    const order = await db.order.create({
      data: {
        status: 'DELIVERED',
        chemistId: chemist.id,
        distributorId: distributor.id,
        employeeId,
        createdAt: new Date(inv.date),
      },
    });

    for (const item of inv.items) {
      const realName = PRODUCT_ALIAS[item.p] || item.p;
      const product = productByName[realName];
      if (!product) throw new Error(`Unmapped product: ${item.p} -> ${realName}`);
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: item.qty,
          price: item.mrp,
          freeQty: item.free,
          mrp: item.mrp,
          gstPct: 5.0,
          createdAt: new Date(inv.date),
        },
      });
    }

    const totalItems = inv.items.length;
    const totalQty = inv.items.reduce((s, i) => s + i.qty, 0);

    await db.invoice.create({
      data: {
        orderId: order.id,
        invoiceNo: inv.invoiceNo,
        amount: inv.grandTotal,
        paid: inv.paid,
        partyName: inv.billTo,
        cases: inv.cases,
        dueDate: new Date(inv.dueDate),
        totalItems,
        totalQty,
        totalGst: inv.cgst + inv.sgst,
        grandTotal: inv.grandTotal,
        createdAt: new Date(inv.date),
      },
    });

    created++;
  }

  console.log(`Loaded ${created} invoices, skipped ${skipped} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
