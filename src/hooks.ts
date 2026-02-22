import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const MARKER = "__claude_code_dashboard__";

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
  "SessionEnd",
] as const;

interface HookEntry {
  type: string;
  command: string;
  async: boolean;
  statusMessage?: string;
  [key: string]: unknown;
}

interface MatcherGroup {
  matcher?: string;
  hooks: HookEntry[];
  [key: string]: unknown;
}

interface Settings {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

function getConfigDir(configDir?: string): string {
  return configDir ?? path.join(os.homedir(), ".claude");
}

function getSettingsPath(configDir?: string): string {
  return path.join(getConfigDir(configDir), "settings.json");
}

function readSettings(configDir?: string): Settings {
  const settingsPath = getSettingsPath(configDir);
  try {
    const content = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(content);
    return parsed as Settings;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {};
    }
    // Invalid JSON — backup and return empty
    try {
      fs.copyFileSync(settingsPath, settingsPath + ".bak");
      console.warn(
        `Warning: Invalid settings.json backed up to ${settingsPath}.bak`
      );
    } catch {
      // Ignore backup failure
    }
    return {};
  }
}

function writeSettings(settings: Settings, configDir?: string): void {
  const settingsPath = getSettingsPath(configDir);
  const dir = path.dirname(settingsPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

function backupSettings(configDir?: string): void {
  const settingsPath = getSettingsPath(configDir);
  const backupPath = settingsPath.replace(/\.json$/, ".pre-dashboard.json");
  try {
    fs.copyFileSync(settingsPath, backupPath);
  } catch {
    // File doesn't exist or can't be copied — nothing to back up
  }
}

export function installHooks(port: number, configDir?: string): void {
  const settings = readSettings(configDir);
  backupSettings(configDir);

  // Clean any existing dashboard hooks first
  removeHooksFromSettings(settings);

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    const command =
      process.platform === "win32"
        ? `powershell -NoProfile -Command "$input | Invoke-WebRequest -Uri http://localhost:${port}/api/hook -Method POST -ContentType 'application/json' -ErrorAction SilentlyContinue | Out-Null"`
        : `curl -s -X POST -H "Content-Type: application/json" -d @- http://localhost:${port}/api/hook > /dev/null 2>&1`;

    settings.hooks[event].push({
      hooks: [{
        type: "command",
        command,
        async: true,
        statusMessage: MARKER,
      }],
    });
  }

  writeSettings(settings, configDir);
}

export function installHooksWithCommand(
  command: string,
  configDir?: string
): void {
  const settings = readSettings(configDir);
  backupSettings(configDir);

  // Clean any existing dashboard hooks first
  removeHooksFromSettings(settings);

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    settings.hooks[event].push({
      hooks: [{
        type: "command",
        command,
        async: true,
        statusMessage: MARKER,
      }],
    });
  }

  writeSettings(settings, configDir);
}

function removeHooksFromSettings(settings: Settings): void {
  if (!settings.hooks) return;

  for (const event of HOOK_EVENTS) {
    const groups = settings.hooks[event];
    if (!groups) continue;

    const filtered: MatcherGroup[] = [];
    for (const group of groups) {
      const kept = group.hooks.filter((h) => h.statusMessage !== MARKER);
      if (kept.length > 0) {
        filtered.push({ ...group, hooks: kept });
      }
      // If all hooks in the group were dashboard hooks, drop the entire group
    }

    if (filtered.length > 0) {
      settings.hooks[event] = filtered;
    } else {
      delete settings.hooks[event];
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
}

export function removeHooks(configDir?: string): void {
  const settingsPath = getSettingsPath(configDir);
  try {
    fs.accessSync(settingsPath);
  } catch {
    return; // No settings file — nothing to do
  }

  const settings = readSettings(configDir);
  removeHooksFromSettings(settings);
  writeSettings(settings, configDir);
}
