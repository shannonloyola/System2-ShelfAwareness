import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, hasDatabaseConfig } from "../lib/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../sql");

const run = async () => {
  if (!hasDatabaseConfig) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = getPool();
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(
      path.join(migrationsDir, file),
      "utf8",
    );
    await pool.query(sql);
    console.log(`Applied migration: ${file}`);
  }

  await pool.end();
};

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
