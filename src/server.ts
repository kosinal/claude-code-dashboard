import * as http from "node:http";
import type { Store, HookPayload } from "./state.js";
import { getDashboardHtml } from "./dashboard.js";

export interface DashboardServer {
  server: http.Server;
  listen(port: number, callback?: () => void): void;
  close(): Promise<void>;
}

export function createServer(store: Store): DashboardServer {
  const sseClients = new Set<http.ServerResponse>();

  function broadcast() {
    const data = JSON.stringify(store.getAllSessions());
    for (const res of sseClients) {
      res.write(`event: update\ndata: ${data}\n\n`);
    }
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDashboardHtml());
      return;
    }

    if (req.method === "POST" && pathname === "/api/hook") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const payload: HookPayload = JSON.parse(body);
          if (!payload.session_id || !payload.hook_event_name) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing session_id or hook_event_name" }));
            return;
          }
          store.handleEvent(payload);
          broadcast();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const initData = JSON.stringify(store.getAllSessions());
      res.write(`event: init\ndata: ${initData}\n\n`);

      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/sessions") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(store.getAllSessions()));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return {
    server,
    listen(port: number, callback?: () => void) {
      server.listen(port, "127.0.0.1", callback);
    },
    close() {
      for (const res of sseClients) {
        res.end();
      }
      sseClients.clear();
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
