# S6 追撃 Domain E: 自発発火に画像同乗（会話が続く・視覚優先モード / 盲目劣化 / 再ゲート手順）

> Status: 実装完了・機械ゲート緑（518/518・SDK 消費ゼロ・全 fake 無音）。人間ゲート（実マイク・実器・
> 実キャプチャでの画面言及）は [human-gate-procedure.md](human-gate-procedure.md) §9-1 に再ゲート手順を
> 用意済みだが**実行はユーザー**（未実施）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝
> lockfile 不変）+ `discussion/**`（docs 追記 2 件）。
> 出典（人間ゲート後のユーザー裁定・2026-07-13）: ①区切り応答/呼びかけの自発発火を「視覚対象が設定済みなら
> 画像付き発火（S5 視覚経路）に格上げ・未設定なら従来の画像なし発火」。②自発発火のキャプチャ失敗は「発火
> 中止ではなく画像なしの通常発火に静かに劣化」（誰もボタンを押していない自発発火は盲目でも嘘にならない・
> ゴースト行で痕跡は残す）。③トークン増は usage 計器で見張る前提で受容（実装作業なし・記録のみ）。
> 消費した Domain 成果物: [domain-b.md](domain-b.md)（`fire-orchestrator` の視覚発火経路・processAskedReply・
> usage 計器）・[domain-c.md](domain-c.md)（`createFireScheduler` の kind 出し分け）・
> [domain-d.md](domain-d.md)（cockpit-server `onFireRequest` の SSE `selfFire` 結線）。

## 0. パイプライン（裁定 3 点と実装の対応）

```
裁定①格上げ + 裁定②盲目劣化（call/turn-end のみ・silence/手動系は不変）:

  fireScheduler.onFireRequest({kind})            ← Domain C（不変・スケジューラは要求を出すだけ）
    │
    ├─ kind === "silence" ──→ fireOrchestrator.fire({ vision: true })     ← 従来のまま（1 ビット不変）
    │                          （対象未設定/キャプチャ失敗で中止＝「見えなければ中止」）
    │
    └─ kind === "call" | "turn-end" ─→ fireOrchestrator.fire({ vision: "preferred" })  ← S6 追撃で新設
                                        │
       fire-orchestrator.firePreferred(buffer):
         getVisionTarget()
           ├─ null/空/throw ──────────→ fireNormalCore(alreadyAccepted:false)   画像なし通常発火（中止しない）
           └─ title あり:
                setState(thinking) + onFire{accepted:true, vision:true}
                captureImpl(title)
                  ├─ {error} ─→ onDiagnostic{type:"fireVisionDegraded", kind, message}（ゴースト行）
                  │             fireNormalCore(alreadyAccepted:true)          画像なし通常発火へ静かに劣化
                  └─ 成功 ────→ askWithVision(buffer, captured, title)         画像付き発火（S5 と完全共通）

  手動 Fire = fire()・手動視覚 Fire = fire({vision:true}) は scheduler 非経由ゆえ**一切無関係**（不変）。

裁定③トークン増: usage 計器（onUsage {usage, vision}）は既存のまま。劣化/未設定は画像なし ask ゆえ
  vision:false（正直）で通知される＝画像付き（vision:true）と区別して見張れる。実装作業なし・本 §で記録のみ。
```

