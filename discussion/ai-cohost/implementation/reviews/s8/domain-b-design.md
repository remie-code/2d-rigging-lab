# S8 Domain B レビュー — design 適合 / blocking レビュー基準レーン

> レビュアー: Review-Sylph（design 適合レーン・読み取り専任）
> 対象: `apps/soul/agent/src/cockpit/cockpit-server.mjs` / `view-logic/control.mjs` / `ui/control-bar.mjs` / `ui/app.mjs` / `ui/styles.mjs` / `apps/soul/agent/scripts/fire-hotkey.ahk`（`scripts/cockpit.mjs` は確認のみ・無変更）
> 判定基準: [s8-wave-plan.md](../../orchestration/s8-wave-plan.md) §2・§4（blocking 基準 1・4）・§Domain B、[s8-planning-inventory.md](../../orchestration/s8-planning-inventory.md) §2-2・§3-5
> Gnome 報告: [domain-b.md](../../waves/s8/domain-b.md)
> 申し送り元: [domain-a-design.md](domain-a-design.md)（kill() 戻り値 vs fire() Promise 非依存の申し送り）
> 並走レビュー: [domain-b-spec.md](domain-b-spec.md)（spec 適合レーン・独立に同一結論へ到達）

## 判定: **合格**

`node --test`（`apps/soul/agent` を cwd）を独立再実行し **751/751 緑**を確認（Gnome 報告と一致）。`apps/soul/agent` 配下のみ 12 ファイルが変更されており（`git status --short` 実測）、うち Domain B 分は 9 ファイル（`cockpit-server.mjs`・`cockpit-server.test.mjs`・`cockpit-ui.test.mjs`・`ui/app.mjs`・`ui/control-bar.mjs`・`ui/styles.mjs`・`view-logic/control.mjs`・`view-logic/control.test.mjs`・`scripts/fire-hotkey.ahk`）、残り 3 ファイル（`src/mind/{barge-in,fire-orchestrator,fire-orchestrator.test}.mjs`）は Domain A 領域で本タスクは触れていない。`apps/runtime-player`・channel-*-contract 系・`packages/`・`pnpm-lock.yaml`・`apps/soul/agent/package.json` は `git status --short` で無出力（不変）を確認済み。

## blocking レビュー基準（§4）該当項目の判定

### 4. ワイヤ契約 additive — 合格

- **新規 SSE イベント追加なし**: `cockpit-server.mjs` 内 `broadcast(` の全呼び出しを列挙し、イベント名の集合が `state, diagnostic, vad, transcript, discard, soul, fire, expression, visionCaptured, usage, selfFire, chatStatus, chatDiagnostic` の 13 種のまま不変であることを実測確認。`onUsage: (info) => broadcast("usage", info),` の末尾カンマ変更は直後の `initialKilled: killed` プロパティ追加に伴う構文上の変更にすぎず、`broadcast("usage", info)` 自体は 1 文字も変わっていない。`killed` は既存 `state` イベントの snapshot に相乗りするのみ（`broadcastState()` → `broadcast("state", snapshot())`、:540 は無変更）。
- **既存エンドポイントの分岐は 1 つも変更なし**: diff は `POST /api/kill` の新規 `if` ブロック挿入のみで、既存の `if (method === ... && pathname === ...)` 分岐列は前後とも無変更。JSDoc の「16 エンドポイント×13 SSE」表記 2 箇所（本体 JSDoc・静的アセット節コメント）は「17 エンドポイント×13 SSE」に追随更新済み。
- **器/契約/依存/lockfile 不変**: `git status --short -- apps/runtime-player apps/soul/agent/package.json pnpm-lock.yaml packages` および channel-*-contract 系ファイルを対象に実行し無出力を確認。

### キル状態の正本一つ（Domain B 固有 blocking） — 合格

`grep -n "killed ="` を `cockpit-server.mjs` に対して実行した結果、代入箇所は次の 2 つのみ:

- `:442 let killed = false;`（宣言・初期化）
- `:948 killed = body.killed;`（POST /api/kill ハンドラ内・唯一の書き手）

`snapshot()` 内 `killed: killed`（:507 付近）は読むだけで代入していない。他に `killed` へ書き込む経路は存在しない。

### 生成時 + 遷移時の両方の伝播（Domain B 固有 blocking） — 合格

