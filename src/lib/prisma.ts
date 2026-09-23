import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

// Cached on globalThis in every environment: the custom server (server.js via tsx),
// the cleanup job and the Next.js bundle run in the same process and must share one
// client and one connection pool.
export const prisma = (globalForPrisma.prisma ??= createPrismaClient());
