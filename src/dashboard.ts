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

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .notification-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toggle-label {
    font-size: 13px;
    color: #8b949e;
    cursor: pointer;
    user-select: none;
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 22px;
    flex-shrink: 0;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 11px;
    transition: background 0.2s, border-color 0.2s;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 2px;
    bottom: 2px;
    background: #8b949e;
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-switch input:checked + .toggle-slider {
    background: #238636;
    border-color: #2ea043;
  }

  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(22px);
    background: #f0f6fc;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #21262d;
  }

  footer button {
    background: #21262d;
    color: #c9d1d9;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  footer button:hover {
    background: #30363d;
    border-color: #484f58;
  }

  footer button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  footer .btn-danger:hover:not(:disabled) {
    background: #da3633;
    border-color: #f85149;
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

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .overlay-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 24px;
    min-width: 340px;
    max-width: 440px;
    text-align: center;
  }

  .overlay-card h2 {
    font-size: 18px;
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 8px;
  }

  .overlay-card p {
    font-size: 14px;
    color: #8b949e;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .overlay-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .overlay-actions button {
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid #30363d;
    transition: background 0.2s;
  }

  .overlay-actions .btn-cancel {
    background: #21262d;
    color: #c9d1d9;
  }

  .overlay-actions .btn-cancel:hover {
    background: #30363d;
  }

  .overlay-actions .btn-confirm {
    background: #238636;
    color: #f0f6fc;
    border-color: #2ea043;
  }

  .overlay-actions .btn-confirm:hover {
    background: #2ea043;
  }

  .overlay-actions .btn-confirm-danger {
    background: #da3633;
    color: #f0f6fc;
    border-color: #f85149;
  }

  .overlay-actions .btn-confirm-danger:hover {
    background: #f85149;
  }

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
  <div class="header-right">
    <div class="notification-toggle">
      <label class="toggle-switch">
        <input type="checkbox" id="notifToggle">
        <span class="toggle-slider"></span>
      </label>
      <label class="toggle-label" for="notifToggle">Notifications</label>
    </div>
    <div class="connection-status">
      <div class="connection-dot" id="connDot"></div>
      <span id="connLabel">Disconnected</span>
    </div>
  </div>
</header>
<div id="overlayContainer"></div>
<main id="app">
  <div class="empty-state">
    <h2>No sessions yet</h2>
    <p>Start a Claude Code session and it will appear here.<br>
    Sessions already running when the dashboard started won't be tracked.</p>
  </div>
</main>
<footer>
  <button id="btnRestart" disabled>Restart</button>
  <button id="btnStop" class="btn-danger" disabled>Stop</button>
