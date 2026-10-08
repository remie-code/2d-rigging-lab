# S2.5 Domain B 実装記録: 操縦席のページ本体 + 永続化 + 起動導線 + preflight + 仕上げ

> Status: 実装完了・機械ゲート全緑（2026-07-12, Gnome）。install 不要（新規 npm 依存ゼロ・lockfile 不変）。
> スコープ: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §3 Domain B。
> 消費するワイヤ契約の正: [domain-a.md](domain-a.md) §3（HTTP）・§4（SSE）・§5（settings store IF）。
> UX の正: [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md)（Accepted）。

## 0. 判定サマリ

- **緑で裏取り済み**: 実ページ（vanilla 単一ファイル）+ file-backed デバイス永続化 + 起動導線（URL 表示・
  clean 終了）+ preflight + docs。魂の全テスト **226/226 緑**（S1/S2 の 196 + Domain A 21 = 217 無退行 +
  Domain B 新規 9）。`preflight-cockpit.mjs` PASS（exit 0・ハングなし）。
- **ブラウザ実機スモーク**（実マイク不使用・ffmpeg 不在環境）: 実サーバ（`npm run cockpit`）にブラウザで
  接続 → ページが**コンソールエラーゼロ**でレンダ、ヘッダ/デバイスドロップダウン（列挙失敗を赤字で正しく
  surface）/Start/Stop/Timeline/footer が全て出る。SSE 接続・fetch 呼び出しが実際に走ることを確認。
- **3 モノレポチェック**: `check:soul-zone` 緑 / `check:deps` 緑 / `check:source` は器（runtime-player）の
  **pre-existing 違反 1 件で赤だが本ドメイン外**（新規ファイルの違反ゼロ・§6）。
- **lockfile 不変**: `pnpm-lock.yaml`・`apps/soul/agent/package-lock.json` ともに差分ゼロ。
- **Domain A 非接触**: `cockpit-server.mjs`・`cockpit-server.test.mjs` は**利用のみ・1 バイトも変更せず**。
  結線契約（§3-5）だけを消費して実装した（結線不能箇所なし）。

## 1. 作成/変更した全ファイル（絶対パス）

### 新規（実装）
| パス | 役割 |
| --- | --- |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit.html` | 操縦席の実ページ（単一ファイル vanilla HTML/CSS/JS・`EventSource`/`fetch` のみ・外部リソースゼロ）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-page.mjs` | `cockpitHtmlPath` を export（`cockpit.html` の絶対パス・`indexHtmlPath` でサーバに渡す）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-settings-store.mjs` | file-backed settings store（`createFileSettingsStore` + `DEFAULT_SETTINGS_PATH`・失敗寛容・パス注入可）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.mjs` | 本番起動エントリ（実 pipeline + file store + 実ページ・127.0.0.1・URL 表示・SIGINT/EOF で clean close）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\preflight-cockpit.mjs` | 機械ゲート preflight（実マイク不使用・`GET /`・`/api/state`・`/api/devices` を検証し exit code）。 |

### 新規（機械テスト）
| パス | 件数 | 役割 |
| --- | --- | --- |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-page.test.mjs` | 4 | 実ページの構造存在 + ワイヤ契約消費 + 自己完結性 + 履歴レイテンシ非対称の固定。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-settings-store.test.mjs` | 5 | set→get ラウンドトリップ + 失敗寛容 + 既定パス位置 + テスト非汚染。 |

### 変更（許容範囲）
| パス | 変更内容 |
| --- | --- |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\package.json` | `scripts` に `"cockpit": "node scripts/cockpit.mjs"` を **1 行追加**（起動コマンドを 1 個に）。`dependencies` は不変・lockfile 不変。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\.gitignore` | `cockpit-settings.local.json` を無視追加（デバイス選択の永続化ファイル・非コミット）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\README.md` | 「S2.5: 操縦席」節を 1 個追記（器 README・器コードには触れていない）。 |

### 新規（docs）
- `discussion/ai-cohost/implementation/waves/s2.5/human-gate-procedure.md`（人間ゲート手順書）。
- `discussion/ai-cohost/implementation/waves/s2.5/s2-5-followup.md`（followup 台帳）。
- 本ファイル `discussion/ai-cohost/implementation/waves/s2.5/domain-b.md`（契約成果物）。

