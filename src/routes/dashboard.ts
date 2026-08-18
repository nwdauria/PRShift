import { Router } from "express";

/** Serves the single-page local dashboard used to schedule/cancel merges. */
export function dashboardRouter(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.type("html").send(DASHBOARD_HTML);
  });
  return router;
}

/** Icon-only mark (git branch + clock), used for the favicon and the header lockup. */
const LOGO_MARK_SVG = `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="prshift-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#9333ea" />
    </linearGradient>
  </defs>
  <path d="M20 25 L50 50 L20 75" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="20" cy="25" r="9" fill="#fff" stroke="#0f172a" stroke-width="7" />
  <circle cx="20" cy="75" r="9" fill="#fff" stroke="#0f172a" stroke-width="7" />
  <line x1="50" y1="50" x2="88" y2="50" stroke="url(#prshift-grad)" stroke-width="7" stroke-linecap="round" />
  <path d="M78 38 L94 50 L78 62" fill="none" stroke="url(#prshift-grad)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="75" cy="50" r="24" fill="none" stroke="url(#prshift-grad)" stroke-width="6" />
  <line x1="75" y1="20" x2="75" y2="27" stroke="url(#prshift-grad)" stroke-width="5" stroke-linecap="round" />
  <line x1="75" y1="73" x2="75" y2="80" stroke="url(#prshift-grad)" stroke-width="5" stroke-linecap="round" />
  <line x1="102" y1="50" x2="109" y2="50" stroke="url(#prshift-grad)" stroke-width="5" stroke-linecap="round" />
</svg>`;

/** Full wordmark lockup (mark + "PRShift" text) used in the dashboard header. */
const LOGO_LOCKUP_SVG = `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PRShift">
  <defs>
    <linearGradient id="prshift-grad-lockup" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#9333ea" />
    </linearGradient>
  </defs>
  <g transform="translate(0,0)">
    <path d="M20 25 L50 50 L20 75" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="20" cy="25" r="9" fill="#fff" stroke="#0f172a" stroke-width="7" />
    <circle cx="20" cy="75" r="9" fill="#fff" stroke="#0f172a" stroke-width="7" />
    <line x1="50" y1="50" x2="88" y2="50" stroke="url(#prshift-grad-lockup)" stroke-width="7" stroke-linecap="round" />
    <path d="M78 38 L94 50 L78 62" fill="none" stroke="url(#prshift-grad-lockup)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="75" cy="50" r="24" fill="none" stroke="url(#prshift-grad-lockup)" stroke-width="6" />
    <line x1="75" y1="20" x2="75" y2="27" stroke="url(#prshift-grad-lockup)" stroke-width="5" stroke-linecap="round" />
    <line x1="75" y1="73" x2="75" y2="80" stroke="url(#prshift-grad-lockup)" stroke-width="5" stroke-linecap="round" />
    <line x1="102" y1="50" x2="109" y2="50" stroke="url(#prshift-grad-lockup)" stroke-width="5" stroke-linecap="round" />
  </g>
  <text x="130" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" fill="#0f172a">PR</text>
  <text x="205" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" font-style="italic" fill="url(#prshift-grad-lockup)">Shift</text>
</svg>`;

