# claude-code-dashboard

Real-time browser dashboard for Claude Code session states.

## How it works

```
Claude Code hooks ──POST JSON──▶ HTTP server ──SSE──▶ Browser dashboard
```

Claude Code fires [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) on session lifecycle events. The dashboard installs hooks that `curl`/`Invoke-WebRequest` each event to a local HTTP server. The server maintains an in-memory session store and pushes updates to all connected browsers via Server-Sent Events (SSE).

## Quick start

```bash
npx claude-code-dashboard
```

Open `http://localhost:8377` in your browser, then start a Claude Code session — it will appear on the dashboard automatically.

Press `Ctrl+C` to stop. Hooks are removed automatically on exit.

## Usage

### Quick mode (default)

```bash
npx claude-code-dashboard              # start on default port 8377
npx claude-code-dashboard --port 9000  # use a custom port
```

Starts the server and installs temporary hooks into `~/.claude/settings.json`. Hooks are cleaned up when the dashboard stops.

### Install mode

```bash
npx claude-code-dashboard install              # persistent install
npx claude-code-dashboard install --port 9000  # custom port
```

Copies the server to `~/.claude/dashboard/` and installs persistent hooks. The dashboard auto-launches in the background when any Claude Code session starts.

### Uninstall

```bash
npx claude-code-dashboard uninstall
```

Removes hooks from `settings.json` and deletes `~/.claude/dashboard/`.

### Options

| Flag | Description |
|---|---|
| `--port <number>` | Port to listen on (default: `8377`) |
| `--no-hooks` | Start the server without installing hooks |
| `-h`, `--help` | Show help message |

## Session states

| Hook event | Dashboard status |
|---|---|
| `SessionStart` | Waiting for input |
| `UserPromptSubmit` | Running |
| `Stop` | Waiting for input |
| `SessionEnd` | Done |

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
```

## License

GNU GENERAL PUBLIC LICENSE
