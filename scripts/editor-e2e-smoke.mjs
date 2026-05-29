import path from "node:path";
import { fileURLToPath } from "node:url";

import { locateBrowserExecutable } from "../apps/editor/e2e/browser-discovery.mjs";
import { launchHeadlessBrowser } from "../apps/editor/e2e/chrome-launcher.mjs";
import { EarlyEscapeError } from "../apps/editor/e2e/early-escape.mjs";
import {
  editorSmokeViewports,
  runEditorSmoke
} from "../apps/editor/e2e/smoke-checks.mjs";
import { startOrReuseEditorServer } from "../apps/editor/e2e/vite-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const main = async () => {
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `editor-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of editorSmokeViewports) {
      await runEditorSmoke({
        baseUrl: server.baseUrl,
        browserPort: launchedBrowser.port,
        viewport
      });
      console.log(`editor-e2e: ${viewport.name} smoke passed`);
    }
  } finally {
    if (launchedBrowser !== undefined) {
      await launchedBrowser.close();
    }

    await server.close();
  }
};

try {
  await main();
  console.log("editor-e2e: smoke passed");
} catch (error) {
  if (error instanceof EarlyEscapeError) {
    console.error(`editor-e2e: early escape: ${error.message}`);
    process.exitCode = 2;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
}
