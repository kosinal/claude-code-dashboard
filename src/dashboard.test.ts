import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDashboardHtml } from "./dashboard.ts";

describe("getDashboardHtml", () => {
  const html = getDashboardHtml();

  it("returns valid HTML", () => {
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("</html>"));
  });

  it("contains EventSource for SSE", () => {
    assert.ok(html.includes("EventSource"));
    assert.ok(html.includes("/api/events"));
  });

  it("contains expected status CSS classes", () => {
    assert.ok(html.includes("status-running"));
    assert.ok(html.includes("status-waiting"));
    assert.ok(html.includes("status-done"));
  });

  it("contains connection status indicator", () => {
    assert.ok(html.includes("connection-status"));
    assert.ok(html.includes("connDot"));
    assert.ok(html.includes("Connected"));
    assert.ok(html.includes("Disconnected"));
  });

  it("contains dark theme background", () => {
    assert.ok(html.includes("#0d1117"));
  });

  it("contains SSE event handlers", () => {
    assert.ok(html.includes("event: init") || html.includes("'init'"));
    assert.ok(html.includes("event: update") || html.includes("'update'"));
  });

  it("requests notification permission on load", () => {
    assert.ok(html.includes("Notification.requestPermission"));
  });

  it("contains checkAndNotify function", () => {
    assert.ok(html.includes("function checkAndNotify"));
  });

  it("fires notification for waiting status", () => {
    assert.ok(html.includes("Claude Code - Waiting for input"));
  });

  it("uses tag to deduplicate notifications", () => {
    assert.ok(html.includes("claude-waiting-"));
  });
});
