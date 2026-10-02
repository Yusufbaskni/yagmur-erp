const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const migrationsDir = process.argv[2];
if (!migrationsDir) {
  console.error("Migration klasörü gerekli.");
  process.exit(1);
}

function statements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `);
    const names = fs
      .readdirSync(migrationsDir)
      .filter((name) => fs.existsSync(path.join(migrationsDir, name, "migration.sql")))
      .sort();
    for (const name of names) {
      if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Geçersiz migration adı: " + name);
      const existing = await prisma.$queryRawUnsafe(
        `SELECT "migration_name" FROM "_prisma_migrations" WHERE "migration_name" = '${name}' AND "finished_at" IS NOT NULL`,
      );
      if (existing.length > 0) continue;
      const file = path.join(migrationsDir, name, "migration.sql");
      const sql = fs.readFileSync(file, "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "applied_steps_count") VALUES ('${id}', '${checksum}', '${name}', CURRENT_TIMESTAMP, 0)`,
      );
      for (const statement of statements(sql)) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "_prisma_migrations" SET "finished_at" = CURRENT_TIMESTAMP, "applied_steps_count" = 1 WHERE "id" = '${id}'`,
      );
      console.log("Migration uygulandı:", name);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
