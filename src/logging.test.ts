import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createLogger } from "./logging.ts";

let tmpDir: string;
let logDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccd-log-test-"));
  logDir = path.join(tmpDir, "logs");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createLogger", () => {
  it("starts disabled by default", () => {
    const logger = createLogger(logDir);
    assert.equal(logger.isEnabled(), false);
  });

  it("can be enabled and disabled", () => {
    const logger = createLogger(logDir);
    logger.setEnabled(true);
    assert.equal(logger.isEnabled(), true);
    logger.setEnabled(false);
    assert.equal(logger.isEnabled(), false);
  });

  it("does not write logs when disabled", () => {
    const logger = createLogger(logDir);
    logger.logEvent(
      { session_id: "s1", hook_event_name: "SessionStart", cwd: "/test" },
      {
        sessionId: "s1",
        status: "done",
        cwd: "/test",
        lastEvent: "SessionStart",
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
    );
    assert.equal(fs.existsSync(logDir), false);
  });

  it("writes log file when enabled", () => {
    const logger = createLogger(logDir);
    logger.setEnabled(true);
    logger.logEvent(
      { session_id: "s1", hook_event_name: "SessionStart", cwd: "/test" },
      {
        sessionId: "s1",
        status: "done",
        cwd: "/test",
        lastEvent: "SessionStart",
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
    );

    assert.ok(fs.existsSync(logDir));

    const files = fs.readdirSync(logDir);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith(".log"));

    const content = fs.readFileSync(path.join(logDir, files[0]), "utf-8");
    const entry = JSON.parse(content.trim());
    assert.equal(entry.hook_event_name, "SessionStart");
    assert.equal(entry.session_id, "s1");
    assert.equal(entry.status, "done");
    assert.ok(entry.timestamp);
    assert.ok(entry.payload);
  });

  it("logs null session for SessionEnd events", () => {
    const logger = createLogger(logDir);
    logger.setEnabled(true);
    logger.logEvent({ session_id: "s1", hook_event_name: "SessionEnd" }, null);

    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), "utf-8");
    const entry = JSON.parse(content.trim());
    assert.equal(entry.status, "n/a");
    assert.equal(entry.hook_event_name, "SessionEnd");
  });

  it("appends multiple entries to same log file", () => {
    const logger = createLogger(logDir);
    logger.setEnabled(true);
    logger.logEvent(
      { session_id: "s1", hook_event_name: "SessionStart", cwd: "/test" },
      {
        sessionId: "s1",
        status: "done",
        cwd: "/test",
        lastEvent: "SessionStart",
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
    );
    logger.logEvent(
      { session_id: "s1", hook_event_name: "UserPromptSubmit", cwd: "/test" },
      {
        sessionId: "s1",
        status: "running",
        cwd: "/test",
        lastEvent: "UserPromptSubmit",
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
    );

    const files = fs.readdirSync(logDir);
    assert.equal(files.length, 1);

    const content = fs.readFileSync(path.join(logDir, files[0]), "utf-8");
    const lines = content.trim().split("\n");
    assert.equal(lines.length, 2);
  });

  it("includes full payload with extra fields like tool_name", () => {
    const logger = createLogger(logDir);
    logger.setEnabled(true);
    logger.logEvent(
      { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", cwd: "/test" },
      {
        sessionId: "s1",
        status: "running",
        cwd: "/test",
        lastEvent: "Bash",
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
    );

    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), "utf-8");
    const entry = JSON.parse(content.trim());
    assert.equal(entry.payload.tool_name, "Bash");
  });
});
