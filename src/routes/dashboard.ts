import { Router } from "express";

/** Serves the single-page local dashboard used to schedule/cancel merges. */
export function dashboardRouter(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.type("html").send(DASHBOARD_HTML);
  });
  return router;
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PRShift</title>
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="icon" type="image/png" sizes="64x64" href="/assets/favicon-64.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon-180.png" />
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; }
  .brand { display: flex; align-items: center; margin-bottom: 0.25rem; }
  .brand img { height: 2.5rem; width: auto; }
  h1 { margin-bottom: 0.25rem; }
  .sub { color: #666; margin-top: 0; }
  form { display: grid; gap: 0.75rem; border: 1px solid #ccc4; border-radius: 8px; padding: 1.25rem; margin: 1.5rem 0; }
  label { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  .hint { color: #666; font-size: 0.8rem; font-weight: 400; }
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
  <div class="brand"><img src="/assets/prshift-lockup.png" alt="PRShift" /></div>
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
      Timezone
      <select id="timezone" required></select>
      <span class="hint">"Merge at" is interpreted in this timezone. Defaults to your browser's — change it if you mean a different one.</span>
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
    <label style="display: flex; flex-direction: row; align-items: center; gap: 0.5rem;">
      <input id="forceMerge" type="checkbox" style="width: auto;" />
      <span>Force merge (ignore CI checks)</span>
    </label>
    <span class="hint">Merges at the scheduled time even if checks are failing or still running. A merge conflict is the only thing that will still block it.</span>
    <button type="submit">Schedule merge</button>
    <div id="message"></div>
  </form>

  <h2>Scheduled merges</h2>
  <table>
    <thead>
      <tr><th>PR</th><th>Merge at</th><th>Status</th><th>Note</th><th></th></tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>

  <script>
    const form = document.getElementById('schedule-form');
    const message = document.getElementById('message');
    const rows = document.getElementById('rows');
    const timezoneSelect = document.getElementById('timezone');

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const storedTimezone = localStorage.getItem('prshift-timezone');

    const COMMON_TIMEZONES = [
      'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
      'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
      'Africa/Cairo', 'Asia/Jerusalem', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok',
      'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland',
    ];
    const zones = Array.from(new Set([
      browserTimezone,
      ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : COMMON_TIMEZONES),
    ])).sort();

    function offsetLabel(zone) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    }

    timezoneSelect.innerHTML = zones.map(z => \`<option value="\${z}">\${z} (\${offsetLabel(z)})</option>\`).join('');
    timezoneSelect.value = storedTimezone && zones.includes(storedTimezone) ? storedTimezone : browserTimezone;
    timezoneSelect.addEventListener('change', () => {
      localStorage.setItem('prshift-timezone', timezoneSelect.value);
      refresh();
    });

    // Converts a "YYYY-MM-DDTHH:MM" wall-clock string, interpreted in the given zone, to a UTC Date.
    function zonedTimeToUtc(localStr, zone) {
      const [datePart, timePart] = localStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute);

      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const parts = fmt.formatToParts(new Date(guessUtcMs)).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
      const asIfUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      const offsetMs = asIfUtcMs - guessUtcMs;
      return new Date(guessUtcMs - offsetMs);
    }

    function formatInZone(isoString, zone) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: zone, dateStyle: 'medium', timeStyle: 'short',
      }).format(new Date(isoString)) + ' ' + offsetLabel(zone);
    }

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
          <td><a href="https://github.com/\${s.owner}/\${s.repo}/pull/\${s.pullNumber}" target="_blank">\${s.owner}/\${s.repo}#\${s.pullNumber}</a>\${s.forceMerge ? ' <span class="hint" title="Merges even if CI checks are failing">⚡force</span>' : ''}</td>
          <td>\${formatInZone(s.scheduledAt, timezoneSelect.value)}</td>
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
        scheduledAt: zonedTimeToUtc(scheduledAtLocal, timezoneSelect.value).toISOString(),
        mergeMethod: document.getElementById('mergeMethod').value,
        forceMerge: document.getElementById('forceMerge').checked,
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
