#!/usr/bin/env node
/**
 * Starts an embedded PostgreSQL instance for e2e tests.
 * Writes the DATABASE_URL to stdout so the caller can export it.
 * Keeps the process alive until SIGTERM/SIGINT.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PORT = 5433;
const DB_NAME = "e2e_db";
const DB_USER = "e2e_user";
const DB_PASS = "e2e_password";
const DATA_DIR = path.join(__dirname, ".pg-data");

// Remove stale data directory from previous runs
if (fs.existsSync(DATA_DIR)) {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: DB_PORT,
  dbName: DB_NAME,
  user: DB_USER,
  password: DB_PASS,
  persistent: false,
  // embedded-postgres hardcodes --lc-messages=en_US.UTF-8 which fails on
  // systems that don't have that locale. Override by appending C locale flags.
  initdbFlags: ["--lc-messages=C", "--no-locale", "--encoding=UTF8"],
});

async function main() {
  process.stderr.write(`[start-db] initialising in ${DATA_DIR}\n`);
  await pg.initialise();
  process.stderr.write("[start-db] starting...\n");
  await pg.start();
  process.stderr.write("[start-db] creating database...\n");
  await pg.createDatabase(DB_NAME);

  const url = `postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?schema=public`;
  // Write the URL on a dedicated line so the shell can parse it
  process.stdout.write(`DATABASE_URL=${url}\n`);
  process.stdout.write("EMBEDDED_PG_READY\n");
  process.stderr.write("[start-db] ready\n");

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error("Failed to start embedded PostgreSQL:", err);
  process.exit(1);
});