## 2. ページがワイヤ契約（domain-a.md §3-5）をどう消費するか

ページは **Domain A の契約だけ**を消費する（`cockpit.html` の `<script>`・ブラウザ組み込み `EventSource`/`fetch`）。

| ワイヤ（Domain A） | ページの消費（UI 要素） |
| --- | --- |
| `GET /`（§3.1） | 操縦席ページそのもの。`indexHtmlPath: cockpitHtmlPath` でサーバが配信。 |
| `GET /api/devices`（§3.2） | 初期ロードで Microphone ドロップダウンを構築。`lastDevice` を初期選択。`error` は赤字で surface（列挙ゼロ/失敗でも動く）。 |
| `GET /api/state`（§3.3） | 初期ロードで **Timeline 履歴復元**（`transcripts[]`）+ ヘッダ/フッタ描画。履歴行はレイテンシ無し（§3.3 注どおり live 行のみ `(Ns)`）。 |
| `POST /api/ears/start`（§3.4） | **Start** ボタン。選択デバイスを body `{device}` で送る。`200`→state 反映、`500`→エラー表示 + `state` で畳む。押下中は Stop/Start を disable（多重発火抑止）。 |
| `POST /api/ears/stop`（§3.5） | **Stop** ボタン。応答 state を反映（stopped・uptime 0）。 |
| SSE `state`（§4） | ヘッダ（Listening/Stopped・whisper/ffmpeg up/down・**down は赤 + reason**）+ footer（discarded・uptime）を更新。接続直後の初期 state も同経路。 |
| SSE `vad`（§4） | `speechStart`→`······(speaking)` ライブ行を Timeline に出す。`speechEnd`/`speechCancel`→ライブ行を消す。 |
| SSE `transcript`（§4） | Timeline に本文行（時刻/話者/本文/レイテンシ）を append。`latencyMs` があるときだけ `(Ns)` を描く。 |
| SSE `discard`（§4） | footer の `discarded` を更新。 |
| SSE `diagnostic`（§4） | 購読口だけ用意（v0 は未表示・拡張予約）。 |

**拡張予約（§3・枠だけ）**: 話者ラベルは `you`/`soul` を扱える `speaker-*` クラス、各行に空 `.marker` span
（発火マーカーの余地）、`diagnostic` 購読口。v0 は `you` のみ・マーカー空・診断非表示・認証/転写編集/設定
編集 UI なし（§4「ないもの」）。UI 語彙は英語・数字（レイテンシ/uptime）の露出は可（診断面）。

## 3. file-backed settings store（保存先・失敗寛容・テスト非汚染）

- **保存先**: `apps/soul/agent/cockpit-settings.local.json`（`DEFAULT_SETTINGS_PATH`・`.gitignore` 済み・
  **非コミット**）。JSON `{ "lastDevice": "<raw デバイス名>" }`。start 成功時にサーバが `setLastDevice` を
  呼び記憶、次回起動時に `getLastDevice` で初期選択に使う。
- **失敗寛容**（契約 §5）: `getLastDevice` は未作成/読めない/壊れた JSON/想定外 shape → `null`。
  `setLastDevice` は `mkdir`/`write` 失敗（ディスク I/O）を握って続行（起動を止めない）。同期実装
  （`node:fs` の *Sync）——サーバが `await` するため同期でも動く。
- **テスト非汚染**: 保存パスは `options.path` で注入可能。5 テストは全て OS temp（`mkdtempSync`）を使い、
  実設定ファイルに触れない。preflight も temp パスを注入。**実機スモーク後も既定ファイルは未作成
  （Start を押さない限り書かれない）を実測で確認**（`ls … cockpit-settings.local.json` → 不在）。

## 4. 起動コマンド（1 個）とアクセス URL

- **起動**: `npm run cockpit --prefix apps/soul/agent`（等価 `node apps/soul/agent/scripts/cockpit.mjs`・
  `-- --port N` でポート変更）。
- **URL**: 既定 `http://127.0.0.1:8181/`（起動時に標準出力へ表示）。**127.0.0.1 限定**。
- 実マイクが無くてもサーバは起動しページは開ける（Start を押すまで実デバイスに触れない）。**SIGINT
  （Ctrl+C）/ stdin EOF で clean close**（`server.close()`＝耳の dispose + HTTP close・ハンドル解放）。
  `ears-cli.mjs` の SIGINT/EOF 配線の型を踏襲。

