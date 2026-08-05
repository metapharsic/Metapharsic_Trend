import { PrismaClient, Role, OrderStatus, ExpenseStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding updated product list & mock sales/expenses...");

  // 1. Create or Update Products from the user's app screenshot
  const productsData = [
    {
      name: "Pancloc-40 (40mg/Pantoprazole Tablet 10s)",
      sku: "PAN-40MG-10",
      price: 18.00,
      composition: "Pantoprazole",
      strength: "40mg",
      packSize: "10s",
      mrp: 40.00,
      ptr: 18.00,
      pts: 12.00,
      therapySegment: "Gastroenterology",
      stockQty: 1000,
    },
    {
      name: "Pancloc-D (40mg Pantoprazole + 30mg Domperidone Tablet)",
      sku: "PAN-D-10",
      price: 25.00,
      composition: "Pantoprazole + Domperidone",
      strength: "40mg + 30mg",
      packSize: "10s",
      mrp: 60.00,
      ptr: 25.00,
      pts: 18.00,
      therapySegment: "Gastroenterology",
      stockQty: 500,
    },
    {
      name: "Pantoprazole Injection (40mg Injection)",
      sku: "PAN-40INJ-1",
      price: 28.00,
      composition: "Pantoprazole",
      strength: "40mg",
      packSize: "1 vial",
      mrp: 50.00,
      ptr: 28.00,
      pts: 20.00,
      therapySegment: "Gastroenterology",
      stockQty: 200,
    },
    {
      name: "Amoxycillin 500mg + Clavulanic 125mg (625mg Tablet)",
      sku: "AMX-625-10",
      price: 60.00,
      composition: "Amoxycillin + Clavulanic Acid",
      strength: "500mg + 125mg",
      packSize: "10s",
      mrp: 120.00,
      ptr: 60.00,
      pts: 40.00,
      therapySegment: "Antibiotics",
      stockQty: 500,
    },
    {
      name: "Amoxycillin 500mg",
      sku: "AMX-500-10",
      price: 22.00,
      composition: "Amoxycillin",
      strength: "500mg",
      packSize: "10s",
      mrp: 45.00,
      ptr: 22.00,
      pts: 15.00,
      therapySegment: "Antibiotics",
      stockQty: 300,
    },
    {
      name: "Paracetamol 500mg",
      sku: "PCM-500-10",
      price: 6.00,
      composition: "Paracetamol",
      strength: "500mg",
      packSize: "10s",
      mrp: 15.00,
      ptr: 6.00,
      pts: 4.00,
      therapySegment: "Analgesics",
      stockQty: 1000,
    }
  ];

  const dbProducts = [];
  for (const item of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        price: item.price,
        composition: item.composition,
        strength: item.strength,
        packSize: item.packSize,
        mrp: item.mrp,
        ptr: item.ptr,
        pts: item.pts,
        therapySegment: item.therapySegment,
        stockQty: item.stockQty,
      },
      create: item,
    });
    dbProducts.push(product);
    console.log(`✅ Upserted product: ${product.name}`);
  }

  // 2. Fetch seed components for referencing order associations
  const mrEmployee = await prisma.employee.findFirst({
    where: { user: { role: Role.MR } },
  });

  const distributor = await prisma.distributor.findFirst();
  const chemist = await prisma.chemist.findFirst();

  if (!mrEmployee || !distributor || !chemist) {
    console.error("❌ MR, Distributor, or Chemist not found in database. Seed the base db first.");
    return;
  }

  console.log(`Using MR: ${mrEmployee.firstName} ${mrEmployee.lastName}`);
  console.log(`Using Chemist: ${chemist.name}`);
  console.log(`Using Distributor: ${distributor.name}`);

  // Clean old orders / order items to prevent duplicate mock data accumulation
  await prisma.order.deleteMany({
    where: {
      employeeId: mrEmployee.id,
    },
  });

  // 3. Create mock orders matching the quantities/sales in the spreadsheet
  // Row 1: Pancloc-40 (Quantity: 100)
  // Row 2: Pancloc-D (Quantity: 80)
  // Row 3: Pantoprazole Injection (Quantity: 50)
  // Row 4: Amoxycillin 625mg (Quantity: 60)
  // Row 5: Amoxycillin 500mg (Quantity: 40)
  // Row 6: Paracetamol 500mg (Quantity: 150)

  const quantities = [100, 80, 50, 60, 40, 150];

  const order = await prisma.order.create({
    data: {
      status: OrderStatus.DELIVERED,
      chemistId: chemist.id,
      distributorId: distributor.id,
      employeeId: mrEmployee.id,
      createdAt: new Date(),
      items: {
        create: dbProducts.map((p, idx) => ({
          productId: p.id,
          quantity: quantities[idx] || 10,
          price: p.ptr || p.price, // Selling price to chemist is PTR
        })),
      },
    },
  });
  console.log(`✅ Created mock order with ID: ${order.id}`);

  // Create an invoice for this order
  const orderPriceSum = dbProducts.reduce((sum, p, idx) => {
    return sum + (Number(p.ptr || p.price) * (quantities[idx] || 10));
  }, 0);

  await prisma.invoice.upsert({
    where: { orderId: order.id },
    update: {},
    create: {
      orderId: order.id,
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      amount: orderPriceSum,
      paid: true,
    },
  });
  console.log(`✅ Created invoice of amount: ${orderPriceSum}`);

  // 4. Create mock Expenses for the MR to simulate "Selling Expenses"
  // Clean old expenses
  await prisma.expense.deleteMany({
    where: {
      employeeId: mrEmployee.id,
    },
  });

  const mockExpenses = [
    { amount: 1200.00, category: "Travel", description: "Fare for hospital visits", status: ExpenseStatus.APPROVED },
    { amount: 500.00, category: "Food & Lodging", description: "Lunch with clients", status: ExpenseStatus.APPROVED },
    { amount: 300.00, category: "Communication", description: "Mobile internet pack", status: ExpenseStatus.APPROVED },
  ];

  for (const exp of mockExpenses) {
    await prisma.expense.create({
      data: {
        employeeId: mrEmployee.id,
        amount: exp.amount,
        category: exp.category,
        description: exp.description,
        status: exp.status,
      },
    });
  }
  console.log(`✅ Seeded ${mockExpenses.length} approved expenses for MR.`);
  
  console.log("🎉 Seeding complete successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
