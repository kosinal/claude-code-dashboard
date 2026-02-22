import { createStore } from "./state.js";
import { createServer } from "./server.js";
import { installHooks, removeHooks } from "./hooks.js";
import { install, uninstall, writeLockFile, removeLockFile } from "./installer.js";

const DEFAULT_PORT = 8377;

function parseArgs(argv: string[]): {
  port: number;
  command: string | null;
  noHooks: boolean;
} {
  let port = DEFAULT_PORT;
  let command: string | null = null;
  let noHooks = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port" && i + 1 < argv.length) {
      port = parseInt(argv[++i], 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error("Error: Invalid port number");
        process.exit(1);
      }
    } else if (arg === "--no-hooks") {
      noHooks = true;
    } else if (arg === "install" || arg === "uninstall") {
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

  return { port, command, noHooks };
}

function printHelp(): void {
  console.log(`
claude-code-dashboard - Real-time browser dashboard for Claude Code sessions

Usage:
  claude-code-dashboard                Start dashboard (quick mode)
  claude-code-dashboard install        Install persistent dashboard with auto-launch
  claude-code-dashboard uninstall      Remove persistent dashboard

Options:
  --port <number>   Port to use (default: ${DEFAULT_PORT})
  --no-hooks        Start server without installing hooks
  -h, --help        Show this help message

Quick mode (default):
  Starts the dashboard server and installs temporary hooks.
  Hooks are removed automatically when you stop the dashboard.

Install mode:
  Copies the server to ~/.claude/dashboard/ and installs persistent hooks.
  The dashboard auto-launches when a Claude Code session starts.
`.trim());
}

function main(): void {
  const { port, command, noHooks } = parseArgs(process.argv);

  if (command === "install") {
    install(port);
    return;
  }

  if (command === "uninstall") {
    uninstall();
    return;
  }

  // Quick mode (default) — start server
  const store = createStore();
  const dashboard = createServer(store);

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!noHooks) {
      try {
        removeHooks();
        console.log("\nHooks removed from settings.json");
      } catch (err) {
        console.error("Warning: Failed to remove hooks:", err);
      }
    }
    removeLockFile();
    dashboard.close().catch(() => {});
  }

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
      console.error(
        `Error: Port ${port} is already in use. Try --port <number>`
      );
      process.exit(1);
    }
    throw err;
  });

  if (!noHooks) {
    installHooks(port);
  }

  writeLockFile();

  dashboard.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
    if (!noHooks) {
      console.log("Hooks installed in ~/.claude/settings.json");
    }
    console.log("Press Ctrl+C to stop");
  });
}

main();