## 5. preflight-cockpit の実行結果（生）

```
$ node apps/soul/agent/scripts/preflight-cockpit.mjs
[preflight-cockpit] server listening at http://127.0.0.1:3262 (loopback)
[preflight-cockpit] GET /            → 200 html=true hasTimeline=true
[preflight-cockpit] GET /api/state   → 200 ears=stopped health=true
[preflight-cockpit] GET /api/devices → 200 deviceCount=0 error=ffmpeg spawn failed: spawn ffmpeg ENOENT
[preflight-cockpit] RESULT: PASS (page served, state + devices respond; mic untouched)
[preflight-cockpit] server closed (no hang)
EXIT=0
```

- ffmpeg 不在環境（この開発機）でも `GET /api/devices` は `200` + `devices: []` + error 文字列を返す
  （「デバイスゼロでも可」の契約どおり・失敗寛容）。耳の Start は押さない（実デバイス非依存）。
- 終了後 `server.close()` で自然終了（ハングなし・exit 0）。

## 6. テスト結果（生の数字）+ 3 チェック + lockfile

### `node --test`（`apps/soul/agent`）
```
# tests 226
# pass 226
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms ≈ 1031
```
- **217 無退行**（S1/S2 196 + Domain A 21）**+ Domain B 新規 9 = 226**。
- Domain B 新規 9 の内訳（`node --test src/cockpit-page.test.mjs src/cockpit-settings-store.test.mjs`
  → `tests 9 / pass 9 / fail 0`）:
  - `cockpit-page.test.mjs`（4）: ① 実ページ配信 + 必須領域 9 識別子（ears-status/health-whisper/
    health-ffmpeg/device-select/btn-start/btn-stop/timeline/footer-discarded/footer-uptime）② ワイヤ契約
    消費（`EventSource(/api/events)`・`/api/devices`・`/api/state`・`/api/ears/start|stop`・SSE 4 種の
    `addEventListener`）③ 自己完結性（外部 script/stylesheet/http(s) src・@import が無い）④ 履歴レイテンシ
    非対称（`latencyMs != null` 分岐）。
  - `cockpit-settings-store.test.mjs`（5）: ① set→get + 別インスタンス永続 ② `null` クリア ③ 未作成/
    壊れ JSON/想定外 shape → null ④ 書けないパス → setLastDevice が throw しない ⑤ 既定パスが
    `apps/soul/agent/cockpit-settings.local.json`。

### 3 モノレポチェック（リポジトリルート）
- `pnpm run check:soul-zone` → **緑**（`1312 source files scanned; no 器→魂 imports and no 魂→器 code
  imports.`・Domain A の 1306 から +6＝新規 .mjs 6 本。`.html` は code 走査対象外）。
- `pnpm run check:deps` → **緑**（`Dependency guard passed.`）。
- `pnpm run check:source` → **赤（pre-existing・本ドメイン外）**。唯一の違反は
  `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`
  （器ファイル・**本変更で 1 バイトも触れていない**・Orch 確定済み）。**Domain B の新規ファイルは
  違反ゼロ**（.mjs/.html は `.ts` のみ走査するこのチェックの対象外）。

### lockfile 不変
- `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package-lock.json` → **出力なし（差分ゼロ）**。
- 新規 npm 依存ゼロ（`package.json` の `dependencies` 不変・`scripts` に 1 行のみ追加）。vanilla + Node
  組み込み（`node:http`/`node:fs`/`node:os`/`node:readline`/`node:url`/`node:path`）+ ブラウザ組み込み
  （`EventSource`/`fetch`）のみ。ビルドチェーン/CDN 非導入。

