# claude-code-dashboard

Real-time browser dashboard for Claude Code session states.

## How it works

```
Claude Code hooks ──POST JSON──▶ HTTP server ──SSE──▶ Browser dashboard
```

Claude Code fires [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) on session lifecycle events. The dashboard installs hooks that `curl`/`Invoke-WebRequest` each event to a local HTTP server. The server maintains an in-memory session store and pushes updates to all connected browsers via Server-Sent Events (SSE).

## Quick start

```bash
npx @kosinal/claude-code-dashboard
```

Open `http://localhost:8377` in your browser, then start a Claude Code session — it will appear on the dashboard automatically.

Press `Ctrl+C` to stop. Hooks are removed automatically on exit.

## Usage

### Quick mode (default)

```bash
npx @kosinal/claude-code-dashboard              # start on default port 8377
npx @kosinal/claude-code-dashboard --port 9000  # use a custom port
```

Starts the server and installs temporary hooks into `~/.claude/settings.json`. Hooks are cleaned up when the dashboard stops.

### Install mode

```bash
npx @kosinal/claude-code-dashboard install              # persistent install
npx @kosinal/claude-code-dashboard install --port 9000  # custom port
```

Copies the server to `~/.claude/dashboard/` and installs persistent hooks. When any Claude Code session starts, the dashboard auto-launches in the background and opens in your browser.

Install mode also creates:
- A desktop/Start Menu shortcut to open the dashboard
- A `claude-dashboard://` protocol handler for quick access

### Uninstall

```bash
npx @kosinal/claude-code-dashboard uninstall
```

Removes hooks from `settings.json`, deletes `~/.claude/dashboard/`, and cleans up shortcuts and protocol handlers.

### Stop & restart

```bash
npx @kosinal/claude-code-dashboard stop      # gracefully stop a running server
npx @kosinal/claude-code-dashboard restart   # restart, or start fresh if not running
```

### Options

| Flag | Description |
|---|---|
| `--port <number>` | Port to listen on (default: `8377`) |
| `--no-hooks` | Start the server without installing hooks |
| `--no-open` | Don't auto-open browser on start |
| `-h`, `--help` | Show help message |

## Dashboard features

- **Real-time session cards** — each Claude Code session appears as a card with status, project folder, working directory, last event, and time-ago timestamp
- **Status indicators** — animated dots show running (yellow, pulsing), waiting for input (blue, breathing), or done (green, static)
- **Browser notifications** — opt-in desktop notifications when a session transitions to "waiting for input" (toggle in the header)
- **Event logging** — toggle detailed event logging to `~/.claude-code-dashboard/logs/` from the dashboard footer
- **Server controls** — restart or stop the server directly from the dashboard UI
- **Connection indicator** — visual feedback showing whether the browser is connected to the server
- **Idle cleanup** — sessions are automatically removed after 5 minutes of inactivity

## Session states

The dashboard tracks session status based on multiple hook events:

| Hook event | Dashboard status | Description |
|---|---|---|
| `SessionStart` | Done | New session, no prompt yet |
| `UserPromptSubmit` | Running | User submitted a prompt |
| `PreToolUse` | Waiting / Running | Waiting if tool needs approval; running if auto-approved |
| `PermissionRequest` | Waiting | Tool requires explicit user permission |
| `PostToolUse` | Running | Tool finished, Claude is working |
| `Stop` | Done | Session stopped |
| `SessionEnd` | *(removed)* | Session removed from dashboard |

The `PreToolUse` logic is context-aware: interactive tools (Write, Edit, NotebookEdit, ExitPlanMode, AskUserQuestion) set status to "waiting", unless the session is in `acceptEdits` mode where edit tools are auto-approved.

Sessions are sorted by status (running first, then waiting, then done) and by last update time within each group.

## Limitations

- Sessions that were already running before the dashboard started are **not tracked**. Only sessions that fire a hook event after the dashboard is running will appear.
- Session state is held in memory — restarting the dashboard clears all sessions.

## Requirements

- Node.js >= 18

## Development

```bash
npm install          # install dev dependencies
npm run build        # bundle with tsup (ESM, node18 target)
npm test             # run tests (node:test with --experimental-strip-types)
npm run lint         # check for lint issues
npm run lint:fix     # auto-fix lint issues
```

## License

GNU GENERAL PUBLIC LICENSE
