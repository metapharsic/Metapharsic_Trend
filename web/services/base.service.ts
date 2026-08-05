import { db } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

/**
 * BaseService provides a structured way to handle business logic while
 * standardizing error handling and database access.
 */
export class BaseService {
  protected db: PrismaClient;

  constructor() {
    this.db = db;
  }

  /**
   * Standardized error wrapper for database operations
   */
  protected async withErrorHandling<T>(operation: () => Promise<T>, context: string = "Database Operation"): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`[BaseService Error] ${context}:`, error);
      // Here we could throw a standard API error that gets caught by the Next.js boundary
      throw new Error(`Failed during ${context}: ${error.message}`);
    }
  }
}
