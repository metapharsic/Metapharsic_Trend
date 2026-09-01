const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  const territoryId = '410ddb3d-0de7-487a-9211-ecdf8c036b08';
  const chemistId = 'f83ceac4-d867-400a-acfa-b5fcfb3f6b79';
  const doctorId = '299ed242-2378-4604-a6ce-3c79e5196230';
  const distributorId = '82bc7775-74a1-4882-acbb-b2c91cf3ea7f';
  const rajesh = 'f4213fa9-42d3-4cfb-9304-a14a85063c48';
  const amit = '4c46c6d9-ede1-41af-b239-100c560c8e2f';
  const rajeshUserId = '2156bccb-7c5d-4ce0-9845-41f09d9c996e';
  const amitUserId = 'fa1208eb-0b1a-47e9-8813-4d6870386fb1';
  const survivorTerritory = await db.territory.findFirst({ where: { name: 'Santosh Nagar & Yakutpura' } });

  await db.$transaction(async (tx) => {
    await tx.distributor.update({ where: { id: distributorId }, data: { territoryId: survivorTerritory.id } });
    await tx.employee.updateMany({ where: { managerId: amit }, data: { managerId: null } });
    await tx.order.deleteMany({ where: { OR: [{ chemistId }, { employeeId: rajesh }, { employeeId: amit }] } });
    await tx.tourPlanDay.deleteMany({ where: { territoryId } });
    await tx.tourPlan.deleteMany({ where: { employeeId: { in: [rajesh, amit] } } });
    await tx.collection.deleteMany({ where: { chemistId } });
    await tx.doctor.delete({ where: { id: doctorId } });
    await tx.chemist.delete({ where: { id: chemistId } });
    await tx.territory.delete({ where: { id: territoryId } });
    await tx.user.delete({ where: { id: rajeshUserId } });
    await tx.user.delete({ where: { id: amitUserId } });
  });
  console.log('North Delhi Central + Rajesh Kumar + Amit Sharma fully wiped.');
  await db.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
