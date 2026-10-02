import { spawnSync } from "node:child_process";
import os from "node:os";
import { prepare } from "./prepare-standalone.mjs";

await prepare({ build: true });

const targets = os.platform() === "darwin" ? ["dmg", "dir"] : ["dir"];
const args = ["electron-builder", "--mac", ...targets, "--arm64", "--x64"];

const result = spawnSync("npx", args, {
  stdio: "inherit",
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
});
process.exit(result.status ?? 1);
