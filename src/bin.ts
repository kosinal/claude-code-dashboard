import { exec, spawn } from "node:child_process";
import * as http from "node:http";
import * as net from "node:net";
import { installHooks, removeHooks } from "./hooks.ts";
import { install, readLockFile, removeLockFile, uninstall, writeLockFile } from "./installer.ts";
import { createServer } from "./server.ts";
import { createStore } from "./state.ts";

const DEFAULT_PORT = 8377;

function parseArgs(argv: string[]): {
  port: number;
  command: string | null;
  noHooks: boolean;
  noOpen: boolean;
} {
  let port = DEFAULT_PORT;
  let command: string | null = null;
  let noHooks = false;
  let noOpen = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port" && i + 1 < argv.length) {
      port = parseInt(argv[++i], 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        console.error("Error: Invalid port number");
        process.exit(1);
      }
    } else if (arg === "--no-hooks") {
      noHooks = true;
    } else if (arg === "--no-open") {
      noOpen = true;
    } else if (arg === "install" || arg === "uninstall" || arg === "stop" || arg === "restart") {
      command = arg;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return { port, command, noHooks, noOpen };
}

function printHelp(): void {
  console.log(
    `
claude-code-dashboard - Real-time browser dashboard for Claude Code sessions

Usage:
  claude-code-dashboard                Start dashboard (quick mode)
  claude-code-dashboard install        Install persistent dashboard with auto-launch
  claude-code-dashboard uninstall      Remove persistent dashboard
  claude-code-dashboard stop           Stop the running dashboard
  claude-code-dashboard restart        Restart the running dashboard

Options:
  --port <number>   Port to use (default: ${DEFAULT_PORT})
  --no-hooks        Start server without installing hooks
  --no-open         Don't open the browser on start
  -h, --help        Show this help message

Quick mode (default):
  Starts the dashboard server and installs temporary hooks.
  Hooks are removed automatically when you stop the dashboard.

Install mode:
  Copies the server to ~/.claude/dashboard/ and installs persistent hooks.
  The dashboard auto-launches when a Claude Code session starts.
`.trim(),
  );
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function httpPost(port: number, urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: urlPath,
        method: "POST",
        timeout: 3000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode!, body: data }));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      try {
        process.kill(pid, 0);
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 100);
        }
      } catch {
        resolve(true);
      }
    };
    check();
  });
}

function forceKill(pid: number): void {
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {
    // Process may already be gone
  }
}

function waitForPortFree(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const srv = net.createServer();
      srv.once("error", () => {
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 200);
        }
      });
      srv.listen(port, "127.0.0.1", () => {
        srv.close(() => resolve(true));
      });
    };
    check();
  });
}

async function tryShutdownByPort(port: number): Promise<boolean> {
  try {
    const { status } = await httpPost(port, "/api/shutdown");
    return status === 200;
  } catch {
    return false;
  }
}

async function stopServer(): Promise<boolean> {
  const lock = readLockFile();
  if (!lock) {
    console.log("No running dashboard found.");
    return false;
  }

  try {
    await httpPost(lock.port, "/api/shutdown");
    const exited = await waitForExit(lock.pid, 5000);
    if (!exited) {
      forceKill(lock.pid);
      await waitForExit(lock.pid, 3000);
    }
  } catch {
    // HTTP failed — force kill
    forceKill(lock.pid);
    await waitForExit(lock.pid, 3000);
  }

  removeLockFile();
  console.log("Dashboard stopped.");
  return true;
}

function main(): void {
  const { port, command, noHooks, noOpen } = parseArgs(process.argv);

  if (command === "install") {
    install(port);
    return;
  }

  if (command === "uninstall") {
    uninstall();
    return;
  }

  if (command === "stop") {
    stopServer();
    return;
  }

  if (command === "restart") {
    (async () => {
      const lock = readLockFile();
      if (lock) {
        await stopServer();
      } else {
        const shutdown = await tryShutdownByPort(port);
        if (shutdown) {
          console.log("Shutting down dashboard via port...");
        } else {
          console.log("No running dashboard found. Starting fresh...");
        }
      }

      const portFree = await waitForPortFree(port, 5000);
      if (!portFree) {
        console.error(`Error: Port ${port} is still in use after timeout. Try --port <number>`);
        process.exit(1);
      }

      startDashboard(port, noHooks, noOpen);
    })();
    return;
  }

  // Quick mode (default) — start server
  startDashboard(port, noHooks, noOpen);
}

function startDashboard(port: number, noHooks: boolean, noOpen: boolean): void {
  const store = createStore();

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!noHooks) {
      try {
        removeHooks(undefined, "quick");
        console.log("\nHooks removed from settings.json");
      } catch (err) {
        console.error("Warning: Failed to remove hooks:", err);
      }
    }
    removeLockFile();
    dashboard.close().catch(() => {});
  }

  const dashboard = createServer({
    store,
    onShutdown() {
      cleanup();
      process.exit(0);
    },
    onRestart() {
      cleanup();
      const args = process.argv.slice(2).filter((a) => a !== "restart");
      const child = spawn(process.execPath, [process.argv[1], ...args], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      process.exit(0);
    },
  });

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    cleanup();
    process.exit(1);
  });

  dashboard.server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Error: Port ${port} is already in use. Try --port <number>`);
      process.exit(1);
    }
    throw err;
  });

  dashboard.listen(port, () => {
    if (!noHooks) {
      installHooks(port);
    }
    writeLockFile(port);

    const url = `http://localhost:${port}`;
    console.log(`Dashboard running at ${url}`);
    if (!noHooks) {
      console.log("Hooks installed in ~/.claude/settings.json");
    }
    console.log("Press Ctrl+C to stop");
    if (!noOpen) {
      openBrowser(url);
    }
  });
}

main();
