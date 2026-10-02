const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const HOST = "127.0.0.1";
const AUTH_SECRET = process.env.AUTH_SECRET || "yagmur-erp-yerel-gelistirme-anahtari";

let serverProcess = null;
let serverLog = "";

function projectRoot() {
  return path.join(__dirname, "..");
}

function standaloneDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, "standalone");
  return path.join(projectRoot(), ".next", "standalone");
}

function databaseFile() {
  if (app.isPackaged) {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "yagmur.db");
  }
  return path.join(projectRoot(), "prisma", "dev.db");
}

function databaseUrl() {
  return `file:${databaseFile()}`;
}

function serverEnv() {
  return {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: HOST,
    DATABASE_URL: databaseUrl(),
    AUTH_SECRET,
    COOKIE_SECURE: "0",
    ELECTRON_RUN_AS_NODE: app.isPackaged ? "1" : "",
  };
}

function nodeCommand() {
  return app.isPackaged ? process.execPath : "node";
}

function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeCommand(), args, {
      cwd: options.cwd,
      env: { ...serverEnv(), ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(output || `Komut başarısız (${code})`));
    });
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(port) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (serverProcess && serverProcess.exitCode !== null) {
        reject(new Error(serverLog || "Sunucu kapandı."));
        return;
      }
      const request = http.get({ host: HOST, port, path: "/giris", timeout: 2000 }, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.on("error", retry);
      request.on("timeout", () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > 60000) reject(new Error(serverLog || "Sunucu açılmadı."));
      else setTimeout(tick, 250);
    };
    tick();
  });
}

function startServer(port) {
  const env = serverEnv();
  env.PORT = String(port);
  if (!app.isPackaged) delete env.ELECTRON_RUN_AS_NODE;
  serverProcess = spawn(nodeCommand(), ["server.js"], {
    cwd: standaloneDir(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (chunk) => {
    const text = chunk.toString();
    serverLog = (serverLog + text).slice(-8000);
    process.stdout.write(text);
  };
  serverProcess.stdout.on("data", collect);
  serverProcess.stderr.on("data", collect);
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
  serverProcess = null;
}

async function preparePackagedDatabase() {
  const resources = process.resourcesPath;
  const nodePath = path.join(resources, "standalone", "node_modules");
  await runNode([path.join(resources, "apply-migrations.cjs"), path.join(resources, "prisma", "migrations")], {
    cwd: resources,
    env: { NODE_PATH: nodePath },
  });
  await runNode([path.join(resources, "seed-bundle.cjs")], {
    cwd: resources,
    env: { NODE_PATH: nodePath },
  });
}

function applicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Yağmur ERP",
      submenu: [
        {
          label: "Yağmur ERP hakkında",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "Yağmur ERP",
              message: "Yağmur ERP",
              detail: "Yağmur Gıda Ticaret için toptan ve perakende ticari operasyon.\nSürüm " + app.getVersion(),
            });
          },
        },
        { type: "separator" },
        { label: "Çıkış", role: "quit" },
      ],
    },
    {
      label: "Düzen",
      submenu: [
        { label: "Kes", role: "cut" },
        { label: "Kopyala", role: "copy" },
        { label: "Yapıştır", role: "paste" },
        { label: "Tümünü seç", role: "selectAll" },
      ],
    },
    {
      label: "Görünüm",
      submenu: [
        { label: "Yenile", role: "reload" },
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { label: "Gerçek boyut", role: "resetZoom" },
        { type: "separator" },
        { label: "Tam ekran", role: "togglefullscreen" },
      ],
    },
  ]);
}

function createWindow(port) {
  const window = new BrowserWindow({
    title: "Yağmur ERP",
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#f7f4ee",
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on("page-title-updated", (event) => {
    event.preventDefault();
  });
  window.setTitle("Yağmur ERP");

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith(`http://${HOST}:${port}`);
    if (!allowed) {
      event.preventDefault();
      if (url.startsWith("http")) shell.openExternal(url);
    }
  });

  window.once("ready-to-show", () => {
    window.setPosition(40, 40);
    window.show();
  });
  window.loadURL(`http://${HOST}:${port}/giris`);

  window.webContents.once("did-finish-load", () => {
    setTimeout(async () => {
      try {
        if (process.env.YAGMUR_LOGIN_CHECK === "1") {
          const hydrated = await window.webContents.executeJavaScript(`
            new Promise((resolve) => {
              const started = Date.now();
              const tick = () => {
                const button = document.querySelector("form button[type=submit]");
                const ready = button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
                if (ready || Date.now() - started > 10000) resolve(Boolean(ready));
                else setTimeout(tick, 200);
              };
              tick();
            })
          `);
          console.log("HYDRATED", hydrated);
          const landed = window.webContents.executeJavaScript(`
            new Promise((resolve, reject) => {
              document.querySelector("form").requestSubmit();
              const started = Date.now();
              const tick = () => {
                const text = document.body ? document.body.innerText : "";
                if (location.pathname === "/" && text.includes("Operasyon paneli")) {
                  resolve(location.href);
                  return;
                }
                if (Date.now() - started > 20000) {
                  reject(new Error(location.href + " " + text.slice(0, 240)));
                  return;
                }
                setTimeout(tick, 200);
              };
              tick();
            })
          `);
          const nextUrl = await landed;
          console.log("LOGIN_OK", nextUrl);
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
        if (process.env.YAGMUR_SCREENSHOT) {
          window.show();
          window.focus();
          const bounds = window.getBounds();
          const grabbed = spawnSync(
            "ffmpeg",
            [
              "-y",
              "-loglevel",
              "error",
              "-f",
              "x11grab",
              "-video_size",
              `${bounds.width}x${bounds.height}`,
              "-i",
              `${process.env.DISPLAY || ":1"}+${Math.max(bounds.x, 0)},${Math.max(bounds.y, 0)}`,
              "-frames:v",
              "1",
              process.env.YAGMUR_SCREENSHOT,
            ],
            { encoding: "utf8" },
          );
          if (grabbed.status !== 0) {
            const image = await window.webContents.capturePage();
            fs.writeFileSync(process.env.YAGMUR_SCREENSHOT, image.toPNG());
            if (grabbed.stderr) console.error(grabbed.stderr);
          }
          console.log("Ekran görüntüsü yazıldı:", process.env.YAGMUR_SCREENSHOT);
        }
      } catch (error) {
        console.error(error);
        process.exitCode = 1;
      }
      if (process.env.YAGMUR_SCREENSHOT_EXIT === "1") app.quit();
    }, 800);
  });

  return window;
}

async function boot() {
  Menu.setApplicationMenu(applicationMenu());
  try {
    if (app.isPackaged) await preparePackagedDatabase();
    const port = await findFreePort();
    startServer(port);
    await waitForServer(port);
    createWindow(port);
  } catch (error) {
    dialog.showErrorBox("Yağmur ERP açılamadı", error instanceof Error ? error.message : String(error));
    app.quit();
  }
}

const locked = app.requestSingleInstanceLock();
if (!locked) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(boot);
  app.on("window-all-closed", () => {
    stopServer();
    app.quit();
  });
  app.on("before-quit", stopServer);
}
