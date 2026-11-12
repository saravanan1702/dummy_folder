import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function client(): PrismaClient {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  globalForPrisma.__prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  return globalForPrisma.__prisma;
}

/** Lazily connected Prisma client (created on first use, shared across hot reloads). */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
