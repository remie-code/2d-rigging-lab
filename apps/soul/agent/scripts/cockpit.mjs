// @ts-check
/**
 * コクピット本番起動エントリ（S2.5 Domain B・人間ゲートの「起動コマンド 1 個」）— apps/soul/agent。
 *
 *   node apps/soul/agent/scripts/cockpit.mjs [--port N]
 *   （package.json scripts: `npm run cockpit --prefix apps/soul/agent`）
 *
 * 実 pipeline factory（createEarPipeline・既定）+ file-backed settings store + 実ページで
 * `createCockpitServer` を構成し、**127.0.0.1** に listen して**アクセス URL を標準出力に表示**する。
 * ユーザーはその URL をブラウザで開き、マイクを選んで Start を押す（CLI を一切触らない）。
 *
 * 実マイクが無い/未接続でもサーバ自体は起動しページは開ける（耳の Start を押すまで実デバイスに触れない）。
 * SIGINT（Ctrl+C）/ stdin EOF で clean close（ears-cli.mjs の型を踏襲・server.close() でハンドル解放）。
 */

import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import { createCockpitServer, DEFAULT_COCKPIT_PORT } from "../src/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit-settings-store.mjs";
import { cockpitHtmlPath } from "../src/cockpit-page.mjs";

/** @param {string[]} argv */
export function parseCockpitArgs(argv) {
  const args = { port: /** @type {number | undefined} */ (undefined), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--port") args.port = Number(argv[++i]);
  }
  return args;
}

const HELP = `usage: node scripts/cockpit.mjs [--port N]
  --port N   listen port（既定 ${DEFAULT_COCKPIT_PORT}・127.0.0.1 限定）
  起動後、表示された http://127.0.0.1:<port>/ をブラウザで開く。Ctrl+C / EOF で終了。
`;

async function main() {
  const args = parseCockpitArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
    return;
  }

  const server = createCockpitServer({
    port: args.port ?? DEFAULT_COCKPIT_PORT,
    indexHtmlPath: cockpitHtmlPath,
    settingsStore: createFileSettingsStore()
  });

  const url = await server.listen();
  process.stdout.write(`[cockpit] listening on ${url} (loopback only)\n`);
  process.stdout.write(`[cockpit] open  ${url}/  in your browser — pick a mic, press Start, speak.\n`);
  process.stdout.write("[cockpit] Ctrl+C / EOF で終了します（魂は close で畳みます）。\n");

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    process.stdout.write("\n[cockpit] closing…\n");
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  // stdin EOF（Ctrl+Z→Enter / パイプ終端）でも畳む（ears-cli.mjs の型）。
  const rl = createInterface({ input: process.stdin });
  rl.on("close", shutdown);
}

const invokedDirectly = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `[cockpit] FATAL: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exit(1);
  });
}
