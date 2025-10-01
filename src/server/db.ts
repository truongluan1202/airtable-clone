import { PrismaClient, Prisma } from "@prisma/client";
import { env } from "~/env.js";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: env.DIRECT_DATABASE_URL, // Use direct connection as configured in schema
      },
    },
    // Direct connection - no Accelerate, no 5MB limit
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
