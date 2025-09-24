import { PrismaClient } from "@/generated/prisma"
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';

type BetterSqliteDb = InstanceType<typeof Database>;
const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
    sqliteDb?: BetterSqliteDb;
};

const sqlitePath = process.env.NODE_ENV === 'production' 
    ? path.resolve(process.cwd(), 'data', 'snowshare.db')
    : path.resolve(process.cwd(), 'prisma', 'dev.db');
const db: BetterSqliteDb = globalForPrisma.sqliteDb ?? new Database(sqlitePath);

// Pass both db and url to the adapter!
const adapter = new PrismaBetterSQLite3({
    db,
    url: `file:${sqlitePath}`,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
    globalForPrisma.sqliteDb = db;
}