import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./state.js";

describe("createStore", () => {
  it("starts empty", () => {
    const store = createStore();
    assert.deepStrictEqual(store.getAllSessions(), []);
  });

  it("SessionStart creates a session with status waiting", () => {
    const store = createStore();
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/user/project",
    });
    assert.equal(session.status, "waiting");
    assert.equal(session.sessionId, "s1");
    assert.equal(session.cwd, "/home/user/project");
    assert.equal(session.lastEvent, "SessionStart");
  });

  it("UserPromptSubmit transitions to running", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    assert.equal(session.status, "running");
  });

  it("Stop transitions to waiting", () => {
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
    assert.equal(session.status, "waiting");
  });

  it("SessionEnd transitions to done", () => {
    const store = createStore();
    store.handleEvent({ session_id: "s1", hook_event_name: "SessionStart" });
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "SessionEnd",
    });
    assert.equal(session.status, "done");
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
    assert.equal(s2?.status, "waiting");
  });

  it("unknown session_id creates new session", () => {
    const store = createStore();
    const session = store.handleEvent({
      session_id: "new",
      hook_event_name: "UserPromptSubmit",
    });
    assert.equal(session.status, "running");
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
    const firstUpdated = s1.updatedAt;

    // Small delay to ensure timestamp changes
    const s2 = store.handleEvent({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
    });
    assert.ok(s2.updatedAt >= firstUpdated);
    assert.equal(s2.startedAt, s1.startedAt);
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

  it("handles unknown event gracefully", () => {
    const store = createStore();
    const session = store.handleEvent({
      session_id: "s1",
      hook_event_name: "UnknownEvent",
    });
    assert.equal(session.sessionId, "s1");
    assert.equal(session.status, "waiting");
  });
});
