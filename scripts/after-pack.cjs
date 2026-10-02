const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

/**
 * electron-builder can stamp a bad ElectronAsarIntegrity hash (SIGTRAP on open).
 * Helper .app names must stay ASCII — Turkish productName crashes Electron on macOS 27.
 * Dock label still uses CFBundleDisplayName = Yağmur ERP.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  for (const name of fs.readdirSync(context.appOutDir).filter((n) => n.endsWith(".app"))) {
    const app = path.join(context.appOutDir, name);
    const plist = path.join(app, "Contents", "Info.plist");
    if (!fs.existsSync(plist)) continue;

    try {
      execFileSync("plutil", ["-remove", "ElectronAsarIntegrity", plist], {
        stdio: "ignore",
      });
    } catch {
      // absent
    }

    try {
      execFileSync(
        "/usr/libexec/PlistBuddy",
        ["-c", "Set :CFBundleDisplayName Yağmur ERP", plist],
        { stdio: "ignore" },
      );
    } catch {
      try {
        execFileSync(
          "/usr/libexec/PlistBuddy",
          ["-c", "Add :CFBundleDisplayName string Yağmur ERP", plist],
          { stdio: "ignore" },
        );
      } catch {
        // ignore
      }
    }

    try {
      // Do not use --deep: it breaks Electron Framework on this macOS.
      execFileSync("codesign", ["--force", "--sign", "-", app], { stdio: "inherit" });
    } catch (error) {
      console.warn("afterPack codesign failed", error);
    }
    console.log("afterPack: fixed", name);
  }
};
