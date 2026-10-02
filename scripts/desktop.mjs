import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { prepare } from "./prepare-standalone.mjs";

const root = process.cwd();

function newest(target, stamp) {
  let latest = stamp;
  if (!fs.existsSync(target)) return latest;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      if (entry === "node_modules" || entry === ".next") continue;
      latest = newest(path.join(target, entry), latest);
    }
    return latest;
  }
  return Math.max(latest, stat.mtimeMs);
}

function needsBuild() {
  if (process.argv.includes("--build")) return true;
  const serverJs = path.join(root, ".next", "standalone", "server.js");
  if (!fs.existsSync(serverJs)) return true;
  const built = fs.statSync(serverJs).mtimeMs;
  const sources = [
    path.join(root, "src"),
    path.join(root, "prisma", "schema.prisma"),
    path.join(root, "prisma", "migrations"),
    path.join(root, "next.config.ts"),
    path.join(root, "package.json"),
  ];
  return sources.some((target) => newest(target, 0) > built);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} çıktı ${code}`));
    });
  });
}

const build = needsBuild();
if (build) {
  console.log("Masaüstü paketi derleniyor…");
}
await prepare({ build });

await run("npx", ["prisma", "migrate", "deploy"]);
await run("npx", ["tsx", "prisma/seed.ts"]);

const electron = path.join(root, "node_modules", ".bin", "electron");
const child = spawn(electron, ["."], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
