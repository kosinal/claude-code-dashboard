import assert from "node:assert/strict";
import * as http from "node:http";
import { afterEach, describe, it } from "node:test";
import { createServer, type DashboardServer, type ServerOptions } from "./server.ts";
import { createStore } from "./state.ts";

let dashboard: DashboardServer | null = null;

function startServer(
  opts?: Partial<ServerOptions>,
): Promise<{ port: number; dashboard: DashboardServer }> {
  return new Promise((resolve) => {
    const store = createStore();
    const d = createServer({
      store,
      onShutdown: opts?.onShutdown,
      onRestart: opts?.onRestart,
      idleTimeoutMs: opts?.idleTimeoutMs,
      cleanupIntervalMs: opts?.cleanupIntervalMs,
    });
    dashboard = d;
    d.server.listen(0, "127.0.0.1", () => {
      const addr = d.server.address() as { port: number };
      resolve({ port: addr.port, dashboard: d });
    });
  });
}

function fetch(
  port: number,
  method: string,
  path: string,
  body?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

afterEach(async () => {
  if (dashboard) {
    await dashboard.close();
    dashboard = null;
  }
});

describe("HTTP Server", () => {
  it("GET / returns 200 with text/html", async () => {
    const { port } = await startServer();
    const res = await fetch(port, "GET", "/");
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"]?.includes("text/html"));
    assert.ok(res.body.includes("<!DOCTYPE html>"));
  });

  it("POST /api/hook with valid JSON returns 200 and updates state", async () => {
    const { port } = await startServer();
    const res = await fetch(
      port,
      "POST",
      "/api/hook",
      JSON.stringify({
        session_id: "test-1",
        hook_event_name: "SessionStart",
        cwd: "/test",
      }),
    );
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);

    // Verify state was updated
    const sessions = await fetch(port, "GET", "/api/sessions");
    const list = JSON.parse(sessions.body);
    assert.equal(list.length, 1);
    assert.equal(list[0].status, "waiting");
  });

  it("POST /api/hook with invalid JSON returns 400", async () => {
    const { port } = await startServer();
    const res = await fetch(port, "POST", "/api/hook", "not json");
    assert.equal(res.status, 400);
  });

  it("POST /api/hook with missing fields returns 400", async () => {
    const { port } = await startServer();
    const res = await fetch(port, "POST", "/api/hook", JSON.stringify({ session_id: "x" }));
    assert.equal(res.status, 400);
  });

  it("GET /api/sessions returns JSON array", async () => {
    const { port } = await startServer();
    const res = await fetch(port, "GET", "/api/sessions");
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"]?.includes("application/json"));
    const list = JSON.parse(res.body);
    assert.ok(Array.isArray(list));
  });

  it("GET /api/events returns SSE headers and init event", async () => {
    const { port } = await startServer();

    const data = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/events",
          method: "GET",
        },
        (res) => {
          assert.equal(res.statusCode, 200);
          assert.ok(res.headers["content-type"]?.includes("text/event-stream"));
          let buf = "";
          res.on("data", (chunk) => {
            buf += chunk;
            if (buf.includes("\n\n")) {
              req.destroy();
              resolve(buf);
            }
          });
        },
      );
      req.on("error", (err) => {
        // Ignore ECONNRESET from destroy
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
          reject(err);
        }
      });
      req.end();
    });

    assert.ok(data.includes("event: init"));
    assert.ok(data.includes("data: []"));
  });

  it("SSE receives update after POST to /api/hook", async () => {
    const { port } = await startServer();

    const updateData = await new Promise<string>((resolve, reject) => {
      const _eventCount = 0;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/events",
          method: "GET",
        },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => {
            buf += chunk;
            // Count complete events (double newline separated)
            const events = buf.split("\n\n").filter(Boolean);
            if (events.length >= 2) {
              req.destroy();
              resolve(events[1]);
            }
          });
        },
      );
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
          reject(err);
        }
      });
      req.end();

      // Post an event after a short delay
      setTimeout(() => {
        fetch(
          port,
          "POST",
          "/api/hook",
          JSON.stringify({
            session_id: "sse-test",
            hook_event_name: "SessionStart",
            cwd: "/sse-test",
          }),
        );
      }, 100);
    });

    assert.ok(updateData.includes("event: update"));
    assert.ok(updateData.includes("sse-test"));
  });

  it("GET /unknown returns 404", async () => {
    const { port } = await startServer();
    const res = await fetch(port, "GET", "/unknown");
    assert.equal(res.status, 404);
  });

  it("POST /api/hook with SessionEnd removes the session", async () => {
    const { port } = await startServer();

    // Create a session
    await fetch(
      port,
      "POST",
      "/api/hook",
      JSON.stringify({
        session_id: "end-test",
        hook_event_name: "SessionStart",
        cwd: "/test",
      }),
    );

    // Verify it exists
    let sessions = await fetch(port, "GET", "/api/sessions");
    let list = JSON.parse(sessions.body);
    assert.equal(list.length, 1);

    // End the session
    await fetch(
      port,
      "POST",
      "/api/hook",
      JSON.stringify({
        session_id: "end-test",
        hook_event_name: "SessionEnd",
      }),
    );

    // Verify it's gone
    sessions = await fetch(port, "GET", "/api/sessions");
    list = JSON.parse(sessions.body);
    assert.equal(list.length, 0);
  });

  it("idle cleanup removes stale sessions automatically", async () => {
    const { port } = await startServer({
      idleTimeoutMs: 100,
      cleanupIntervalMs: 50,
    });

    // Create a session
    await fetch(
      port,
      "POST",
      "/api/hook",
      JSON.stringify({
        session_id: "idle-test",
        hook_event_name: "SessionStart",
        cwd: "/test",
      }),
    );

    // Verify it exists
    let sessions = await fetch(port, "GET", "/api/sessions");
    let list = JSON.parse(sessions.body);
    assert.equal(list.length, 1);

    // Wait for idle timeout + cleanup interval to fire
    await new Promise((r) => setTimeout(r, 250));

    // Verify it's been cleaned up
    sessions = await fetch(port, "GET", "/api/sessions");
    list = JSON.parse(sessions.body);
    assert.equal(list.length, 0);
  });

  it("POST /api/shutdown returns 200 and triggers onShutdown", async () => {
    let shutdownCalled = false;
    const { port } = await startServer({
      onShutdown() {
        shutdownCalled = true;
      },
    });
    const res = await fetch(port, "POST", "/api/shutdown");
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);
    // Wait for setImmediate to fire
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(shutdownCalled, true);
  });

  it("POST /api/restart returns 200 and triggers onRestart", async () => {
    let restartCalled = false;
    const { port } = await startServer({
      onRestart() {
        restartCalled = true;
      },
    });
    const res = await fetch(port, "POST", "/api/restart");
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);
    // Wait for setImmediate to fire
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(restartCalled, true);
  });

  it("SSE clients receive shutdown event", async () => {
    const { port } = await startServer();

    const sseData = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/events",
          method: "GET",
        },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => {
            buf += chunk;
            // Wait for init + shutdown events
            const events = buf.split("\n\n").filter(Boolean);
            if (events.length >= 2) {
              req.destroy();
              resolve(events[1]);
            }
          });
        },
      );
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
          reject(err);
        }
      });
      req.end();

      // Trigger shutdown after SSE connects
      setTimeout(() => {
        fetch(port, "POST", "/api/shutdown");
      }, 100);
    });

    assert.ok(sseData.includes("event: shutdown"));
  });

  it("SSE clients receive restart event", async () => {
    const { port } = await startServer();

    const sseData = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/events",
          method: "GET",
        },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => {
            buf += chunk;
            const events = buf.split("\n\n").filter(Boolean);
            if (events.length >= 2) {
              req.destroy();
              resolve(events[1]);
            }
          });
        },
      );
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
          reject(err);
        }
      });
      req.end();

      // Trigger restart after SSE connects
      setTimeout(() => {
        fetch(port, "POST", "/api/restart");
      }, 100);
    });

    assert.ok(sseData.includes("event: restart"));
  });
});
