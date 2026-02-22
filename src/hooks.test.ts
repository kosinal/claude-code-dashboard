import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { installHooks, removeHooks } from "./hooks.ts";

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

  it("hooks have correct properties (matcher-group format)", () => {
    installHooks(8377, tmpDir);
    const settings = readSettings() as {
      hooks: Record<string, Array<{ hooks: Array<{ type: string; async: boolean; statusMessage: string; command: string }> }>>;
    };
    const group = settings.hooks.SessionStart[0];
    assert.ok(group.hooks, "matcher group should have a hooks array");
    const hook = group.hooks[0];
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
            { matcher: "", hooks: [{ type: "command", command: "echo existing", async: false }] },
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

  it("backs up settings.json before installing", () => {
    const original = JSON.stringify({ some_setting: true });
    fs.writeFileSync(settingsPath(), original);
    installHooks(8377, tmpDir);
    const backupPath = settingsPath().replace(/\.json$/, ".pre-dashboard.json");
    assert.ok(fs.existsSync(backupPath));
    assert.equal(fs.readFileSync(backupPath, "utf-8"), original);
  });

  it("backup contains pre-install state (no dashboard hooks)", () => {
    const original = {
      hooks: {
        SessionStart: [
          { matcher: "", hooks: [{ type: "command", command: "echo user-hook", async: false }] },
        ],
      },
    };
    fs.writeFileSync(settingsPath(), JSON.stringify(original));
    installHooks(8377, tmpDir);
    const backupPath = settingsPath().replace(/\.json$/, ".pre-dashboard.json");
    const backed = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    assert.deepEqual(backed, original);
    // Backup should not contain dashboard hooks
    const hooks = backed.hooks.SessionStart;
    for (const group of hooks) {
      for (const h of group.hooks) {
        assert.notEqual(h.statusMessage, "__claude_code_dashboard__");
      }
    }
  });

  it("does not create backup when no settings file exists", () => {
    installHooks(8377, tmpDir);
    const backupPath = settingsPath().replace(/\.json$/, ".pre-dashboard.json");
    assert.ok(!fs.existsSync(backupPath));
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
            { matcher: "", hooks: [{ type: "command", command: "echo user-hook", async: false }] },
            {
              hooks: [{
                type: "command",
                command: "curl ...",
                async: true,
                statusMessage: "__claude_code_dashboard__",
              }],
            },
          ],
        },
      })
    );

    removeHooks(tmpDir);
    const settings = readSettings() as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    assert.equal(settings.hooks.SessionStart.length, 1);
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "echo user-hook");
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
