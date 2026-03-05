import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { HookPayload, Session } from "./state.ts";

export interface Logger {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  logEvent(payload: HookPayload, session: Session | null): void;
}

function getLogDir(logDir?: string): string {
  return logDir ?? path.join(os.homedir(), ".claude-code-dashboard", "logs");
}

function getLogFilePath(logDir?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(getLogDir(logDir), `${date}.log`);
}

function formatLogEntry(payload: HookPayload, session: Session | null): string {
  const timestamp = new Date().toISOString();
  const status = session ? session.status : "n/a";
  const entry = {
    timestamp,
    status,
    hook_event_name: payload.hook_event_name,
    session_id: payload.session_id,
    payload,
  };
  return JSON.stringify(entry);
}

export function createLogger(logDir?: string): Logger {
  let enabled = false;

  return {
    isEnabled() {
      return enabled;
    },

    setEnabled(value: boolean) {
      enabled = value;
    },

    logEvent(payload: HookPayload, session: Session | null) {
      if (!enabled) return;

      try {
        const dir = getLogDir(logDir);
        fs.mkdirSync(dir, { recursive: true });

        const logFile = getLogFilePath(logDir);
        const line = `${formatLogEntry(payload, session)}\n`;
        fs.appendFileSync(logFile, line, "utf-8");
      } catch {
        // Silently ignore logging errors to avoid disrupting the dashboard
      }
    },
  };
}
