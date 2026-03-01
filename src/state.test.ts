import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStore } from "./state.ts";

describe("createStore", () => {
  it("starts empty", () => {
    const store = createStore();
    assert.deepStrictEqual(store.getAllSessions(), []);
  });

  it("SessionStart creates a session with status done", () => {
    const store = createStore();
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/user/project",
    });
    assert.equal(session?.status, "done");
    assert.equal(session?.sessionId, "s1");
    assert.equal(session?.cwd, "/home/user/project");
    assert.equal(session?.lastEvent, "SessionStart");
  });

  it("UserPromptSubmit transitions to running", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    assert.equal(session?.status, "running");
  });

  it("Stop transitions to done", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "Stop",
    });
    assert.equal(session?.status, "done");
  });

  it("SessionEnd removes session and returns null", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    const result = store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionEnd",
    });
    assert.equal(result, null);
    assert.equal(store.getSession("s1"), undefined);
    assert.equal(store.getAllSessions().length, 0);
  });

  it("SessionEnd on nonexistent session returns null", () => {
    const store = createStore();
    const result = store.handleEvent({
      session_id: "nonexistent",
      hook_event_name: "SessionEnd",
    });
    assert.equal(result, null);
  });

  it("tracks multiple sessions independently", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    store.handleEvent({ session_id: "s2", hook_event_name: "SessionStart" });

    const s1 = store.getSession("s1");
    const s2 = store.getSession("s2");
    assert.equal(s1?.status, "running");
    assert.equal(s2?.status, "done");
  });

  it("unknown session_id creates new session", () => {
    const store = createStore();
    const session = store.handleEvent({
      session_id: "new",
      hook_event_name: "UserPromptSubmit",
    });
    assert.equal(session?.status, "running");
    assert.equal(store.getAllSessions().length, 1);
  });

  it("getAllSessions returns all tracked sessions", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({ session_id: "s2", hook_event_name: "SessionStart" });
    store.handleEvent({ session_id: "s3", hook_event_name: "SessionStart" });
    assert.equal(store.getAllSessions().length, 3);
  });

  it("timestamps update on each event", () => {
    const store = createStore();
    const s1 = store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionStart",
    });
    const firstUpdated = s1?.updatedAt;

    // Small delay to ensure timestamp changes
    const s2 = store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    assert.ok(s2?.updatedAt >= firstUpdated);
    assert.equal(s2?.startedAt, s1?.startedAt);
  });

  it("updates cwd when provided", () => {
    const store = createStore();
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/first",
    });
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      cwd: "/second",
    });
    assert.equal(store.getSession("s1")?.cwd, "/second");
  });

  it("PreToolUse with interactive tool transitions to waiting", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    assert.equal(store.getSession("s1")?.status, "running");
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "AskUserQuestion",
    });
    assert.equal(session?.status, "waiting");
    assert.equal(session?.lastEvent, "AskUserQuestion");
  });

  it("PreToolUse with non-interactive tool stays running and shows tool name", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
    });
    assert.equal(session?.status, "running");
    assert.equal(session?.lastEvent, "Bash");
  });

  it("PreToolUse without tool_name falls back to PreToolUse display", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "PreToolUse",
    });
    assert.equal(session?.status, "running");
    assert.equal(session?.lastEvent, "PreToolUse");
  });

  it("PreToolUse with ExitPlanMode transitions to waiting", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "ExitPlanMode",
    });
    assert.equal(session?.status, "waiting");
    assert.equal(session?.lastEvent, "ExitPlanMode");
  });

  it("Ping event does not create a session and returns null", () => {
    const store = createStore();
    const result = store.handleEvent({
      session_id: "s1",
      hook_event_name: "Ping",
    });
    assert.equal(result, null);
    assert.equal(store.getAllSessions().length, 0);
  });

  it("Ping event does not modify an existing session", () => {
    const store = createStore();
    store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/project",
    });
    const result = store.handleEvent({
      session_id: "s1",
      hook_event_name: "Ping",
    });
    assert.equal(result, null);
    const session = store.getSession("s1");
    assert.equal(session?.status, "done");
    assert.equal(session?.lastEvent, "SessionStart");
  });

  it("handles unknown event gracefully", () => {
    const store = createStore();
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "UnknownEvent",
    });
    assert.equal(session?.sessionId, "s1");
    assert.equal(session?.status, "waiting");
  });

  it("removeSession deletes an existing session", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    assert.equal(store.removeSession("s1"), true);
    assert.equal(store.getSession("s1"), undefined);
    assert.equal(store.getAllSessions().length, 0);
  });

  it("removeSession returns false for nonexistent session", () => {
    const store = createStore();
    assert.equal(store.removeSession("nope"), false);
  });

  it("cleanIdleSessions removes sessions idle longer than maxIdleMs", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    store.handleEvent({ session_id: "s2", hook_event_name: "SessionStart" });

    // Backdate s1 to make it idle
    const s1 = store.getSession("s1")!;
    s1.updatedAt = Date.now() - 10_000;

    const removed = store.cleanIdleSessions(5_000);
    assert.deepStrictEqual(removed, ["s1"]);
    assert.equal(store.getSession("s1"), undefined);
    assert.ok(store.getSession("s2"));
    assert.equal(store.getAllSessions().length, 1);
  });

  it("cleanIdleSessions returns empty array when no sessions are idle", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    const removed = store.cleanIdleSessions(60_000);
    assert.deepStrictEqual(removed, []);
    assert.equal(store.getAllSessions().length, 1);
  });
});