- **生成時（born-killed）**: `let killed = false;`（:442）の宣言は `fireOrchestratorFactory(...)` 呼び出し（:1146-1147 付近、hooks に `initialKilled: killed` を含む）よりコード上前に存在し、フックが factory へ渡る前に必ず現在の `killed` 値が確定している。`scripts/cockpit.mjs:511-516` の `fireOrchestratorFactory = (hooks) => createFireOrchestrator({ ...hooks, session, channel, player, ... })` が `...hooks` を spread するため、`cockpit-server.mjs` 側の追加だけで `createFireOrchestrator` の `options.initialKilled` に自動的に届く実装であることを実ファイルで確認した（Gnome 報告の主張どおり・`cockpit.mjs` 自体は無変更で正しい）。Domain A 側 `fire-orchestrator.mjs:217`（`let killed = options.initialKilled === true;`、Domain A レビューで確認済み）との名前一致も確認。
- **遷移時**: POST /api/kill ハンドラが `killed` 値に応じ `await fireOrchestrator.kill()` または `fireOrchestrator.revive()` を呼ぶ（:952-957）。
- 「キル中に遅延生成される orchestrator はキル済みで生まれる」不変は、`killed` 宣言と factory 呼び出しのコード上の前後関係、および `...hooks` spread の 2 点が構造的に保証しており、単発のテストに依存しない設計になっている点を確認した。テスト（born-killed テスト、`cockpit-server.test.mjs:332-341`）でも実測済み。

### 遷移時伝播 + fire() 非依存（Domain A 申し送り） — 合格

`cockpit-server.mjs:934-964` の POST /api/kill ハンドラを確認。`fireOrchestrator.kill()`/`revive()` を `try/catch` で best-effort 呼び出し、`broadcastState()` → `sendJson(res, 200, snapshot())` の順で完結しており、`fireOrchestrator.fire()` を一切呼ばず、その戻り値も参照していない。

念のため Domain A 側 `fire-orchestrator.mjs:558-567` の `kill()` 実装本体も直接確認した。`kill()` は常に `{killed:true, severed:false}` または `severSpeaking()` 経由の `{killed:true, severed:true, ...}` を返す構造で、内部の副作用（`player.stop()` 等）は `severSpeaking` 内の try/catch で吸収されているため、`await fireOrchestrator.kill()` がリジェクトして「サーバの `killed` 正本は true だが実際の orchestrator は未反映」という乖離が生じる経路は実質的に存在しない。cockpit-server 側の try/catch は防御的な保険であり、正本の整合性を損なわない。

### 復帰の健全性（§4-6 の操縦席側） — 合格

`revive()` は `killed = body.killed`（false）→ `fireOrchestrator.revive()` を呼ぶのみ。Domain A 側 `revive()`（`killed = false;` のみ、他状態に無接触）と組み合わせて、次の発火が正常に通ることは Domain A レビューのテスト 4/5 で既に検証済み。Domain B 側の UI は `killSwitchView(killed)` を毎レンダーで再計算する controlled component であり、ローカル state を持たないため UI 側の残留（ボタンラベルが killed 状態と食い違う等）も構造的に発生しない。

## 追加 design 検証

### 写経の忠実性

- **POST /api/kill**: `/api/self-fire`（:886-905）/ `/api/verbosity`（:907-932）と同じ「未注入 503 → body 検証 → 早期 400 → 正本更新 → フック失敗寛容 → `broadcastState()` → `sendJson(200, snapshot())`」の順序を完全に踏襲している。コメントでも明示的に対応箇所（:886-893, :909-912）を参照しており、写経元との対応が追跡可能。
- **view-logic**: `killSwitchView`/`killPostErrorText`/`killRequestErrorText` は `selfFireToggleView`/`selfFirePostErrorText`/`selfFireRequestErrorText` と一対一で対応する構造・命名。「非表示（更新しない）= null」の様式（`killPostErrorText` は成功時 null を返す）も踏襲されている。
- **UI（control-bar.mjs）**: `onClickKill` は `onToggleSelfFire`/`onChangeVerbosity` と全く同型のフロー（`setControlError("")` → POST → `.then(res => ...)` → エラー文言判定 → `applySnapshot(res.j)` → `.catch`）。`ControlBar` トップ要素の `killing` class 切り替えも `killView.killed` から都度導出される controlled 実装で、独自のローカル state を持ち込んでいない。

