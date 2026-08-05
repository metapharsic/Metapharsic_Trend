import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// Helper to write to logs/backend/database.log
function logToBackend(message: string) {
  try {
    const logDir = path.join(process.cwd(), "logs", "backend");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "database.log");
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error("Failed to write database log:", err);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create client with query logging
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
      { emit: "event", level: "info" },
      { emit: "event", level: "warn" },
    ],
  });

  // Attach event hooks to write to local logs
  (client as any).$on("query", (e: any) => {
    logToBackend(`[QUERY] ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
  });

  (client as any).$on("error", (e: any) => {
    logToBackend(`[ERROR] ${e.message}`);
  });

  (client as any).$on("warn", (e: any) => {
    logToBackend(`[WARN] ${e.message}`);
  });

  return client;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db as any;
}
