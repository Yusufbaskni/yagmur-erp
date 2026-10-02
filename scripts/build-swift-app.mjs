import { spawnSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { prepare } from "./prepare-standalone.mjs";

const root = process.cwd();
const desktop = path.join(root, "desktop");
const outRoot = path.join(root, "dist", "swift");
const appName = "Yagmur ERP.app";
const appPath = path.join(outRoot, appName);
const installPath = path.join("/Applications", appName);
const NODE_VERSION = "22.20.0";
const NODE_ARCH = process.arch === "x64" ? "x64" : "arm64";
const NODE_NAME = `node-v${NODE_VERSION}-darwin-${NODE_ARCH}`;
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_NAME}.tar.gz`;

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copy(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Node indirilemedi (${res.statusCode})`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
}

async function ensureBundledNode(resources) {
  const cacheDir = path.join(desktop, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const tarball = path.join(cacheDir, `${NODE_NAME}.tar.gz`);
  const extracted = path.join(cacheDir, NODE_NAME);
  const nodeBin = path.join(extracted, "bin", "node");
  if (!fs.existsSync(nodeBin)) {
    console.log("Resmi Node indiriliyor:", NODE_URL);
    await download(NODE_URL, tarball);
    run("tar", ["-xzf", tarball, "-C", cacheDir]);
  }
  if (!fs.existsSync(nodeBin)) {
    throw new Error("Node paketi açılamadı.");
  }
  copy(extracted, path.join(resources, "node"));
  fs.chmodSync(path.join(resources, "node", "bin", "node"), 0o755);
  console.log("Node pakete gömüldü:", NODE_NAME);
}

const skipBuild = process.argv.includes("--no-build");
await prepare({ build: !skipBuild });

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(appPath, "Contents", "MacOS"), { recursive: true });
fs.mkdirSync(path.join(appPath, "Contents", "Resources"), { recursive: true });

const resources = path.join(appPath, "Contents", "Resources");
copy(path.join(root, ".next", "standalone"), path.join(resources, "standalone"));
copy(path.join(root, "prisma", "schema.prisma"), path.join(resources, "prisma", "schema.prisma"));
copy(path.join(root, "prisma", "migrations"), path.join(resources, "prisma", "migrations"));
copy(path.join(root, "electron", "apply-migrations.cjs"), path.join(resources, "apply-migrations.cjs"));
copy(path.join(root, "electron", "seed-bundle.cjs"), path.join(resources, "seed-bundle.cjs"));
fs.copyFileSync(path.join(desktop, "Info.plist"), path.join(appPath, "Contents", "Info.plist"));
await ensureBundledNode(resources);

const iconSrc = path.join(desktop, "AppIcon.icns");
if (!fs.existsSync(iconSrc)) {
  run("python3", [path.join(desktop, "make_icon.py")]);
}
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(resources, "AppIcon.icns"));
} else {
  console.warn("Uyarı: AppIcon.icns yok.");
}

const binary = path.join(appPath, "Contents", "MacOS", "YagmurERP");
run("swiftc", [
  "-O",
  path.join(desktop, "YagmurERP.swift"),
  "-o",
  binary,
  "-framework",
  "Cocoa",
  "-framework",
  "WebKit",
  "-framework",
  "Security",
]);
fs.chmodSync(binary, 0o755);

run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
console.log("Swift uygulama hazır:", appPath);

if (!process.argv.includes("--no-install")) {
  spawnSync("osascript", ["-e", 'tell application "Yagmur ERP" to quit'], { stdio: "ignore" });
  fs.rmSync(installPath, { recursive: true, force: true });
  fs.cpSync(appPath, installPath, { recursive: true });
  run("codesign", ["--force", "--deep", "--sign", "-", installPath]);
  console.log("Kuruldu:", installPath);
  spawnSync("open", ["-a", installPath], { stdio: "ignore" });
}
