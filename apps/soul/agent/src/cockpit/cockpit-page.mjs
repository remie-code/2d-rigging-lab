// @ts-check
/**
 * コクピットのページ本体（S2.5 Domain B）— apps/soul/agent。
 *
 * ページは **単一ファイル配信の vanilla HTML/CSS/JS**（`cockpit.html`）。ビルドチェーンを持ち込まず、
 * ブラウザ組み込み（`EventSource` で SSE 購読・`fetch` で制御 API）+ 自 zone 内リソースのみで完結する
 * （CDN・外部フォント/スクリプト・npm 依存ゼロ）。消費するワイヤ契約は Domain A の
 * waves/s2.5/domain-a.md §3（HTTP エンドポイント）・§4（SSE イベント）だけ。
 *
 * サーバへは `indexHtmlPath: cockpitHtmlPath` で渡す（`createCockpitServer` が GET / でファイルを配信）。
 * 文字列を直接埋め込まずファイルパスにするのは、テンプレートリテラルのエスケープ問題を避け、
 * ページを素の .html として編集/レビューできるようにするため。
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** コクピットの実ページ（`cockpit.html`）の絶対パス。CLI/preflight が `indexHtmlPath` に渡す。 */
export const cockpitHtmlPath = join(here, "cockpit.html");