### git status（本ドメイン関連）
```
 M apps/soul/agent/.gitignore          （cockpit-settings.local.json 無視追加）
 M apps/soul/agent/package.json        （scripts に cockpit 1 行）
?? apps/soul/agent/scripts/cockpit.mjs
?? apps/soul/agent/scripts/preflight-cockpit.mjs
?? apps/soul/agent/src/cockpit-page.mjs
?? apps/soul/agent/src/cockpit-page.test.mjs
?? apps/soul/agent/src/cockpit-settings-store.mjs
?? apps/soul/agent/src/cockpit-settings-store.test.mjs
?? apps/soul/agent/src/cockpit.html
?? discussion/ai-cohost/implementation/waves/s2.5/  （domain-b.md・human-gate-procedure.md・s2-5-followup.md）
```
（`cockpit-server.mjs`/`cockpit-server.test.mjs` も untracked で並ぶが、これは Domain A の未コミット成果。
Gnome は読むだけで変更していない＝`git diff` にトラック差分なし。）

## 7. docs / followup のパス

- 人間ゲート手順書: `discussion/ai-cohost/implementation/waves/s2.5/human-gate-procedure.md`
  （起動コマンド 1 個 → URL をブラウザで開く → マイク選択 → Start → 喋る → Timeline に積もる。
  **CLI を一切触らず**操縦席だけで完結）。
- README 追補: `apps/soul/README.md`「S2.5: 操縦席」節。
- followup 台帳: `discussion/ai-cohost/implementation/waves/s2.5/s2-5-followup.md`
  （Domain A レビュー non-blocking のうち Domain B で拾わなかった 4 件 = 409 テスト欠落 / devices 失敗
  HTTP 未固定 / 履歴レイテンシ非対称〈設計どおり・回収不要〉/ SSE write 失敗の close 任せ + Domain B の
  設計判断 3 件）。

## 8. 設計判断・裁量・既存コード非接触

- **ページはファイル配信（`indexHtmlPath`）を選択**（裁量）: HTML を .mjs 文字列に埋め込むと client JS の
  `${...}` がテンプレートリテラルで誤展開される escaping 問題が出る。`cockpit.html` を素の .html として置き
  `cockpit-page.mjs` が絶対パスを export、サーバの `indexHtmlPath` 経路（リクエスト毎に readFile）で配信。
  ページを素の HTML としてレビュー/編集できる。テストは `indexHtmlPath` 注入で実配信経路を通す。
- **uptime はクライアント側 1s ローカル刻み**（裁量）: `state` イベントは start/stop/死活でしか飛ばないため、
  ページは受信した `uptimeMs` を anchor にローカル時計で刻む（listening 中のみ・stopped で 0）。診断面の
  目安として十分・サーバ改変不要（followup §2-1 に厳密化の余地を記録）。
- **デバイスドロップダウンの列挙失敗を赤字で surface**（裁量）: `/api/devices` の `error` 文字列を
  ドロップダウン下に出す（ffmpeg 不在時に `(device enumeration failed)` + 理由）。列挙は録音ではないので
  実害はここだけ・CLI の `--list-devices` を廃止置換できる。
- **既存コード非接触（明示）**: Domain A の `cockpit-server.mjs`/`cockpit-server.test.mjs` は**読み取り
  import/利用のみ**（`createCockpitServer`・`DEFAULT_COCKPIT_PORT` を使う）。他の魂 zone コード
  （ear-pipeline 等）にも触れていない。器コード（apps/soul 外）・C4 契約 fixture・S1/S2 の既存挙動/
  既存テストは一切変更していない。新規 npm 依存ゼロ・install 不要。

## 9. 質問（Orch / Undine へ）

現時点で**実装をブロックする不足情報は無し**（Domain A のワイヤ契約 §3-5 で結線は全て成立した）。
以下は判断の裏取りとして共有する（いずれも v0 では対応せず followup に記録済み・S3 以降の設計余地）:

1. **409 / devices 失敗 HTTP の回帰固定**（followup §1-1, §1-2）: Domain A テスト（変更禁止）に無い。
   preflight とページ側 disable で実挙動は担保しているが、テストスイートの回帰としては未固定。回収する
   なら Domain A テストへのケース追加が素直（Domain B の scope 外なので拾っていない）。この理解で
   合っているか（＝ Domain B は Domain A テストに触れないのが正しい線引きか）。
2. **uptime の厳密さ**（followup §2-1）: v0 はクライアント側ローカル刻みで足りるという理解で合っているか。
   厳密な uptime/コスト実測は S3 のコストメーターと同時に Domain A へ tick イベントを足すのが素直。
