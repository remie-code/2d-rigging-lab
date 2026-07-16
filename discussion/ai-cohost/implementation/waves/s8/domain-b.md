# S8 Domain B — 操縦席 + ホットキー配線（実装報告）

担当: Gnome（サブエージェント委任・呼び出し元 Orch-Sylph）
対象: `apps/soul/agent/src/cockpit/*`・`apps/soul/agent/scripts/fire-hotkey.ahk`（対象は `apps/soul/agent/` 配下のみ）

前提: Domain A（`fire-orchestrator.mjs` の `kill()`/`revive()`/`getKilled()`/`options.initialKilled`）は完了済みとして依存した。設計文書の指示どおり、POST /api/kill のレスポンス正本は snapshot + `kill()` 自身の戻り値のみとし、`fire()` の Promise には一切依存させていない。

## 変更/作成ファイル一覧

- `apps/soul/agent/src/cockpit/cockpit-server.mjs`（変更）— キル状態の正本（`killed` 変数）・POST /api/kill エンドポイント・snapshot への `killed` 露出・fireOrchestratorFactory への `initialKilled` born-killed 伝播・エンドポイント数 JSDoc 更新（16→17）。
- `apps/soul/agent/src/cockpit/view-logic/control.mjs`（変更）— `killSwitchView`/`killPostErrorText`/`killRequestErrorText` を追加。
- `apps/soul/agent/src/cockpit/ui/control-bar.mjs`（変更）— `KillSwitch` を活性化（view/onClick props）・`ControlBar` に `killed` prop + `onClickKill` ハンドラ + `killing` class 配線。
- `apps/soul/agent/src/cockpit/ui/app.mjs`（変更）— `settingsFromSnapshot` に `killed` 追加・`ControlBar` へ props 配線。
- `apps/soul/agent/src/cockpit/ui/styles.mjs`（変更）— `.control-bar .kill-switch.killed`・`.kill-switch-wrap`・`.kill-status`・`.control-bar.killing` の CSS を追加（既存 `.control-bar .kill-switch { color/border-color: var(--down); ... }` ルールは無変更のまま維持）。
- `apps/soul/agent/scripts/fire-hotkey.ahk`（変更）— `^!k`（Ctrl+Alt+K）= kill 専用ホットキー（`KillSoul()`）を追加。revive は送らない。
- `apps/soul/agent/scripts/cockpit.mjs`（**変更なし・確認のみ**）— `fireOrchestratorFactory` は `(hooks) => createFireOrchestrator({ ...hooks, ... })` で `...hooks` を spread するため、cockpit-server.mjs が hooks に `initialKilled` を足すだけで自動的に `createFireOrchestrator` へ届く。設計文書の想定どおり変更不要と確認した。
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`（変更）— `makeFakeOrchestrator` に kill/revive/getKilled/initialKilled 捕捉を追加（既存呼び出し箇所には影響なし・追加フィールドのみ）。POST /api/kill のテスト 7 件を追加。
- `apps/soul/agent/src/cockpit/view-logic/control.test.mjs`（変更）— kill 系ユニットテスト 4 件を追加。
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`（変更）— `KillSwitch` vnode テストを実装済み内容へ書き換え（3 件）・`settingsFromSnapshot` の期待値に `killed` を追加（既存アサーションの更新）・`COCKPIT_CSS` テストに killing/killed class の存在確認を追加。

`apps/soul/agent` 配下以外（器・契約・packages・lockfile・package.json）は一切変更していない。`apps/soul/agent/src/mind/{fire-orchestrator.mjs,fire-orchestrator.test.mjs}`・`apps/soul/agent/src/mind/barge-in.mjs` は Domain A の担当領域であり、本タスクでは一切触れていない。

## 追加した endpoint / snapshot キー / view-logic 関数 / UI 部品 / AHK ホットキー

### エンドポイント（1 本追加・既存 16→17）