const LOGO_FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_MARK_SVG)}`;

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PRShift</title>
<link rel="icon" type="image/svg+xml" href="${LOGO_FAVICON_DATA_URI}" />
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; }
  .brand { display: flex; align-items: center; margin-bottom: 0.25rem; }
  .brand svg { height: 2.5rem; width: auto; }
  h1 { margin-bottom: 0.25rem; }
  .sub { color: #666; margin-top: 0; }
  form { display: grid; gap: 0.75rem; border: 1px solid #ccc4; border-radius: 8px; padding: 1.25rem; margin: 1.5rem 0; }
  label { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  input, select { padding: 0.5rem; font-size: 1rem; border-radius: 6px; border: 1px solid #999; }
  button { padding: 0.6rem 1rem; font-size: 1rem; border-radius: 6px; border: none; background: #2563eb; color: white; cursor: pointer; }
  button:hover { background: #1d4ed8; }
  button.secondary { background: #6b7280; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #ccc4; font-size: 0.9rem; }
  .status { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-merged { background: #d1fae5; color: #065f46; }
  .status-blocked { background: #fee2e2; color: #991b1b; }
  .status-cancelled { background: #e5e7eb; color: #374151; }
  .status-failed { background: #fee2e2; color: #991b1b; }
  #message { min-height: 1.2rem; font-size: 0.9rem; }
  #message.error { color: #b91c1c; }
  #message.ok { color: #047857; }
</style>
</head>
<body>
  <div class="brand">${LOGO_LOCKUP_SVG}</div>
  <p class="sub">Schedule when a pull request actually gets merged.</p>

  <form id="schedule-form">
    <label>
      Pull request URL
      <input id="prUrl" type="text" placeholder="https://github.com/owner/repo/pull/42" required />
    </label>
    <label>
      Merge at
      <input id="scheduledAt" type="datetime-local" required />
    </label>
    <label>
      Your GitHub username
      <input id="requestedBy" type="text" placeholder="octocat" required />
    </label>
    <label>
      Merge method
      <select id="mergeMethod">
        <option value="merge">Merge commit</option>
        <option value="squash">Squash</option>
        <option value="rebase">Rebase</option>
      </select>
    </label>
    <button type="submit">Schedule merge</button>
    <div id="message"></div>
  </form>

  <h2>Scheduled merges</h2>
  <table>
    <thead>
      <tr><th>PR</th><th>Merge at (local)</th><th>Status</th><th>Note</th><th></th></tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>

  <script>
    const form = document.getElementById('schedule-form');
    const message = document.getElementById('message');
    const rows = document.getElementById('rows');

    function parsePrUrl(url) {
      try {
        const u = new URL(url.trim());
        const parts = u.pathname.split('/').filter(Boolean);
        const pullIdx = parts.indexOf('pull');
        if (u.hostname !== 'github.com' || pullIdx === -1 || parts.length < pullIdx + 2) return null;
        return { owner: parts[0], repo: parts[1], pullNumber: Number(parts[pullIdx + 1]) };
      } catch {
        return null;
      }
    }

    async function refresh() {
      const res = await fetch('/schedules');
      const schedules = await res.json();
      schedules.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      rows.innerHTML = schedules.map(s => \`
        <tr>
          <td><a href="https://github.com/\${s.owner}/\${s.repo}/pull/\${s.pullNumber}" target="_blank">\${s.owner}/\${s.repo}#\${s.pullNumber}</a></td>
          <td>\${new Date(s.scheduledAt).toLocaleString()}</td>
          <td><span class="status status-\${s.status}">\${s.status}</span></td>
          <td>\${s.note ?? ''}</td>
          <td>\${(s.status === 'pending' || s.status === 'blocked') ? \`<button class="secondary" data-id="\${s.id}">Cancel</button>\` : ''}</td>
        </tr>
      \`).join('') || '<tr><td colspan="5">No scheduled merges yet.</td></tr>';

      rows.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await fetch('/schedules/' + btn.dataset.id, { method: 'DELETE' });
          refresh();
        });
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      message.className = '';
      message.textContent = '';

      const parsed = parsePrUrl(document.getElementById('prUrl').value);
      if (!parsed) {
        message.className = 'error';
        message.textContent = 'Enter a valid PR URL, e.g. https://github.com/owner/repo/pull/42';
        return;
      }
      const scheduledAtLocal = document.getElementById('scheduledAt').value;
      if (!scheduledAtLocal) return;

      const body = {
        owner: parsed.owner,
        repo: parsed.repo,
        pullNumber: parsed.pullNumber,
        scheduledAt: new Date(scheduledAtLocal).toISOString(),
        mergeMethod: document.getElementById('mergeMethod').value,
        requestedBy: document.getElementById('requestedBy').value.trim(),
      };

      const res = await fetch('/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        message.className = 'error';
        message.textContent = data.error || 'Failed to schedule merge.';
        return;
      }
      message.className = 'ok';
      message.textContent = 'Scheduled! It will merge automatically at the chosen time if checks pass.';
      form.reset();
      refresh();
    });

    refresh();
    setInterval(refresh, 15000);
  </script>
</body>
</html>`;