写経の忠実性は高く、既存様式からの逸脱は確認できなかった。

### 裁量判断への評価

**(a) `snapshot.killed` を常に boolean 固定（`selfFire`/`verbosity` の null 許容と非対称）にした判断 — 妥当**

`selfFire`/`verbosity` の null は「scheduler 未生成（= orchestrator 未注入で機能自体が存在しない）」を表す設計であるのに対し、`killed` はサーバ自身が持つ boolean 正本であり、orchestrator の有無に関わらず「今キル状態かどうか」という問いに常に答えられる（デフォルト false）。POST /api/kill 自体は orchestrator 未注入なら 503 になるため、「正本は追える・実際に効かせる操作だけ不可」という状態を正直に表現できている。wave 計画・棚卸し文書のいずれも null 許容/非許容を指定していないため、この裁量は設計文書と矛盾しない。

**(b) KillSwitch を 1 ボタン controlled + 明示 boolean 送信にした判断 — 妥当（「明示指定・トグル禁止」要件は実質的に満たしている）**

要件の出所（棚卸し §1-2 裁定 7「ホットキーは殺す専用（トグルにしない）」・wave 計画 §2「エンドポイントは `{killed:true|false}` の明示指定（トグル禁止）」）を精査すると、この制約は主に **サーバ API 契約レベル**（「現在の状態を反転させて」という曖昧なトグル操作をエンドポイントが受け付けないこと）と **ホットキーの片方向性**（`^!k` は kill 専用で revive を送らない）を指しており、操縦席 UI のボタンを DOM 要素として 2 つに分けることまでは要求していない。

実装を検証すると:
- サーバ側（`cockpit-server.mjs:948`）は受け取った `body.killed` の boolean をそのまま代入するのみで、反転ロジック・前状態参照は一切持たない。「トグル禁止」は API 実装として厳格に満たされている。
- UI 側の `onClickKill` はクリック時点で `killView.killed` の逆を **明示的に計算**し、その結果を `{killed: <boolean>}` として POST する。UI 内部の反転計算はユーザーの意図（今見えているボタンの逆の状態にしたい）を明示 boolean へ変換するものであり、サーバへは常に確定値が渡る。
- ホットキー（`^!k`）は revive を送るコードパスを持たず、片方向性は別途確保されている（誤操作で復帰してしまう事故はホットキー側では起こらない）。UI ボタンの反転は、操縦席を注視している文脈（ラベルが「■ KILL」⇔「◆ 復帰」で明確に切り替わる）でのみ発生するため、裁定 7 が懸念する「ゲーム画面注視中の誤操作」とは異なる操作文脈にある。

既存 `selfFireToggleView`/`VerbositySelect` の「1 部品が view で切り替わる controlled component」という様式との統一を優先した判断は、一貫性の観点からも妥当と評価する。2 ボタン分離案を採らなかったことによる実害（誤操作リスクの増加等）も見出せなかった。

### 質問

1. **kill() 戻り値の不使用について**: Domain A の申し送り（`domain-a-design.md`）は「POST /api/kill のレスポンスとして `kill()` 自身の戻り値（`{killed, severed, elapsedMs, charsSpoken, prefix}`）を使う設計であれば問題にならない（推奨）」としていたが、実装は `snapshot()` のみを返し `kill()` の戻り値（`severed`/`elapsedMs`/`charsSpoken`/`prefix`）は使われず破棄されている。wave 計画 §4-4 の基準文言「レスポンス正本が snapshot（+ 必要なら kill() 戻り値）のみ」は "+ 必要なら" が任意扱いのため、これ自体は blocking 要件の不備ではないと判断した。むしろ `fire()` の戻り値との混同リスクを完全に断っており、より安全側の実装と評価できる。ただし将来 UI で「何文字喋ったところで切ったか」等の詳細情報を見せたい場合は、別途 `kill()` 戻り値の活用を検討する必要がある旨、念のため申し送る。
2. 上記以外に判断に迷う不足情報・design 適合上の懸念点はなし。spec 適合レーン（`domain-b-spec.md`）の結論（8 項目全て ✓・裁量判断 2 件とも blocking ではない）とも独立に一致している。
