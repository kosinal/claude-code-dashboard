export type SessionStatus = "running" | "waiting" | "done";

export interface Session {
  sessionId: string;
  status: SessionStatus;
  cwd: string;
  lastEvent: string;
  updatedAt: number;
  startedAt: number;
}

export interface HookPayload {
  session_id: string;
  hook_event_name: string;
  cwd?: string;
  [key: string]: unknown;
}

export interface Store {
  handleEvent(payload: HookPayload): Session | null;
  getAllSessions(): Session[];
  getSession(sessionId: string): Session | undefined;
  removeSession(sessionId: string): boolean;
  cleanIdleSessions(maxIdleMs: number): string[];
}

const EVENT_TO_STATUS: Record<string, SessionStatus> = {
  SessionStart: "done",
  UserPromptSubmit: "running",
  Stop: "done",
  PreToolUse: "waiting",
};

export function createStore(): Store {
  const sessions = new Map<string, Session>();

  return {
    handleEvent(payload: HookPayload): Session | null {
      const { session_id, hook_event_name, cwd } = payload;

      if (hook_event_name === "Ping") {
        return null;
      }

      if (hook_event_name === "SessionEnd") {
        sessions.delete(session_id);
        return null;
      }

      if (hook_event_name === "Ping") {
        return null;
      }

      const status = EVENT_TO_STATUS[hook_event_name];
      if (!status) {
        const existing = sessions.get(session_id);
        if (existing) return existing;
        const session: Session = {
          sessionId: session_id,
          status: "waiting",
          cwd: cwd ?? "",
          lastEvent: hook_event_name,
          updatedAt: Date.now(),
          startedAt: Date.now(),
        };
        sessions.set(session_id, session);
        return session;
      }

      const now = Date.now();
      const existing = sessions.get(session_id);
      if (existing) {
        existing.status = status;
        existing.lastEvent = hook_event_name;
        existing.updatedAt = now;
        if (cwd) existing.cwd = cwd;
        return existing;
      }

      const session: Session = {
        sessionId: session_id,
        status,
        cwd: cwd ?? "",
        lastEvent: hook_event_name,
        updatedAt: now,
        startedAt: now,
      };
      sessions.set(session_id, session);
      return session;
    },

    getAllSessions(): Session[] {
      return Array.from(sessions.values());
    },

    getSession(sessionId: string): Session | undefined {
      return sessions.get(sessionId);
    },

    removeSession(sessionId: string): boolean {
      return sessions.delete(sessionId);
    },

    cleanIdleSessions(maxIdleMs: number): string[] {
      const now = Date.now();
      const removed: string[] = [];
      for (const [id, session] of sessions) {
        if (now - session.updatedAt > maxIdleMs) {
          sessions.delete(id);
          removed.push(id);
        }
      }
      return removed;
    },
  };
}