- `POST /api/kill`（`cockpit-server.mjs`）
  - orchestrator 未注入なら `503 { error: "kill control not available" }`（POST /api/fire と同型ゲート）。
  - body は明示 `{ killed: boolean }` を要求（**トグル禁止**）。`typeof body.killed !== "boolean"` は `400 { error: "killed must be a boolean" }`（body 欠落＝ undefined も同じ 400 経路）。
  - サーバの `killed` 変数（正本）を更新 → `killed===true` なら `await fireOrchestrator.kill()`、`false` なら `fireOrchestrator.revive()` を **try/catch で握って** best-effort 呼び出し（fire() の Promise には一切依存しない） → `broadcastState()` → `200 snapshot()`。
  - JSDoc の「既存 16 エンドポイント×13 SSE」記述を 2 箇所（旧 :279・旧 :977 相当）とも「17 エンドポイント×13 SSE」に更新した。新規 SSE イベントは追加していない（既存 `state` イベントに `killed` フィールドが乗るだけ）。

### snapshot キー（1 個追加）

- `killed: boolean`（`snapshot()` の `selfFire`/`verbosity` の隣）。サーバ側正本の boolean をそのまま載せる。**常に boolean・既定 false**（orchestrator 未注入でも `killed` はサーバ変数の初期値 `false` を返す——`selfFire`/`verbosity` の「未注入なら null」パターンとは意図的に非対称。理由は下記「裁量判断」参照）。

### view-logic/control.mjs（純関数 3 個追加）

- `killSwitchView(killed)` → `{ killed, label, className, statusText, statusClassName }`。`killed=false` は `{killed:false, label:"■ KILL", className:"kill-switch", statusText:"", statusClassName:"kill-status"}`。`killed=true` は `{killed:true, label:"◆ 復帰", className:"kill-switch killed", statusText:"殺し中", statusClassName:"kill-status killed"}`。
- `killPostErrorText(res)` — POST /api/kill 応答のエラー文言（503/`!ok` は文言・成功は null。`selfFirePostErrorText` の写経）。
- `killRequestErrorText(e)` — fetch 失敗文言 `"kill error: " + e`（`selfFireRequestErrorText` の写経）。

### UI 部品（control-bar.mjs）

- `KillSwitch({ view, onClick })` — 活性化済み。ボタン 1 個（label/class は view 由来）+ killed 中のみ「殺し中」status span。
- `ControlBar` — props に `killed` を追加。`onClickKill` ハンドラ（`onToggleSelfFire` の写経・明示 boolean 送信・`applySnapshot` で snapshot 全体適用）。トップ要素 `<div class="control-bar">` を `killed` 中は `class="control-bar killing"` に切り替える。
- `app.mjs` — `settingsFromSnapshot` に `killed`（boolean・既定 false）追加、`<${ControlBar} ... killed=${settings.killed} .../>` で配線。

### CSS（styles.mjs）

- `.control-bar .kill-switch.killed`（背景反転）・`.kill-switch-wrap`・`.kill-status`・`.control-bar.killing`（バー全体に赤アクセント）。既存 `.control-bar .kill-switch { color: var(--down); border-color: var(--down); ... }` は不変。

### AHK ホットキー（fire-hotkey.ahk）

- `^!k`（Ctrl+Alt+K）→ `KillSoul()` — `POST /api/kill` に `{"killed":true}` を非同期送信。**kill 専用**（revive は送らない・復帰は操縦席の KILL スイッチ / 復帰ボタンのみ・設計指示の裁定どおり）。失敗は握って無通知（既存 `FireSoul`/`FireVision` と同型）。

## 追加テスト（14 件追加・既存 1 件を実装済み内容へ更新）

### cockpit-server.test.mjs（POST /api/kill・7 件）

