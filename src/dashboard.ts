export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
    background: #0d1117;
    color: #c9d1d9;
    min-height: 100vh;
    padding: 24px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 1px solid #21262d;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
    color: #f0f6fc;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #8b949e;
  }

  .connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f85149;
    transition: background 0.3s;
  }

  .connection-dot.connected { background: #3fb950; }

  .empty-state {
    text-align: center;
    padding: 80px 24px;
    color: #8b949e;
  }

  .empty-state h2 {
    font-size: 18px;
    font-weight: 500;
    color: #c9d1d9;
    margin-bottom: 8px;
  }

  .empty-state p { font-size: 14px; line-height: 1.6; }

  .sessions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }

  .session-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 16px;
    transition: border-color 0.2s;
  }

  .session-card:hover { border-color: #30363d; }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .project-name {
    font-size: 15px;
    font-weight: 600;
    color: #f0f6fc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 12px;
    white-space: nowrap;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-running .status-badge { background: rgba(210, 153, 34, 0.15); color: #d29922; }
  .status-running .status-dot {
    background: #d29922;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .status-waiting .status-badge { background: rgba(56, 139, 253, 0.15); color: #388bfd; }
  .status-waiting .status-dot {
    background: #388bfd;
    animation: breathe 3s ease-in-out infinite;
  }

  .status-done .status-badge { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
  .status-done .status-dot { background: #3fb950; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  @keyframes breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .card-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: #8b949e;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .detail-label {
    flex-shrink: 0;
    font-weight: 500;
    color: #6e7681;
    min-width: 55px;
  }

  .detail-value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-id-short {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 12px;
  }
</style>
</head>
<body>
<header>
  <h1>Claude Code Dashboard</h1>
  <div class="connection-status">
    <div class="connection-dot" id="connDot"></div>
    <span id="connLabel">Disconnected</span>
  </div>
</header>
<main id="app">
  <div class="empty-state">
    <h2>No sessions yet</h2>
    <p>Start a Claude Code session and it will appear here.<br>
    Sessions already running when the dashboard started won't be tracked.</p>
  </div>
</main>
<script>
(function() {
  const app = document.getElementById('app');
  const connDot = document.getElementById('connDot');
  const connLabel = document.getElementById('connLabel');
  let sessions = [];

  const STATUS_LABELS = { running: 'Running', waiting: 'Waiting for input', done: 'Done' };
  const STATUS_ORDER = { running: 0, waiting: 1, done: 2 };

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function folderName(cwd) {
    if (!cwd) return 'Unknown';
    const parts = cwd.replace(/\\\\/g, '/').split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || cwd;
  }

  function shortId(id) {
    if (!id) return '';
    return id.length > 12 ? id.slice(0, 8) + '...' : id;
  }

  function render() {
    if (sessions.length === 0) {
      app.innerHTML = '<div class="empty-state"><h2>No sessions yet</h2>' +
        '<p>Start a Claude Code session and it will appear here.<br>' +
        'Sessions already running when the dashboard started won\\'t be tracked.</p></div>';
      return;
    }

    const sorted = [...sessions].sort((a, b) => {
      const od = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (od !== 0) return od;
      return b.updatedAt - a.updatedAt;
    });

    app.innerHTML = '<div class="sessions-grid">' + sorted.map(s =>
      '<div class="session-card status-' + s.status + '">' +
        '<div class="card-header">' +
          '<span class="project-name" title="' + esc(s.cwd) + '">' + esc(folderName(s.cwd)) + '</span>' +
          '<span class="status-badge"><span class="status-dot"></span>' + STATUS_LABELS[s.status] + '</span>' +
        '</div>' +
        '<div class="card-details">' +
          '<div class="detail-row"><span class="detail-label">Session</span>' +
            '<span class="detail-value session-id-short" title="' + esc(s.sessionId) + '">' + esc(shortId(s.sessionId)) + '</span></div>' +
          '<div class="detail-row"><span class="detail-label">Path</span>' +
            '<span class="detail-value" title="' + esc(s.cwd) + '">' + esc(s.cwd) + '</span></div>' +
          '<div class="detail-row"><span class="detail-label">Event</span>' +
            '<span class="detail-value">' + esc(s.lastEvent) + ' &middot; ' + timeAgo(s.updatedAt) + '</span></div>' +
        '</div>' +
      '</div>'
    ).join('') + '</div>';
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function connect() {
    const es = new EventSource('/api/events');

    es.addEventListener('init', function(e) {
      sessions = JSON.parse(e.data);
      render();
    });

    es.addEventListener('update', function(e) {
      sessions = JSON.parse(e.data);
      render();
    });

    es.onopen = function() {
      connDot.classList.add('connected');
      connLabel.textContent = 'Connected';
    };

    es.onerror = function() {
      connDot.classList.remove('connected');
      connLabel.textContent = 'Disconnected';
    };
  }

  // Update time-ago values every 10 seconds
  setInterval(render, 10000);

  connect();
})();
</script>
</body>
</html>`;
}
