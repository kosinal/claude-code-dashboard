import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

  it("contains Stop and Restart buttons", () => {
    assert.ok(html.includes('id="btnStop"'));
    assert.ok(html.includes('id="btnRestart"'));
    assert.ok(html.includes("btn-danger"));
  });

  it("contains overlay container", () => {
    assert.ok(html.includes('id="overlayContainer"'));
  });

  it("contains notification toggle and footer controls", () => {
    assert.ok(html.includes("notification-toggle"));
    assert.ok(html.includes('id="notifToggle"'));
    assert.ok(html.includes("<footer>"));
  });

  it("contains overlay CSS styles", () => {
    assert.ok(html.includes(".overlay"));
    assert.ok(html.includes(".overlay-card"));
  });

  it("contains confirmation dialog functions", () => {
    assert.ok(html.includes("function showConfirm"));
    assert.ok(html.includes("function showOverlay"));
  });

  it("handles shutdown SSE event", () => {
    assert.ok(html.includes("'shutdown'"));
    assert.ok(html.includes("Server Stopped"));
  });

  it("handles restart SSE event with reconnection", () => {
    assert.ok(html.includes("'restart'"));
    assert.ok(html.includes("function attemptReconnect"));
    assert.ok(html.includes("Restarting..."));
  });

  it("posts to shutdown and restart API endpoints", () => {
    assert.ok(html.includes("/api/shutdown"));
    assert.ok(html.includes("/api/restart"));
  });

  it("disables buttons when disconnected", () => {
    assert.ok(html.includes("setButtonsEnabled(false)"));
    assert.ok(html.includes("setButtonsEnabled(true)"));
  });
});
