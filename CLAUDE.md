# CLAUDE.md
This is a Node HTML dashboard for Claude Code.

## Build & test

```bash
npm run build    # tsup → dist/bin.js (single ESM bundle, node18 target)
npm test         # node --experimental-strip-types --test src/**/*.test.ts
```

## Key conventions

- **Zero runtime dependencies** — only `node:` builtins. tsup bundles everything into a single file.
- **`.ts` import extensions** — all relative imports use `.ts` extensions (`import { createStore } from "./state.ts"`).
- **`node:` protocol** — always use `node:fs`, `node:path`, `node:http`, etc.
- **Factory functions for testability** — `createStore()` and `createServer(store)` return plain objects, no classes. Tests create fresh instances.
- **Hook marker** — hooks are identified by `statusMessage: "__claude_code_dashboard__"` so they can be cleanly added/removed without affecting other hooks in settings.json.
- **Embedded dashboard HTML** — the dashboard UI is a single HTML string in `dashboard.ts` (inline CSS + JS). No build step for the frontend.
- **Localhost-only** — the server binds to `127.0.0.1`, never `0.0.0.0`.
- **Default port** — `8377`.
- If you are requested by user to work in worktrees, you **must use Git Worktree** for implementing the change.