1. orchestrator 未注入なら 503。
2. GET /api/state の snapshot に `killed` キーが載る（初期 false）。
3. `{killed:true}` → 200・`snapshot.killed:true`・fake orchestrator の `kill()` が 1 回呼ばれた・SSE `state` イベントに `killed:true` が乗って流れる。
4. `{killed:false}`（先に kill 済みの状態から）→ 200・`snapshot.killed:false`・fake orchestrator の `revive()` が 1 回呼ばれた。
5. 非 boolean（文字列 `"yes"`）→ 400・kill/revive とも呼ばれない・state 不変。
6. body 欠落（`{}`）→ 400。
7. born-killed 確認: サーバ起動直後（killed 初期 false）に `fireOrchestratorFactory` の hooks へ渡る `initialKilled` が `false` であることを fake factory で捕捉。

`makeFakeOrchestrator` は `kill()`/`revive()`/`getKilled()` と `hooks.initialKilled` 捕捉を追加（既存呼び出し箇所は無変更・呼び出し引数も戻り値も追加のみで既存アサーションに影響しない）。

### view-logic/control.test.mjs（4 件）

1. `killSwitchView(false)` の構造体固定（undefined/null も false 扱いになることを含む）。
2. `killSwitchView(true)` の構造体固定。
3. `killPostErrorText` の 503/`!ok`/成功 null。
4. `killRequestErrorText` の catch 文言。

### cockpit-ui.test.mjs（vnode 走査・3 件 + 既存更新）

1. `KillSwitch` vnode: `killed=false` は「■ KILL」ボタン・disabled ではない・「殺し中」を描かない。
2. `KillSwitch` vnode: `killed=true` は `class="kill-switch killed"`・「復帰」「殺し中」を描く。
3. `KillSwitch` vnode: `onClick` が素通しされる。
4. 既存「KillSwitch vnode: 枠のみ・disabled（S8 予約・no-op）」テストは S8 実装済みの内容（上記 1〜3 相当）へ置き換えた（このテストは S8 予約段階の暫定固定だったため、本タスクのスコープ内で正当な更新と判断）。
5. 既存 `settingsFromSnapshot` テストの期待値に `killed: false`（null 入力時）/ `killed: true`（フル snapshot 例）を追加（実装で `settingsFromSnapshot` の返り値フィールドが増えたため、既存 `deepEqual` が壊れるのを防ぐ更新）。
6. 既存 `COCKPIT_CSS` テストに `.control-bar .kill-switch.killed` / `.control-bar.killing` の存在確認を追加。

## テスト結果（生の集計行・自分で実測）

Domain B の変更差分を `git diff` でパッチ化し、`git checkout --` で一旦「実装前」の状態（Domain A 分は無変更のまま）に戻して実装前ベースラインを取得、その後 `git apply` で復元して実装後を計測した。

### 実装前（ベースライン = 既存 729 + Domain A 9 件）

```
1..738
# tests 738
# suites 0
# pass 738
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2304.4213
```

### 実装後（`apps/soul/agent` を cwd に `node --test` フルスイート）

```
1..751
# tests 751
# suites 0
# pass 751
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2559.0655
```

751 − 738 = 13（新規追加 14 件 − 置き換えで消えた旧テスト 1 件 = net +13 と一致）。全緑・無退行。

## git diff --stat（apps/soul/agent 配下・Domain A/B 双方を含むリポジトリの現況）

```
apps/soul/agent/scripts/fire-hotkey.ahk              |  38 ++-
apps/soul/agent/src/cockpit/cockpit-server.mjs       |  56 +++-
apps/soul/agent/src/cockpit/cockpit-server.test.mjs  | 137 ++++++++-
apps/soul/agent/src/cockpit/cockpit-ui.test.mjs      |  39 ++-
apps/soul/agent/src/cockpit/ui/app.mjs               |   7 +-
apps/soul/agent/src/cockpit/ui/control-bar.mjs       |  64 ++++-
apps/soul/agent/src/cockpit/ui/styles.mjs            |  13 +-
apps/soul/agent/src/cockpit/view-logic/control.mjs   |  50 ++++
apps/soul/agent/src/cockpit/view-logic/control.test.mjs |  42 ++-
apps/soul/agent/src/mind/barge-in.mjs                |   8 +   ← Domain A（未接触）
apps/soul/agent/src/mind/fire-orchestrator.mjs       | 137 +++++++--  ← Domain A（未接触）
apps/soul/agent/src/mind/fire-orchestrator.test.mjs  | 311 ++++++++++++++++++++-  ← Domain A（未接触）
12 files changed, 843 insertions(+), 59 deletions(-)
```

