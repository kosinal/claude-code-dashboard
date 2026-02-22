import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { installHooks, installHooksWithCommand, removeHooks } from "./hooks.ts";

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

type HookSettings = {
  hooks: Record<
    string,
    Array<{
      hooks: Array<{ type: string; async: boolean; statusMessage: string; command: string }>;
    }>
  >;
  [key: string]: unknown;
};

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
    const settings = readSettings() as HookSettings;
    const group = settings.hooks.SessionStart[0];
    assert.ok(group.hooks, "matcher group should have a hooks array");
    const hook = group.hooks[0];
    assert.equal(hook.type, "command");
    assert.equal(hook.async, true);
    assert.equal(hook.statusMessage, "__claude_code_dashboard_quick__");
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
      }),
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
        assert.notEqual(h.statusMessage, "__claude_code_dashboard_quick__");
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
              hooks: [
                {
                  type: "command",
                  command: "curl ...",
                  async: true,
                  statusMessage: "__claude_code_dashboard_quick__",
                },
              ],
            },
          ],
        },
      }),
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
    assert.ok(fs.existsSync(`${settingsPath()}.bak`));
  });

  it("cleans up empty hooks object", () => {
    installHooks(8377, tmpDir);
    removeHooks(tmpDir);
    const settings = readSettings();
    assert.equal(settings.hooks, undefined);
  });
});

describe("marker isolation", () => {
  it("quick mode does not remove install mode hooks", () => {
    // Install mode hooks first
    installHooksWithCommand('node "hook.mjs"', tmpDir);
    const afterInstall = readSettings() as HookSettings;
    assert.equal(
      afterInstall.hooks.SessionStart[0].hooks[0].statusMessage,
      "__claude_code_dashboard_install__",
    );

    // Quick mode hooks — should add alongside install hooks
    installHooks(8377, tmpDir);
    const afterQuick = readSettings() as HookSettings;
    assert.equal(afterQuick.hooks.SessionStart.length, 2);

    // One install, one quick
    const markers = afterQuick.hooks.SessionStart.map((g) => g.hooks[0].statusMessage);
    assert.ok(markers.includes("__claude_code_dashboard_install__"));
    assert.ok(markers.includes("__claude_code_dashboard_quick__"));
  });

  it("install mode does not remove quick mode hooks", () => {
    // Quick mode hooks first
    installHooks(8377, tmpDir);
    const afterQuick = readSettings() as HookSettings;
    assert.equal(
      afterQuick.hooks.SessionStart[0].hooks[0].statusMessage,
      "__claude_code_dashboard_quick__",
    );

    // Install mode hooks — should add alongside quick hooks
    installHooksWithCommand('node "hook.mjs"', tmpDir);
    const afterInstall = readSettings() as HookSettings;
    assert.equal(afterInstall.hooks.SessionStart.length, 2);

    const markers = afterInstall.hooks.SessionStart.map((g) => g.hooks[0].statusMessage);
    assert.ok(markers.includes("__claude_code_dashboard_quick__"));
    assert.ok(markers.includes("__claude_code_dashboard_install__"));
  });

  it("removeHooks with quick mode only removes quick hooks", () => {
    // Set up both modes
    installHooksWithCommand('node "hook.mjs"', tmpDir);
    installHooks(8377, tmpDir);

    const before = readSettings() as HookSettings;
    assert.equal(before.hooks.SessionStart.length, 2);

    // Remove only quick
    removeHooks(tmpDir, "quick");
    const after = readSettings() as HookSettings;
    assert.equal(after.hooks.SessionStart.length, 1);
    assert.equal(
      after.hooks.SessionStart[0].hooks[0].statusMessage,
      "__claude_code_dashboard_install__",
    );
  });

  it("removeHooks with install mode only removes install hooks", () => {
    // Set up both modes
    installHooks(8377, tmpDir);
    installHooksWithCommand('node "hook.mjs"', tmpDir);

    const before = readSettings() as HookSettings;
    assert.equal(before.hooks.SessionStart.length, 2);

    // Remove only install
    removeHooks(tmpDir, "install");
    const after = readSettings() as HookSettings;
    assert.equal(after.hooks.SessionStart.length, 1);
    assert.equal(
      after.hooks.SessionStart[0].hooks[0].statusMessage,
      "__claude_code_dashboard_quick__",
    );
  });

  it("removeHooks without mode removes all hooks", () => {
    installHooks(8377, tmpDir);
    installHooksWithCommand('node "hook.mjs"', tmpDir);

    const before = readSettings() as HookSettings;
    assert.equal(before.hooks.SessionStart.length, 2);

    removeHooks(tmpDir);
    const after = readSettings();
    assert.equal(after.hooks, undefined);
  });

  it("both modes clean up legacy marker hooks", () => {
    // Simulate legacy hooks (old marker)
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "curl ...",
                  async: true,
                  statusMessage: "__claude_code_dashboard__",
                },
              ],
            },
          ],
        },
      }),
    );

    // Quick mode should remove the legacy hook and add its own
    installHooks(8377, tmpDir);
    const afterQuick = readSettings() as HookSettings;
    assert.equal(afterQuick.hooks.SessionStart.length, 1);
    assert.equal(
      afterQuick.hooks.SessionStart[0].hooks[0].statusMessage,
      "__claude_code_dashboard_quick__",
    );
  });

  it("install mode cleans up legacy marker hooks", () => {
    // Simulate legacy hooks (old marker)
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "curl ...",
                  async: true,
                  statusMessage: "__claude_code_dashboard__",
                },
              ],
            },
          ],
        },
      }),
    );

    installHooksWithCommand('node "hook.mjs"', tmpDir);
    const afterInstall = readSettings() as HookSettings;
    assert.equal(afterInstall.hooks.SessionStart.length, 1);
    assert.equal(
      afterInstall.hooks.SessionStart[0].hooks[0].statusMessage,
      "__claude_code_dashboard_install__",
    );
  });

  it("removeHooks with mode also cleans up legacy hooks", () => {
    // Mix of legacy + quick hooks
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "curl legacy",
                  async: true,
                  statusMessage: "__claude_code_dashboard__",
                },
              ],
            },
            {
              hooks: [
                {
                  type: "command",
                  command: "curl quick",
                  async: true,
                  statusMessage: "__claude_code_dashboard_quick__",
                },
              ],
            },
            { matcher: "", hooks: [{ type: "command", command: "echo user", async: false }] },
          ],
        },
      }),
    );

    removeHooks(tmpDir, "quick");
    const after = readSettings() as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    // Only user hook should remain (legacy + quick both removed)
    assert.equal(after.hooks.SessionStart.length, 1);
    assert.equal(after.hooks.SessionStart[0].hooks[0].command, "echo user");
  });

  it("installHooksWithCommand uses install marker", () => {
    installHooksWithCommand('node "hook.mjs"', tmpDir);
    const settings = readSettings() as HookSettings;
    const hook = settings.hooks.SessionStart[0].hooks[0];
    assert.equal(hook.statusMessage, "__claude_code_dashboard_install__");
    assert.equal(hook.command, 'node "hook.mjs"');
  });
});
