import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const databaseFile = path.join(process.cwd(), "prisma", "test.db");
const databaseUrl = `file:${databaseFile}`;
process.env.DATABASE_URL = databaseUrl;
process.env.AUTH_SECRET = "test-secret";

for (const file of [databaseFile, `${databaseFile}-journal`]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
