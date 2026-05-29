import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { earlyEscape } from "./early-escape.mjs";

const envBrowserVariables = [
  "EDITOR_E2E_BROWSER",
  "BROWSER_PATH",
  "CHROME_PATH",
  "CHROME_BIN",
  "EDGE_PATH"
];

export const locateBrowserExecutable = () => {
  const candidates = createBrowserCandidates();
  const checked = [];

  for (const candidate of candidates) {
    if (checked.includes(candidate.executable)) {
      continue;
    }

    checked.push(candidate.executable);

    if (isUsableBrowserExecutable(candidate.executable)) {
      return candidate;
    }
  }

  earlyEscape(
    [
      "Chrome or Edge was not found for editor e2e smoke.",
      `Set one of ${envBrowserVariables.join(", ")} to a Chrome/Edge executable path.`
    ].join(" ")
  );
};

const createBrowserCandidates = () => [
  ...envBrowserVariables.flatMap((name) => {
    const value = process.env[name];

    return value === undefined || value.trim().length === 0
      ? []
      : [{ executable: value, source: name }];
  }),
  ...knownBrowserPaths().map((executable) => ({ executable, source: "known path" })),
  ...browserCommands().map((executable) => ({ executable, source: "PATH" }))
];

const knownBrowserPaths = () => {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];

  return [
    programFiles && path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 && path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    localAppData && path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles && path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFilesX86 && path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    localAppData && path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    path.join(homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable"
  ].filter(Boolean);
};

const browserCommands = () =>
  process.platform === "win32"
    ? ["chrome.exe", "msedge.exe"]
    : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];

const isUsableBrowserExecutable = (executable) => {
  if (path.isAbsolute(executable) || executable.includes(path.sep)) {
    return existsSync(executable);
  }

  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
    windowsHide: true
  });

  return result.status === 0;
};
