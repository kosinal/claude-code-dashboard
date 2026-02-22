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
  handleEvent(payload: HookPayload): Session;
  getAllSessions(): Session[];
  getSession(sessionId: string): Session | undefined;
}

const EVENT_TO_STATUS: Record<string, SessionStatus> = {
  SessionStart: "waiting",
  UserPromptSubmit: "running",
  Stop: "waiting",
  SessionEnd: "done",
};

export function createStore(): Store {
  const sessions = new Map<string, Session>();

  return {
    handleEvent(payload: HookPayload): Session {
      const { session_id, hook_event_name, cwd } = payload;
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
  };
}
