import { db } from "@/lib/db";

export async function getWorkflowSettings() {
  const existing = await db.workflowSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.workflowSettings.create({ data: { id: "singleton" } });
}