</footer>
<script>
(function() {
  var app = document.getElementById('app');
  var connDot = document.getElementById('connDot');
  var connLabel = document.getElementById('connLabel');
  var overlayContainer = document.getElementById('overlayContainer');
  var btnStop = document.getElementById('btnStop');
  var btnRestart = document.getElementById('btnRestart');
  var notifToggle = document.getElementById('notifToggle');
  var notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
  var sessions = [];
  var previousStatuses = {};
  var initialized = false;
  var es = null;

  notifToggle.checked = notificationsEnabled;
  notifToggle.addEventListener('change', function() {
    notificationsEnabled = notifToggle.checked;
    localStorage.setItem('notificationsEnabled', notificationsEnabled ? 'true' : 'false');
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  });

  if (notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  var STATUS_LABELS = { running: 'Running', waiting: 'Waiting for input', done: 'Done' };
  var STATUS_ORDER = { running: 0, waiting: 1, done: 2 };

  function timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function folderName(cwd) {
    if (!cwd) return 'Unknown';
    var parts = cwd.replace(/\\\\/g, '/').split('/');
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

    var sorted = sessions.slice().sort(function(a, b) {
      var od = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (od !== 0) return od;
      return b.updatedAt - a.updatedAt;
    });

    app.innerHTML = '<div class="sessions-grid">' + sorted.map(function(s) {
      return '<div class="session-card status-' + s.status + '">' +
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
      '</div>';
    }).join('') + '</div>';
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function checkAndNotify(newSessions) {
    if (!initialized) {
      initialized = true;
      newSessions.forEach(function(s) { previousStatuses[s.sessionId] = s.status; });
      return;
    }
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      newSessions.forEach(function(s) {
        if (s.status === 'waiting' && previousStatuses[s.sessionId] !== 'waiting') {
          new Notification('Claude Code - Waiting for input', {
            body: folderName(s.cwd),
            tag: 'claude-waiting-' + s.sessionId
          });
        }
      });
    }
    previousStatuses = {};
    newSessions.forEach(function(s) { previousStatuses[s.sessionId] = s.status; });
  }

  function setButtonsEnabled(enabled) {
    btnStop.disabled = !enabled;
    btnRestart.disabled = !enabled;
  }

  function clearOverlay() {
    overlayContainer.innerHTML = '';
  }

  function showOverlay(title, message) {
    overlayContainer.innerHTML =
      '<div class="overlay"><div class="overlay-card">' +
        '<h2>' + esc(title) + '</h2>' +
        '<p>' + esc(message) + '</p>' +
      '</div></div>';
  }

  function showConfirm(title, message, label, isDanger, onConfirm) {
    var btnClass = isDanger ? 'btn-confirm-danger' : 'btn-confirm';
    overlayContainer.innerHTML =
      '<div class="overlay"><div class="overlay-card">' +
        '<h2>' + esc(title) + '</h2>' +
        '<p>' + esc(message) + '</p>' +
        '<div class="overlay-actions">' +
          '<button class="btn-cancel" id="overlayCancel">Cancel</button>' +
          '<button class="' + btnClass + '" id="overlayConfirm">' + esc(label) + '</button>' +
        '</div>' +
      '</div></div>';
    document.getElementById('overlayCancel').onclick = clearOverlay;
    document.getElementById('overlayConfirm').onclick = function() {
      onConfirm();
    };
  }

  function attemptReconnect() {
    var attempts = 0;
    var maxAttempts = 30;
    var timer = setInterval(function() {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        showOverlay('Connection Lost', 'Could not reconnect to the dashboard server.');
        return;
      }
      var req = new XMLHttpRequest();
      req.open('GET', '/api/sessions', true);
      req.timeout = 2000;
      req.onload = function() {
        if (req.status === 200) {
          clearInterval(timer);
          clearOverlay();
          connect();
        }
      };
      req.onerror = function() {};
      req.ontimeout = function() {};
      req.send();
    }, 1000);
  }

  btnStop.onclick = function() {
    showConfirm('Stop Dashboard', 'Are you sure you want to stop the dashboard server?', 'Stop', true, function() {
      showOverlay('Stopping...', 'Shutting down the dashboard server.');
      setButtonsEnabled(false);
      var req = new XMLHttpRequest();
      req.open('POST', '/api/shutdown', true);
      req.onload = function() {
        showOverlay('Server Stopped', 'The dashboard server has been shut down.');
      };
      req.onerror = function() {
        showOverlay('Server Stopped', 'The dashboard server has been shut down.');
      };
      req.send();
    });
  };

  btnRestart.onclick = function() {
    showConfirm('Restart Dashboard', 'Are you sure you want to restart the dashboard server?', 'Restart', false, function() {
      showOverlay('Restarting...', 'The dashboard server is restarting. Reconnecting automatically...');
      setButtonsEnabled(false);
      var req = new XMLHttpRequest();
      req.open('POST', '/api/restart', true);
      req.onload = function() {};
      req.onerror = function() {};
      req.send();
    });
  };

  function connect() {
    if (es) {
      es.close();
      es = null;
    }

    es = new EventSource('/api/events');

    es.addEventListener('init', function(e) {
      sessions = JSON.parse(e.data);
      checkAndNotify(sessions);
      render();
    });

    es.addEventListener('update', function(e) {
      sessions = JSON.parse(e.data);
      checkAndNotify(sessions);
      render();
    });

    es.addEventListener('shutdown', function() {
      if (es) { es.close(); es = null; }
      setButtonsEnabled(false);
      showOverlay('Server Stopped', 'The dashboard server has been shut down.');
    });

    es.addEventListener('restart', function() {
      if (es) { es.close(); es = null; }
      setButtonsEnabled(false);
      showOverlay('Restarting...', 'The dashboard server is restarting. Reconnecting automatically...');
      attemptReconnect();
    });

    es.onopen = function() {
      connDot.classList.add('connected');
      connLabel.textContent = 'Connected';
      setButtonsEnabled(true);
    };

    es.onerror = function() {
      connDot.classList.remove('connected');
      connLabel.textContent = 'Disconnected';
      setButtonsEnabled(false);
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
