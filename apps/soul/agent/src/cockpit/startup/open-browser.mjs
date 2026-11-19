import { execFile } from "node:child_process";

/**
 * Windows launcher: open the actual listening URL without a shell or extra console.
 * A browser-launch failure must not stop the already-running server.
 * @param {string} url
 * @param {typeof execFile} [execFileImpl]
 * @param {(message: string) => void} [warn]
 */
export function openCockpitBrowser(url, execFileImpl = execFile, warn = (message) => process.stderr.write(message)) {
  const onFailure = (error) => {
    if (error) warn(`[cockpit] Could not open the browser. Open ${url} manually: ${error.message}\n`);
  };
  try {
    execFileImpl("rundll32.exe", ["url.dll,FileProtocolHandler", url], { windowsHide: true }, onFailure);
  } catch (error) {
    onFailure(error);
  }
}