上 9 ファイル（`scripts/fire-hotkey.ahk`〜`view-logic/control.test.mjs`）が Domain B（本タスク）の変更。下 3 ファイル（`src/mind/*`）は Domain A の担当領域であり本タスクでは一切変更していない（既に完了・レビュー済みとして受け取った既存差分）。

`apps/soul/agent/scripts/cockpit.mjs` は `git status` に一切現れず（無変更）——設計文書の想定どおり、`...hooks` spread により変更不要と確認した。

## 器/契約/依存/lockfile 不変の確認

```
apps/runtime-player: git status --short → 出力なし（無変更）
channel-*-contract 系 3 ファイル（channel-protocol-contract.ts/.test.ts・channel-bridge-contract.ts）: git status --short → 出力なし（無変更）
packages/: git status --short → 出力なし（無変更）
pnpm-lock.yaml: git status --short → 出力なし（無変更）
apps/soul/agent/package.json: git status --short → 出力なし（無変更）
package-lock.json: リポジトリに存在しない（pnpm 運用のため対象外）
```

リポジトリ全体の `git status --short`（`apps/soul/agent` 以外)には、セッション開始時点で既に `M`/`??` として記録されていた他セッション領分の変更（`apps/authoring-host/src/perception/render-scene-adapter.ts`・`discussion/mesh-generation/**`・`discussion/design/mesh-rendering/**`・`.tmp/**` 等）が引き続き存在するが、本タスクでは一切触れていない。install・commit も行っていない。

## blocking レビュー基準への対応（実装側の根拠）

1. **ワイヤ契約 additive**: 既存 16 エンドポイント×13 SSE は 1 ビットも変えていない。POST /api/kill の追加のみ（→17 本）。新規 SSE イベントは追加していない（`killed` は既存 `state` イベントの snapshot に相乗り）。器/契約/依存/lockfile 不変は上記コマンド出力で確認済み。
2. **キル状態の正本はサーバ側一つ**: `cockpit-server.mjs` の `killed` 変数のみが書き手（POST /api/kill ハンドラだけが代入する）。orchestrator へは (a) 生成時 `initialKilled: killed`（`fireOrchestratorFactory` 呼び出しの hooks に追加）と (b) 遷移時 `kill()`/`revive()`（POST ハンドラ内）の両方で伝播する。テスト 7（born-killed）で (a) を、テスト 3/4 で (b) を直接確認済み。
3. **KILL ボタン活性化 + キル中の視覚化 + 一クリック復帰**: `KillSwitch` は `disabled` を持たない実装済みボタン（通常時「■ KILL」/キル中「◆ 復帰」+「殺し中」status）。`ControlBar` のトップ要素に `killing` class を付与し、CSS（`.control-bar.killing`）でバー全体に赤アクセントを与える。復帰は同じボタンを 1 回押すだけ（`{killed:false}` を明示送信）。
4. **POST /api/kill は fire() の Promise に依存しない**: ハンドラは `fireOrchestrator.kill()`/`revive()` を呼ぶが、レスポンスは `snapshot()` のみを返す（`fire()` を呼ばず、その戻り値も参照しない）。設計文書が指摘した「kill 中の再生は barge-in と見分けがつかない `{fired:true,interrupted:true}` になる」問題を、レスポンス経路から完全に切り離すことで回避した。

## 裁量判断

