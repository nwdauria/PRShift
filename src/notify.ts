import { execFile } from "node:child_process";

const EXEC_OPTIONS = { timeout: 10_000, windowsHide: true };

/**
 * Best-effort desktop notification using each OS's built-in tools — no
 * external dependency, and no shell involved (execFile passes args
 * directly to the process, so notification text can never be interpreted
 * as a shell command). Silently no-ops if the platform tool is missing
 * (e.g. headless Linux without notify-send) — a missed notification
 * should never crash the scheduler.
 */
export function notify(title: string, message: string): void {
  try {
    if (process.platform === "darwin") {
      const script = `display notification ${appleScriptString(message)} with title ${appleScriptString(title)}`;
      execFile("osascript", ["-e", script], EXEC_OPTIONS, ignoreResult);
    } else if (process.platform === "win32") {
      // ShowBalloonTip is asynchronous — without a short sleep afterward,
      // the PowerShell process (and its NotifyIcon) is disposed before
      // Windows has a chance to render the balloon.
      const script = [
        "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')",
        "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing')",
        "$n = New-Object System.Windows.Forms.NotifyIcon",
        "$n.Icon = [System.Drawing.SystemIcons]::Information",
        "$n.Visible = $true",
        `$n.ShowBalloonTip(5000, ${powershellString(title)}, ${powershellString(message)}, [System.Windows.Forms.ToolTipIcon]::Info)`,
        "Start-Sleep -Seconds 5",
        "$n.Dispose()",
      ].join("; ");
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], EXEC_OPTIONS, ignoreResult);
    } else {
      execFile("notify-send", [title, message], EXEC_OPTIONS, ignoreResult);
    }
  } catch {
    // Best effort — notification failures must never crash the process.
  }
}

function ignoreResult(err: unknown): void {
  if (err) {
    console.warn("Desktop notification could not be sent (this is non-fatal).");
  }
}

function appleScriptString(value: string): string {
  return JSON.stringify(value);
}

function powershellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
