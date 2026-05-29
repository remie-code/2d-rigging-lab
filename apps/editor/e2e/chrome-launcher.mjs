import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export const launchHeadlessBrowser = async ({ executable }) => {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "editor-e2e-browser-"));
  const browserProcess = spawn(executable, createBrowserArgs(userDataDir), {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true
  });
  const stderrChunks = [];

  browserProcess.stderr?.on("data", (chunk) => {
    stderrChunks.push(Buffer.from(chunk));
  });

  try {
    const devTools = await waitForDevToolsPort(userDataDir, browserProcess, stderrChunks);

    return {
      port: devTools.port,
      close: async () => {
        await closeBrowserProcess(browserProcess);
        await rm(userDataDir, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await closeBrowserProcess(browserProcess);
    await rm(userDataDir, { recursive: true, force: true });
    throw error;
  }
};

const createBrowserArgs = (userDataDir) => [
  "--headless=new",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-gpu",
  "--disable-sync",
  "--no-default-browser-check",
  "--no-first-run",
  "--remote-allow-origins=*",
  "--remote-debugging-port=0",
  `--user-data-dir=${userDataDir}`,
  ...(process.platform === "linux" ? ["--no-sandbox"] : []),
  "about:blank"
];

const waitForDevToolsPort = async (userDataDir, browserProcess, stderrChunks) => {
  const portFile = path.join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (browserProcess.exitCode !== null) {
      throw new Error(formatBrowserLaunchError(stderrChunks));
    }

    try {
      const text = await readFile(portFile, "utf8");
      const [portLine] = text.split(/\r?\n/);
      const port = Number(portLine);

      if (Number.isInteger(port) && port > 0) {
        return { port };
      }
    } catch {
      await delay(100);
    }
  }

  throw new Error(formatBrowserLaunchError(stderrChunks, "Timed out waiting for DevToolsActivePort."));
};

const closeBrowserProcess = async (browserProcess) => {
  if (browserProcess.exitCode !== null) {
    return;
  }

  browserProcess.kill();

  await Promise.race([
    new Promise((resolve) => browserProcess.once("exit", resolve)),
    delay(2_000)
  ]);
};

const formatBrowserLaunchError = (stderrChunks, prefix = "Chrome/Edge exited before DevTools was available.") => {
  const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

  return stderr.length === 0 ? prefix : `${prefix}\n${stderr}`;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
