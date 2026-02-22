import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { installHooks, removeHooks } from "./hooks.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccd-test-"));
});

function settingsPath(): string {
  return path.join(tmpDir, "settings.json");
}

function readSettings(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(settingsPath(), "utf-8"));
}

describe("installHooks", () => {
  it("creates settings.json when missing", () => {
    installHooks(8377, tmpDir);
    assert.ok(fs.existsSync(settingsPath()));
    const settings = readSettings();
    assert.ok(settings.hooks);
  });

  it("creates all 4 hook events", () => {
    installHooks(8377, tmpDir);
    const settings = readSettings() as { hooks: Record<string, unknown[]> };
    assert.ok(settings.hooks.SessionStart);
    assert.ok(settings.hooks.UserPromptSubmit);
    assert.ok(settings.hooks.Stop);
    assert.ok(settings.hooks.SessionEnd);
  });

  it("hooks have correct properties", () => {
    installHooks(8377, tmpDir);
    const settings = readSettings() as {
      hooks: Record<string, Array<{ type: string; async: boolean; statusMessage: string; command: string }>>;
    };
    const hook = settings.hooks.SessionStart[0];
    assert.equal(hook.type, "command");
    assert.equal(hook.async, true);
    assert.equal(hook.statusMessage, "__claude_code_dashboard__");
    assert.ok(hook.command.includes("8377"));
  });

  it("merges without destroying existing settings", () => {
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({
        some_setting: true,
        hooks: {
          SessionStart: [
            { type: "command", command: "echo existing", async: false },
          ],
        },
      })
    );

    installHooks(8377, tmpDir);
    const settings = readSettings() as {
      some_setting: boolean;
      hooks: Record<string, unknown[]>;
    };
    assert.equal(settings.some_setting, true);
    assert.equal(settings.hooks.SessionStart.length, 2); // existing + new
  });

  it("is idempotent (no duplicate entries)", () => {
    installHooks(8377, tmpDir);
    installHooks(8377, tmpDir);
    const settings = readSettings() as {
      hooks: Record<string, unknown[]>;
    };
    assert.equal(settings.hooks.SessionStart.length, 1);
  });
});

describe("removeHooks", () => {
  it("removes only dashboard hooks, keeps others", () => {
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({
        hooks: {
          SessionStart: [
            { type: "command", command: "echo user-hook", async: false },
            {
              type: "command",
              command: "curl ...",
              async: true,
              statusMessage: "__claude_code_dashboard__",
            },
          ],
        },
      })
    );

    removeHooks(tmpDir);
    const settings = readSettings() as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    assert.equal(settings.hooks.SessionStart.length, 1);
    assert.equal(settings.hooks.SessionStart[0].command, "echo user-hook");
  });

  it("is a no-op when hooks not installed", () => {
    fs.writeFileSync(settingsPath(), JSON.stringify({ some_setting: true }));
    removeHooks(tmpDir);
    const settings = readSettings();
    assert.equal(settings.some_setting, true);
    assert.equal(settings.hooks, undefined);
  });

  it("is a no-op when settings file does not exist", () => {
    // Should not throw
    removeHooks(tmpDir);
  });

  it("handles malformed JSON gracefully", () => {
    fs.writeFileSync(settingsPath(), "not valid json{{{");
    // installHooks should backup and continue
    installHooks(8377, tmpDir);
    const settings = readSettings();
    assert.ok(settings.hooks);
    // Backup should exist
    assert.ok(fs.existsSync(settingsPath() + ".bak"));
  });

  it("cleans up empty hooks object", () => {
    installHooks(8377, tmpDir);
    removeHooks(tmpDir);
    const settings = readSettings();
    assert.equal(settings.hooks, undefined);
  });
});
