import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";

const root = process.cwd();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

export async function prepare({ build = true } = {}) {
  if (build) {
    run("npx", ["prisma", "generate"]);
    run("npx", ["next", "build"]);
  }

  const standalone = path.join(root, ".next", "standalone");
  const serverJs = path.join(standalone, "server.js");
  if (!fs.existsSync(serverJs)) {
    console.error("Standalone sunucu yok. Önce npm run desktop:build çalıştırın.");
    process.exit(1);
  }

  copyDir(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
  const publicDir = path.join(root, "public");
  if (fs.existsSync(publicDir)) {
    copyDir(publicDir, path.join(standalone, "public"));
  }

  const standaloneModules = path.join(standalone, "node_modules");
  fs.mkdirSync(path.join(standaloneModules, "@prisma"), { recursive: true });
  copyDir(path.join(root, "node_modules", ".prisma"), path.join(standaloneModules, ".prisma"));
  copyDir(
    path.join(root, "node_modules", "@prisma", "client"),
    path.join(standaloneModules, "@prisma", "client"),
  );

  fs.mkdirSync(path.join(root, "electron"), { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, "prisma", "seed.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(root, "electron", "seed-bundle.cjs"),
    external: ["@prisma/client"],
    plugins: [
      {
        name: "at-alias",
        setup(build) {
          build.onResolve({ filter: /^@\// }, (args) => {
            const base = path.join(root, "src", args.path.slice(2));
            const candidates = [
              base,
              `${base}.ts`,
              `${base}.tsx`,
              path.join(base, "index.ts"),
              path.join(base, "index.tsx"),
            ];
            const file = candidates.find((candidate) => fs.existsSync(candidate));
            return { path: file ?? base };
          });
        },
      },
    ],
  });
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(root, "scripts/prepare-standalone.mjs");
if (direct) {
  await prepare({ build: true });
}