## 1. 実装/変更ファイル一覧（すべて `apps/soul/agent/` と `discussion/`・scope 内）

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/mind/fire-orchestrator.mjs` | 変更（+162 -56） | 視覚優先モード `fire({ vision: "preferred" })` を新設。既存の `fireVision` 成功時のインライン ask を `askWithVision(buffer, captured, title)` へ抽出（手動視覚 Fire と preferred 成功時が共有）。既存の通常 Fire のインライン ask を `fireNormalCore(buffer, {alreadyAccepted})` へ抽出（手動 Fire と preferred の劣化/未設定フォールバックが共有）。`firePreferred(buffer)` を新設（対象未設定→通常 Fire・キャプチャ失敗→`fireVisionDegraded` 診断+通常 Fire へ劣化・成功→視覚 ask）。`fire()` の振り分けに `visionMode === "preferred"` 分岐を追加。**通常 `fire()`・手動視覚 `fire({vision:true})` の外形・挙動・戻り値・診断は 1 ビット不変**（抽出しただけ）。 |
| `src/mind/fire-orchestrator.test.mjs` | 変更（+261 -0） | 視覚優先モードの縦検証 11 本を追加（§4）。既存 39 本は**期待値変更ゼロ**（無退行）。39 → 50（+11・レビュー test レーンの実測で確定・Orch 訂正済み） |
| `src/cockpit/cockpit-server.mjs` | 変更（+9 -3） | `onFireRequest` の出し分けを更新: `silence` → `fire({vision:true})`（従来）・`call`/`turn-end` → `fire({vision:"preferred"})`（新）。SSE `selfFire`（`{kind,fired,reason}`）契約は不変（additive なし）。コメントを裁定内容へ更新。 |
| `src/cockpit/cockpit-server.test.mjs` | 変更（+3 -2） | 既存の「呼びかけ命中で fire を呼ぶ」テストの 1 アサーションを `lastFireOptions === undefined` → `deepEqual({vision:"preferred"})` へ更新（call 格上げの結線を固定・理由は §5）。新規テスト追加なし（call 経路が preferred へ変わったことを既存テストで固定）。 |
| `discussion/ai-cohost/implementation/waves/s6/s6-followup.md` | 変更（+20 -0） | §12「口数（反応確率）の Cockpit 可変化」をユーザー裁定の記録として追記（§6）。 |
| `discussion/ai-cohost/implementation/waves/s6/human-gate-procedure.md` | 変更（+17 -0） | §9-1「再ゲート（自発発火に画像同乗）の一点確認」を追記（§6）。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§7 の `git diff --stat` で確認・新規依存ゼロ）。`.tmp/facex-*`（別セッション領分）・
`fire-scheduler.mjs`（Domain C）・`barge-in.mjs`（Domain B）・`src/voice/**`・`src/eyes/**`・cockpit.html・
cockpit.mjs・settings-store は一切改修していない（import して使う／既存契約を消費するだけ）。

## 2. 発火経路の新契約（格上げ・劣化・診断型・vision フラグ / usage 計器の扱い）

### 2-1. `fire({ vision: "preferred" })`（新設・第三のモード）

`fireOptions.vision` の値で 3 モードに分岐する（`vision === true`／`=== "preferred"`／それ以外=通常）:

| モード | 呼び出し元 | 対象未設定 | キャプチャ失敗 | 成功 |
|---|---|---|---|---|
| `fire()`（省略） | 手動 Fire | — | — | 画像なし通常発火 |
| `fire({vision:true})` | 手動視覚 Fire・自発 silence | **中止** `vision-no-target` | **中止** `vision-capture-failed` | 画像付き発火 |
| `fire({vision:"preferred"})` | 自発 call・turn-end | **画像なし通常発火**（中止しない） | **画像なし通常発火へ劣化**（中止しない）+ 診断 | 画像付き発火 |

- **`vision:true`（silence/手動視覚）の「見えなければ中止」は 1 ビットも変えていない**（裁定の明示要求）。
  対象未設定 → `onFire{accepted:false, reason:"vision-no-target", vision:true}` + `fireVisionError{kind:"no-target"}`、
  キャプチャ失敗 → `fireVisionError{kind, message}` + `{fired:false, reason:"vision-capture-failed", kind}`。
- **`vision:"preferred"` は中止しない**（誰もボタンを押していない自発発火＝盲目でも嘘にならない・裁定 2）:
  - 対象未設定（getVisionTarget が null/空/throw）→ `fireNormalCore(alreadyAccepted:false)` で**新規受理経路の
    通常 Fire**（空窓ガード・`onFire{accepted:true, injectedChars, includedCount, atMs}` も通常どおり）。
  - キャプチャ失敗（captureImpl → `{error}`）→ 先に `setState(thinking)` + `onFire{accepted:true, vision:true}` を
    出した後で `fireVisionDegraded` 診断 → `fireNormalCore(alreadyAccepted:true)` で**画像なし ask へ劣化**
    （accept を再 emit しない＝二重受理を避ける・空窓なら `{fired:false, reason:"empty-window"}` を返すだけ）。
  - 成功 → `askWithVision`（手動視覚 Fire と完全共通・画像先行 content・onVisionCaptured 発火）。

### 2-2. 診断型 `fireVisionDegraded`（新設・ゴースト行の痕跡）

```
{ type: "fireVisionDegraded", kind: <captureErrorKind>, message: <captureErrorMessage> }
```

- **既存の cockpit `handleDiagnostic` の SSE broadcast（`kind`/`message` を運ぶ）にそのまま乗る**（`fireVisionError`
  の `kind` と同じ「新規イベント種別を増やさず既存 diagnostic に相乗り」の作法・cockpit-server は 1 行も追加
  不要）。cockpit.html はこれを既存のゴースト行の型で描く（発火要求は出たが画像なしに劣化した痕跡）。
- `captureErrorKind` を別フィールドにせず `kind` へ載せた（既存 broadcast の `kind` フィールドで足りるため・
  additive 汚染を避ける。§8 質問 1）。

### 2-3. vision フラグ / usage 計器の扱い（裁定③との対応・設計判断）

- **劣化発火・対象未設定発火は実際には画像なし ask** ゆえ、`processAskedReply(buffer, asked, /*vision=*/false, ...)`
  を通し、`onUsage{usage, vision:false}`・戻り値に `vision` フィールドなし。**「見ていないのに vision:true と言わ
  ない」＝正直**（見えたと嘘をつくと usage 計器の信頼が崩れる）。`onVisionCaptured` も発火しない。
- **成功発火だけ `vision:true`**（`onUsage{usage, vision:true}`・戻り値 `vision:true`・onVisionCaptured 発火）＝
  手動視覚 Fire と完全に同じ。
- これにより裁定③「トークン増を usage 計器で見張る」が成立する: 画像付き（vision:true・cache/画像で重い）と
  画像なし（vision:false・素の input_tokens）を計器上で区別できる。実装作業は不要（既存計器がそのまま機能）。

### 2-4. SSE `selfFire` 契約（Domain D・不変）

`onFireRequest` の結果を待って `broadcast("selfFire", {kind, fired, reason})` する Domain D の契約は不変
（additive フィールド追加なし）。preferred の結果（成功=fired:true・劣化/未設定でも通常発火が成れば fired:true・
空窓等なら fired:false + reason）がそのまま `selfFire` に乗る。kind は従来どおり `call`/`turn-end`/`silence`。

## 3. 実装の内部構造（抽出でどう無退行を担保したか）

視覚優先モードは**既存の ask 本体を 2 つのコア関数へ抽出して再利用**することで実装した（新しい ask 経路を
書き足していない＝無退行の構造的担保）:

- `askWithVision(buffer, captured, title)`: S5 の視覚発火成功時のインライン実装をそのまま切り出したもの
  （onVisionCaptured → 画像先行 content → `session.ask` → `processAskedReply(vision:true)`）。**呼び出し元が
  thinking/accept/失敗の握り（fireError）/finally idle を持つ**前提。`fireVision`（手動視覚・silence）と
  `firePreferred` の成功時が共有。
- `fireNormalCore(buffer, {alreadyAccepted})`: 通常 Fire のインライン実装をそのまま切り出したもの（空窓ガード
  → `session.ask(text)` → `processAskedReply(vision:false)` → catch fireError → finally idle）。`alreadyAccepted`
  で「新規受理（手動 Fire・preferred 対象未設定）」と「既に thinking+accept 済みの劣化フォールバック」を
  出し分ける（後者は accept を再 emit しない）。`fire()` の通常経路と `firePreferred` のフォールバックが共有。

`fire()` の振り分けは `visionMode === true` → `fireVision`・`=== "preferred"` → `firePreferred`・それ以外 →
`fireNormalCore(alreadyAccepted:false)` の 3 分岐。**busy 判定・耳未起動判定は 3 モードで共有**（fire() 冒頭で
一度だけ）。

## 4. 無退行の固定内容（silence / 手動系が 1 ビットも変わっていないことをどうテストで固定したか）

### 4-1. 追加した視覚優先モードのテスト（`fire-orchestrator.test.mjs`・全 fake・+11 本）

| # | 分岐 | 固定内容 |
|---|---|---|
| 1 | 対象あり+キャプチャ成功 | 画像先行 content で ask・`result.vision:true`・onVisionCaptured 発火・`onUsage{vision:true}`（手動視覚と同経路） |
| 2 | 対象未設定（getVisionTarget→null） | **中止せず**画像なしの文字列 ask で発火成立・`result.vision:undefined`・キャプチャ非呼出・onVisionCaptured 非発火・`onUsage{vision:false}`・`fireVisionError` 診断なし |
| 3 | getVisionTarget 未注入（既定） | 同上（通常発火へ劣化・文字列 ask） |
| 4–7 | キャプチャ失敗 4 種（notFound/minimized/failed/timeout） | **中止せず**画像なし文字列 ask で発火成立・`fireVisionDegraded{kind,message}` 診断が出る・`fireVisionError` 中止診断は出ない・onVisionCaptured 非発火・`onUsage{vision:false}` |
| 8 | 劣化フォールバックの受理 | `onFire` の `accepted:true` は **1 回だけ**（vision:true の受理・劣化後の通常 ask は accept を再 emit しない） |
| 9 | 対象未設定+空窓 | 通常 Fire と同じ `empty-window` で中止・ask 非呼出・`onFire{accepted:false, reason:"empty-window"}`（フォールバックが空窓ガードを通る） |
| 10 | busy 中 | 無視され `reason:"busy"`・キャプチャすら呼ばれない（通常 Fire と共有の判定） |
| 11 | 耳未起動 | `ears-not-running`（通常 Fire と共有） |

### 4-2. silence / 手動系の無退行（既存テストの期待値変更ゼロ）

- **手動視覚 Fire・silence（`fire({vision:true})`）**: 既存の S5 視覚発火テスト群（成功・キャプチャ失敗 4 種は
  `vision-capture-failed` 中止・対象未設定は `vision-no-target` 中止・getVisionTarget throw・busy・耳未起動・
  dispose）は**期待値を 1 文字も変えずに全通過**。`askWithVision` 抽出後も成功時の content 構造・onVisionCaptured・
  usage・soul 追記が同一であることを既存テストが固定している。
- **手動 Fire（`fire()`）**: 既存の通常 Fire テスト群（thinking→speaking→idle・soul 記録・busy・空窓・耳未起動・
  空応答・ask/speak throw・usage・表情演出・barge-in）も**期待値変更ゼロで全通過**。`fireNormalCore(alreadyAccepted:
  false)` 抽出後も空窓ガード・onFire・診断・戻り値が同一。
- **cockpit `onFireRequest` の silence 分岐**: `fire({vision:true})` のまま（コード上も従来の三項の then 節を保持）。
  `POST /api/vision-fire` の既存テスト（fire({vision:true}) を呼ぶ・受理 202・対象未設定 200）が `vision:true` 経路の
  健全性を固定している。
- **機械ゲート全体**: 518/518 pass（ベースライン 507 → +11・§8）。既存 507 本のうち期待値を変更したのは
  cockpit-server.test.mjs の **1 アサーションのみ**（call 格上げ・§5）。それ以外はゼロ。

## 5. cockpit-server.test.mjs で 1 アサーションを変更した理由（期待値変更の明記）

既存テスト「cockpit self-fire: 呼びかけ命中の you 転写が fireOrchestrator.fire() を呼ぶ」は、Domain C/D 時点で
call が**通常 Fire（`fire()` 引数なし）**で発火することを `assert.equal(lastFireOptions, undefined)` で固定していた。
本追撃の裁定①で **call を視覚優先（`fire({vision:"preferred"})`）へ格上げ**したため、このアサーションを
`assert.deepEqual(lastFireOptions, { vision: "preferred" })` へ更新した（コメントも Domain E 裁定へ更新）。
**これは裁定に基づく意図的な結線変更であり、退行ではない**。同ファイルの他アサーション（fireCount 等）・
SSE selfFire テスト（kind=call・fired・reason を見る）は fire オプションを見ないため変更不要で全通過。

## 6. docs 追記 2 件（場所と内容）

1. **[s6-followup.md](s6-followup.md) §12「口数（反応確率）の Cockpit 可変化」**（ユーザー裁定の記録・+20 行）:
   配信中に Cockpit から切替できるべき（CLI 不可）／UI は生スライダーでなくモード切替（`控えめ/ふつう/おしゃべり`）
   ／会話メイン時はおしゃべり側・ゲーム集中時は現行程度／実装時期は今後の課題。既存の自発 OFF トグル
   （`POST /api/self-fire`）の隣に増設するイメージ（薄い継ぎ目 + settings 永続化 + scheduler へ定数束）まで刻んだ。
2. **[human-gate-procedure.md](human-gate-procedure.md) §9-1「再ゲート（自発発火に画像同乗）の一点確認」**（+17 行）:
   放置 45〜75 秒 → 沈黙発火が画面に言及（④の確認を兼ねる）＋区切り応答/呼びかけの返事も対象設定済みなら
   画面に触れることがある（格上げ）／キャプチャ失敗でも自発発火は止まらず画像なしの普通の返事になる（盲目
   劣化・ゴースト行 `fireVisionDegraded`）／手動系・silence は不変、という一点確認。

## 7. 器不変・依存ゼロ・チェック無退行の確認

```
git diff --stat -- apps/runtime-player packages                              → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json               → 出力なし（lockfile・依存不変）
git diff --stat -- apps/runtime-player/src/main/control-channel/contract     → 出力なし（契約 JSON 不変）