1. **snapshot.killed は常に boolean（既定 false）・null 許容にしなかった**: `selfFire`/`verbosity` は「scheduler 未生成（orchestrator 未注入）= null」という「機能が存在しない」ことを表す設計だが、`killed` はサーバ自身が持つ正本 boolean であり、orchestrator の有無に関わらず「今キル状態かどうか」という問いには常に答えられる（デフォルトは非キル = false）。UI 側（`settingsFromSnapshot`）もこれに合わせて `killed` は常に boolean に畳む実装にした。POST /api/kill 自体は orchestrator 未注入なら 503 になるため、「サーバの正本は追える・実際に効かせる操作だけが不可」という状態を正直に表せる。
2. **KILL ボタンに `disabled` 概念を持たせなかった**: `SelfFirePill` は snapshot に `selfFire:null`（scheduler 未生成）という「使えない」シグナルが乗るため disable できるが、`killed` には同種のシグナルが無い（1 の理由どおり常に boolean）。orchestrator 未注入かどうかは snapshot からは判別できないため、KillSwitch は常に押せる状態にし、実際に未注入なら押下時の 503 応答を `killPostErrorText`（"kill control not available"）で正直に表示する設計にした。
3. **KILL/復帰を同一ボタン + 明示 boolean 送信で実装（トグル送信はしない）**: 設計指示「明示指定（トグル禁止）」を、UI 実装としては「1 個のボタンが view（killSwitchView）の label/class で切り替わり、クリック時に `!killView.killed` を計算して明示 boolean として POST する」形にした。サーバ側は受け取った boolean をそのまま設定するだけで反転ロジックを持たない（`cockpit-server.mjs` の `killed = body.killed;`）ため、「クライアントが選んだ意図を明示的に伝える」という設計意図は保たれている。2 個の別ボタン（KILL 用/復帰用）にする案も検討したが、`selfFireToggleView`/`VerbositySelect` の「1 部品が view で切り替わる」既存様式との統一を優先した。
4. **AHK の `^!k` は kill 専用・revive を送らない**: 設計指示どおり実装。誤操作で配信中にうっかりキルを解除しないための安全弁（復帰は操縦席の明示クリックのみ）。
5. **既存テスト `KillSwitch vnode: 枠のみ・disabled（S8 予約・no-op）` の扱い**: このテストは S8 実装前の暫定固定（コメントに「S8 予約」と明記）だったため、実装済み内容を確認する新規アサーションへ書き換えた（削除ではなく置換）。同様に `settingsFromSnapshot` の既存 `deepEqual` 期待値も `killed` フィールド追加に合わせて更新した——これらは「無関係な変更を revert しない」制約に抵触しない、本タスクのスコープ内（S8 の予約実装を完成させる）妥当な更新と判断した。
6. **CSS の意匠**: 設計文書に具体的な配色指定がなかったため裁量で決定。キル中はボタン背景を `var(--down)`（既存の赤トークン）で反転し、バー全体には `box-shadow ... inset` + `border-color: var(--down)` で控えめな赤枠を追加した（既存 `.kill-switch` の赤系トークンとの一貫性を優先・新規トークンは追加していない）。

## 質問

特に判断に迷う不足情報はありませんでした。念のため 2 点、確認事項として記載します。

1. **snapshot.killed の null 非許容という裁量（上記 1）**: これは設計文書に明記されていなかった判断のため、レビューで意図と異なると指摘されれば `selfFire`/`verbosity` 型に揃えて null 許容へ変更する余地があります（`settingsFromSnapshot`・`killSwitchView` 側は null/undefined を false として扱う実装にしてあるため、サーバ側だけ null 許容に変えても UI 側の追従は小さい変更で済みます）。
2. **KillSwitch の「1 ボタン + 明示 boolean 送信」という実装形（上記 3）**: 「明示指定・トグル禁止」の要件をサーバ側 API 契約（body の boolean）としては厳格に満たしていますが、UI コンポーネント自体の見た目は「押すたびに状態が反転して見える」1 ボタン UI です。もし「view として KILL ボタンと復帰ボタンを完全に別の DOM 要素にする」ことまで要求されている場合は追加の分離が必要になります。現状は selfFire/verbosity の既存様式（1 部品が view で切り替わる controlled component）との統一を優先しました。