本 Domain の変更ファイル（git diff --numstat・追加/削除）:
   apps/soul/agent/src/mind/fire-orchestrator.mjs        +162 -56
   apps/soul/agent/src/mind/fire-orchestrator.test.mjs   +261  -0
   apps/soul/agent/src/cockpit/cockpit-server.mjs          +9  -3
   apps/soul/agent/src/cockpit/cockpit-server.test.mjs     +3  -2
   discussion/.../s6/s6-followup.md                       +20  -0
   discussion/.../s6/human-gate-procedure.md              +17  -0
```

- `fire-scheduler.mjs`（Domain C）・`barge-in.mjs`/`fire-orchestrator` の barge-in 部（Domain B）・`src/voice/**`/
  `src/eyes/**`（Domain A/S5）・cockpit.html/cockpit.mjs/settings-store（Domain D）は**1 バイトも触れていない**
  （読んで契約を消費・import して使うだけ）。fire-orchestrator.mjs の変更は視覚優先モードの追加と ask コアの
  抽出のみ（barge-in/interrupt/processAskedReply の本体は不変）。
- `.tmp/facex-*`（別セッション領分）は一切触っていない。
- **SDK 実消費ゼロ**: `observe-conversation.mjs` を実行せず・ask を 1 回も撃たず。機械ゲートは全 fake・無音
  （fake session/capture/speak/channel/player）。実マイク・実 PowerShell・実 TTS・実 SDK はいずれも `node --test`
  の実行経路で呼んでいない。

## 8. §質問（Orch / レビューへの申し送り・迷った裁定点）

1. **劣化診断の型名を `fireVisionDegraded`・フィールドは `{kind, message}` にした**（`captureErrorKind` を別立て
   せず既存 broadcast の `kind` へ載せた）。既存 cockpit `handleDiagnostic` に 1 行も足さずゴースト行の材料が
   運べる（`fireVisionError` の `kind` と同じ相乗り作法）。cockpit.html 側でこの新 type に専用の見た目
   （「画像なしに劣化」を明示する文言）を付けるかは Domain D 領分の UI 判断として申し送る（現状は既存の汎用
   ゴースト行として描かれる）。この型名/粒度でよいかレビューで確認してほしい。
2. **劣化/対象未設定の vision フラグを false（正直）にした**（§2-3）。「見ていないのに vision:true と言わない」
   ことで usage 計器の意味を保った。代替案（preferred 由来を示す別フラグ `degraded:true` を戻り値/usage に足す）
   も考えたが、additive を最小化して既存契約（vision:boolean）に収めた。preferred 由来の発火を計器で識別したく
   なったら `selfFire` イベントの kind（call/turn-end）で辿れる（自発発火であることは kind で分かる）。
3. **preferred の劣化フォールバックは、キャプチャ失敗時点で既に `onFire{accepted:true, vision:true}` を出して
   いる**（thinking 遷移とセット）。その後の通常 ask では accept を再 emit しない（二重受理を避ける）。結果、
   操縦席には「vision:true で受理 → でも fireVisionDegraded で画像なしに落ちた」という履歴が残る。これは正直な
   痕跡だが、受理時に vision:true と見せて実際は画像なし、という一瞬の齟齬がある。UI で紛らわしければ、受理
   emit をキャプチャ成否確定後に遅らせる設計もありうる（現状はキャプチャ前に thinking を見せたい＝反応の即時性を
   優先）。レビューで体感の妥当性を確認してほしい。
4. **cockpit-server の onFireRequest 出し分けを timer 依存の silence/turn-end まで結線層テストで固定していない**
   （Domain D と同じ制約: cockpit-server はスケジューラを内部生成し timer 注入口が無いため、call のみ即時に
   結線テストできる）。call → preferred は cockpit-server.test.mjs で固定・turn-end は同じ非 silence 分岐ゆえ
   同一コードパス・silence → vision:true は不変コード + `/api/vision-fire` 既存テストで健全性を担保、という
   構成にした（orchestrator 層で preferred/vision の全分岐を fake で固定済み）。この分業でカバレッジ十分か
   レビューで確認してほしい。

## 9. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 518
# pass  518
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

**S6 Domain D 後ベースライン 507 → 518（+11）**。内訳:
- `src/mind/fire-orchestrator.test.mjs`: 39 → 50（**+11**。当初「40→51」と誤記していたが、レビュー test レーンが
  HEAD 版ベースライン展開で 39 本・変更後 50 本を実測し、Orch-Sylph も個別実行で 50 本を確認して訂正）。
  視覚優先モード（`fire({vision:"preferred"})`）の
  縦検証 11 本（§4-1）: 成功格上げ 1・対象未設定 2（null / 未注入）・キャプチャ失敗劣化 4（notFound/minimized/
  failed/timeout）・劣化の単一受理 1・対象未設定+空窓 1・busy 1・耳未起動 1。
- `src/cockpit/cockpit-server.test.mjs`: 60 → 60（**±0**）。既存「呼びかけ命中で fire を呼ぶ」テストの 1
  アサーションを call 格上げ（preferred）へ更新しただけ（§5・新規テストなし）。
- 他ファイル（fire-scheduler・barge-in・audio-player・speak・cli・settings-store・cockpit 等の既存テスト）は
  **期待値変更ゼロで全通過**（本 Domain は視覚優先モードの追加と結線の出し分けのみを触った）。

実行後、`node --test` を再実行し 518/518 の無退行を確認した。実 SDK 消費は 0（`observe-conversation.mjs` 非実行・
ask ゼロ）。
