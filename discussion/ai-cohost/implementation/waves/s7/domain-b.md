# S7 Domain B: 合流 + 発火結線（視聴者コメントが単一タイムラインに混ざる・mind）

> Status: 実装完了・機械ゲート緑（2026-07-14）。実疎通（テスト配信でコメントを投げてこーでぃーが拾って返す）は
> 人間ゲートに持ち越し（wave-plan §1・§5）——**機械テストは実ネットワーク・実チャット器官・実 SDK に一切出て
> いない（全 fake・SDK 実消費ゼロ）**。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §2・§3 Domain B・§4 /
> [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md) §1 裁定 3/4/5・§3・§3-1 /
> 消費した Domain A 成果物: [domain-a.md](domain-a.md)（`onMessage(msg)` が渡す `{ text, displayName, kind, ... }`）。

## 0. パイプライン（この Domain が敷いた線・全 fake で縦検証済み）

```
YouTube Live コメント（Domain A のチャット器官 src/chat/・独立）
  │  client.onMessage(msg)  msg = { text, displayName, kind:"text"|"paid", messageId?, ... }
  │       ↑ Domain C が実器官を生成し onMessage/onStatus/onDiagnostic をこの取り込み経路へ繋ぐ
  │         （器官の外から hooks 経由・逆方向 import は作らない・器官は魂の他部位を知らない）
  ▼
cockpit-server.ingestChatMessage({ text, displayName })   ← S7 の attach 点（プラミング）
  │  ① append: transcriptBuffer.append({ startMs:0, endMs:0, text, speaker:"viewer", displayName })
  │        └─ 単一タイムライン（inventory §1 裁定 3「箱を分けない」）・soul 先例踏襲（0,0・窓は appendedAtMs）
  │        └─ buffer.onAppend → 耳の onTranscript(viewer) を必ず通る
  │              ★ handleTranscript(viewer) は no-op（you 経路の call 照合/armSilence を誤起動しない）
  │              ★ onTranscript の放送側は viewer を除外（二重放送しない）
  │  ② 放送: SSE "transcript"（speaker:"viewer" + displayName）を 1 本だけ（Domain C が `viewer(名前):` を描く）
  │  ③ 判定: fireScheduler.handleChatMessage({ text, displayName })
  │        ├─ comment-call（テキスト用揺れ集合に命中）── 確実に発火要求（不応期/確率/予算を掛けない）
  │        └─ comment（呼びかけ無し）──── 予算 → 不応期 → 確率 を満たしたときだけ発火要求
  ▼
onFireRequest({ kind:"comment"|"comment-call" })
  │  振り分け（既存の三項・silence 以外＝else 枝）
  ▼
fireOrchestrator.fire({ vision:"preferred" })   ← call/turn-end と同じ視覚優先（対象あれば画像付き・無/失敗は通常発火へ静かに劣化）
  └─ 会話ログ（buffer.all()）を読む → 注入整形（fire-injection）が viewer 行を `viewer(名前): 本文` で描く
  └─ selfFire SSE に kind:"comment"|"comment-call" が載る（Domain C の自発発火マーカー材料）

  取得死/状態: client.onStatus → broadcastChatStatus（SSE "chatStatus"）/ client.onDiagnostic →
               broadcastChatDiagnostic（SSE "chatDiagnostic"）＝状態表示・ゴースト行の材料は Domain C が描く。
```

- **核心（comment/comment-call 判定・不応期・確率・予算・二重発火の断ち）は純ロジック側（fire-scheduler.mjs）**で
  fake clock + 注入 RNG により全分岐を決定論テスト。cockpit-server の結線は「onMessage を append + 放送 + scheduler
  へ回す」薄い additive 層（comment-call の縦串だけ結線テストで固定・comment は確率依存ゆえ純ロジック側）。
- **依存ゼロの維持**: fire-scheduler.mjs は import 文ゼロのまま（「いつ喋るか」判定に LLM/SDK が構造的に混入しえない・
  既存の import-zero 構造テストが緑）。合流は Domain A 器官の**外から** hooks 経由——逆方向 import を作っていない。

## 1. 実装/変更ファイル一覧（すべて `apps/soul/agent/`・scope 内・file:line）

| ファイル | 種別 | 役割・主な変更点（file:line） |
|---|---|---|
| `src/ears/transcript-buffer.mjs` | 変更 | 話者に `"viewer"` を追加（`VALID_SPEAKERS` :78）。エントリ形に `displayName` フィールド追加（:167・frozen）。`append` 入力に任意 `displayName`（string）を受け軽く型検証（:132-137）。**既定 "you"・displayName 省略時は従来と同形＝S1〜S6 不変**。`Speaker` 型を三値へ・`TranscriptEntry` typedef に displayName。 |
| `src/ears/transcript-buffer.test.mjs` | 変更 | viewer 合流 + displayName の 3 本追加（14→17）。 |
| `src/mind/fire-injection.mjs` | 変更 | `labelOf` を三値へ（soul/viewer/you・:37）。viewer 行を `viewer(名前): 本文`（displayName 欠落/空白は `viewer: 本文` へ劣化）に整形する `formatLine`（:51）を新設し行整形を差し替え（:106）。窓/上限ロジックは不変（viewer 行に自然に効く）。 |
| `src/mind/fire-injection.test.mjs` | 変更 | viewer(名前) 描画 + 劣化の 2 本追加（8→10）。 |
| `src/mind/fire-scheduler.mjs` | 変更 | 新設 `handleChatMessage({text,displayName})`（:437）＝comment-call（命中即発火）→ comment（予算/不応期/確率）。v0 定数 `COMMENT_REFRACTORY_MS`/`COMMENT_PROBABILITY`/`COMMENT_BUDGET_V0`/`NAME_VARIANTS_TEXT_V0` を export（:105-141）。`handleTranscript` に **viewer no-op 分岐**（:410 ★二重発火の断ち）。`FireRequest` kind union に comment/comment-call（:237）。`commentBudgetRemaining()` 追加。**依存ゼロ維持**。 |
| `src/mind/fire-scheduler.test.mjs` | 変更 | comment/comment-call 全分岐 + テキスト揺れ集合 + ★viewer no-op の 10 本追加（22→32）。 |
| `src/cockpit/cockpit-server.mjs` | 変更（結線・薄い） | `ingestChatMessage`（:1028・append+放送+scheduler の attach 点）・`broadcastChatStatus`（:1067）・`broadcastChatDiagnostic`（:1078）を新設し返り値に公開（:1124-）。`toWireEntry` に displayName（:413）。耳の onTranscript 放送側で **viewer を soul と並んで除外**（:573 ★二重放送の断ち）。振り分けは既存三項が comment/comment-call を silence 以外＝`fire({vision:"preferred"})` へ自然に流す（:981・コメント明記）。 |
| `src/cockpit/cockpit-server.test.mjs` | 変更 | S7 チャット取り込み縦串 5 本追加（60→65）。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§6 の `git diff --stat` で確認・新規依存ゼロ・素の fetch/Node 組み込みのみ）。Domain A の成果物
`src/chat/**` は 1 バイトも触っていない（`onMessage` が渡す形を読んで消費しただけ）。`.tmp/facex-*`（別セッション
領分）は一切触っていない・読んでいない。

## 2. 純部品/フックの契約（引数・戻り値・失敗の扱い）

### 2-1. `transcriptBuffer.append({ startMs, endMs, text, speaker?, displayName? })`

- `speaker`（`"you" | "soul" | "viewer"`・既定 "you"）と `displayName`（string・**viewer のときだけ意味を持つ**）を
  受ける。displayName は you/soul では undefined（省略）＝**エントリ形・既存挙動は不変**。
- 検証: speaker が閉集合外なら `RangeError`、displayName が非文字列（present 時）なら `TypeError`（呼び出し側の
  バグを黙殺しない）。空/空白テキストは従来どおり discard（viewer コメントも同じ扱い）。
- viewer エントリも frozen（正本の append-only・不変性を維持）。時刻は soul 同型 `startMs/endMs=0`・窓は appendedAtMs。

### 2-2. `formatFireInjection(entries, { nowMs, windowMs?, maxChars? })`（純関数）

- viewer エントリを `viewer(displayName): 本文` で描く（`formatLine`）。displayName が非文字列/空白なら `viewer: 本文`
  へ劣化（名前括弧を付けない）。you/soul は従来どおり `you:` / `soul:`。窓（appendedAtMs）・文字数上限（古い方落とし・
  最新 1 行温存）は viewer 行にもそのまま効く（`{text,speaker?,displayName?,appendedAtMs}` しか見ない純関数）。

### 2-3. `fireScheduler.handleChatMessage({ text, displayName })`（新設・handleTranscript 同型）

```
handleChatMessage(msg) => void   // 発火要求は onFireRequest({ kind:"comment"|"comment-call" }) で通知
```
- **comment-call**: `text` がテキスト用揺れ集合（`NAME_VARIANTS_TEXT_V0`）に命中したら**確実に**発火要求
  （不応期・確率・予算を掛けない・裁定 5）。既存純関数 `normalizeForMatch`/`textMatchesName` を再利用（音声照合と
  同じ正規化＝NFKC/かな→カナ/濁点剥がし）。busy/OFF は沈黙。命中即 `lastFireAtMs=now` + `emitFire("comment-call")`。
- **comment**（呼びかけ無し）: **予算**（`commentBudget>0`）→ **不応期**（`now-lastFireAtMs≥commentRefractoryMs`）→
  **確率**（`rng()<commentProbability`）を全部満たしたときだけ発火要求（区切り応答の写経）。満たせば予算 −1・
  `lastFireAtMs=now`・`emitFire("comment")`。busy/OFF/空文字は沈黙。
- **活動扱いの裁定**（§8 も参照）: コメントは「場が動いた」活動なので `armSilence()` で沈黙タイマを再武装する
  （活発なチャットは「画面を見て一言」を先送りする）が、**魂の発話ではない**ので不応期の基点 `lastFireAtMs` は
  **実際に発火要求を出したときだけ**更新する（コメント到着そのものでは更新しない）。`displayName` は照合に使わない
  （合流描画・下流用に受けるだけ）。

### 2-4. cockpit-server の attach 点（Domain C が繋ぐプラミング）

```
server.ingestChatMessage({ text, displayName })  // 1 コメントを取り込む（best-effort・throw は診断に落とす）
server.broadcastChatStatus(status)               // SSE "chatStatus" { status }（connecting/live/retrying/dead 表示材料）
server.broadcastChatDiagnostic(info)             // SSE "chatDiagnostic" { kind, message, atMs, delayMs, attempt }（ゴースト行材料）
```
- `ingestChatMessage`: (a) `pipeline?.transcriptBuffer` へ viewer append → (b) SSE "transcript"（viewer 行）を 1 本
  放送 → (c) `fireScheduler.handleChatMessage` を回す。**空/空白テキストは捨てる**（バッファも捨てるので二度手間を
  避ける）。**バッファ無し（耳未起動）は合流先が無いので append/scheduler をスキップし `chatBufferAbsent` 診断だけ
  出す**（§5・§8 の裁定）。Domain C は `client.onMessage → ingestChatMessage`・`onStatus → broadcastChatStatus`・
  `onDiagnostic → broadcastChatDiagnostic` を繋ぐ（クライアント生成・Connect/停止ライフサイクルは Domain C の領分）。

## 3. ★ 二重発火 / 二重放送を断った実装と根拠（接ぎ目の事実）

現行 cockpit-server の耳 `onTranscript`（:566-573）は buffer の `onAppend` 経由で **you も soul も必ず通り**
`fireScheduler.handleTranscript(entry)` を回す（:566）。viewer コメントを**同じ buffer に append すると**この
onTranscript→handleTranscript(viewer) が発火し、放置すれば:
1. handleTranscript の **you 経路**（armSilence + 音声 needle の呼びかけ照合）を誤起動し、`comment-call` と重ねて
   `call` が出る＝**二重発火・誤爆**。
2. onTranscript の放送が viewer 行を流し、ingestChatMessage の放送と重なる＝**二重放送**。

**断ち方（2 箇所）**:
- **発火**: `handleTranscript` に **viewer を完全 no-op で抜ける分岐**を追加（fire-scheduler.mjs :410・soul 分岐の隣）。
  viewer コメントの発火・活動反映は `handleChatMessage` だけが担う（you 経路の call 照合/armSilence を viewer で
  起こさせない）。scheduler へは soul の不応期基点更新のため you/soul 両方を要るので `handleTranscript` 呼び出し自体は
  残し、**viewer だけ内部で無視**する（cockpit の onTranscript は変えずに根を断つ）。
- **放送**: 耳の onTranscript 放送側で **viewer を soul と並んで除外**（cockpit-server.mjs :573
  `speaker==="soul" || speaker==="viewer"` で return）。viewer 行の唯一の放送元は ingestChatMessage。

**テストで固定**:
- fire-scheduler.test.mjs「★ 二重発火の断ち: handleTranscript(viewer) は no-op」——名前を含む viewer 転写を
  `handleTranscript` に食わせても発火せず、沈黙タイマの張り替え（armSilence）も起きない（pending 数不変）ことを固定。
  対照で同じ本文を `handleChatMessage` に入れると comment-call が出ることも確認。
- cockpit-server.test.mjs「comment-call … ★ 二重発火しない」——`ingestChatMessage("コーディこれ見て")`（音声/テキスト
  両 needle に命中）で **fireCount がちょうど 1**（comment-call のみ・`call` は出ない）、selfFire SSE の kind が
  `comment-call`（`call` の selfFire は 0 件）、viewer 行の transcript SSE がちょうど 1 件であることを固定。
- cockpit-server.test.mjs「viewer コメント取り込みで … 二重放送しない」——viewer 行の transcript SSE が 1 件だけで
  遅れて 2 個目が来ないことを積極確認。

## 4. 新設 v0 定数一覧（コード内定数・ツマミは作らない・裁定 6/8）

| 定数 | 値 | 意味・調整方針 |
|---|---|---|
| `COMMENT_REFRACTORY_MS` | 8000 | コメント応答（comment）の不応期。コメント洪水でも立て続けに撃たない希釈。**comment-call には掛けない**。区切り応答 `TURN_END_REFRACTORY_MS` の写経。人間ゲートで直す。 |
| `COMMENT_PROBABILITY` | 0.35 | comment の発火確率（注入 RNG）。「全コメントには返さない」希釈弁。**comment-call には掛けない**。`TURN_END_PROBABILITY` の写経。 |
| `COMMENT_BUDGET_V0` | 30 | comment のセッション予算（費用・頻度の最終弁）。**comment-call は予算を消費しない**（呼ばれたら確実に返す）。配信 1 本ぶんのコメント量を見越し沈黙予算（6）より大きく取る。人間ゲートで直す。 |
| `NAME_VARIANTS_TEXT_V0` | `["Cody","cody","CODY","コーディ","コーディー","コーティ","コーティー","こーでぃー"]` | コメント内呼びかけの**テキスト用**揺れ集合。音声用 `NAME_VARIANTS_V0`（コーディ系）に**英字表記を加えた**別集合（視聴者の表記揺れ・裁定 5）。 |

**英字の畳み方（重要）**: `normalizeForMatch` は NFKC + かな→カナ + 濁点剥がしのみで**英字の大小は畳まない**
（音声照合を変えないため normalizeForMatch は不変）。NFKC は全半角だけ吸収（`Ｃｏｄｙ`→`Cody`）するので、大小の
揺れは**集合側に小文字化等を織り込む**（`Cody`/`cody`/`CODY` を列挙）。混在ケース（`CoDy` 等）はデータ定数ゆえ
followup で拡張可能（§8）。テストで `Cody`/`cody`/`CODY`/全角 `Ｃｏｄｙ`/日本語表記/かな が命中し、`コピー`/`コーヒー`/
`code review` は非命中（誤爆させない）ことを固定。

## 5. バッファ生存の裁定（v0・§質問で escalate）

転写バッファは耳パイプライン所有（遅延起動・inventory §3）。チャットが繋がっても耳が未起動なら **合流先の正本
バッファが存在しない**。v0 の扱い（`ingestChatMessage`）:
- **バッファ有り**（耳起動中）: 全経路（append + 放送 + scheduler）。
- **バッファ無し**（耳未起動）: `chatBufferAbsent` 診断（ゴースト行材料）を出し、**append/scheduler をスキップ**する。
  理由: 合流先が無い状態で発火しても会話ログにコメントが載らず**盲目発火**（注入にコメント本文が無い）になるため、
  scheduler も回さない（silence 予算/費用を無駄に食わせない）。UI にはゴースト行で「耳未起動でコメントは合流できない」
  ことが見える。

バッファ所有権の巻き上げ（耳非依存化＝チャット単独でも合流先を持つ構造）は **S1〜S6 挙動や器不変を脅かしうる構造
変更**ゆえ **v0 では実装せず**、§8 で escalate する（回避工作で黙って凌がない）。人間ゲートでは「マイク（耳）を
起動した状態でチャットを Connect する」のが素直な運用（cohost はどのみち声も拾う）。

## 6. 器不変・依存ゼロ・チェック無退行の確認（このセッション実行）

```
git diff --stat -- apps/runtime-player packages                 → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json  → 出力なし（lockfile・依存不変＝新規依存ゼロ）
git status --porcelain -- apps/soul/agent                       → M 8 ファイル（Domain B 変更）+ "?? src/chat/"（Domain A 未追跡・不変）
```

- 変更は `apps/soul/agent/src/{ears,mind,cockpit}/**` の既存 8 ファイルのみ（§1）。Domain A の `src/chat/**`・
  `.tmp/facex-*` は一切触っていない。
- **構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルートで実行）:
  - `check-dependencies.mjs`: **passed**（EXIT=0・Dependency guard passed）。
  - `check-soul-zone-boundary.mjs`: **passed**（EXIT=0・1347 files・器↔魂 越境 import なし。合流は魂ゾーン内の
    転写バッファ append・逆方向 import ゼロ）。
  - `check-source-organization.mjs`: EXIT=1 だが**唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`**
    （器コード・barrel-only 違反・ブランチ既存ベースライン＝本 Domain で不変・`.ts` のみ検査）。**私のスコープ
    （soul/agent・全 `.mjs`）には違反ゼロ**。無退行（Domain A §5・S6 domain-b §7 と同じベースライン）。
- **SDK 実消費ゼロ**（この Domain は LLM/SDK に触れない・スケジューラは import ゼロ）。**機械テストは実 YouTube・
  実チャット器官・実ネットワークに一切出ていない**（Domain A の器官も呼ばず、合流点を fake で縦検証）。

## 7. テストで固定した全分岐の一覧（全 fake・+20 本）

**transcript-buffer.test.mjs（+3）**: viewer+displayName 合流（soul 同型 0,0・frozen）/ displayName 省略時 undefined
（you/soul 従来同形）/ displayName 非文字列 throw。

**fire-injection.test.mjs（+2）**: you/soul/viewer 混在を `viewer(名前):` で seq 昇順整形 / displayName 欠落・空白は
`viewer: 本文` へ劣化。

**fire-scheduler.test.mjs（+10）**: S7 v0 定数 export / `NAME_VARIANTS_TEXT_V0`（Cody/cody/CODY/全角/日本語/かな 命中・
コピー等 非命中）/ comment-call 確実発火（不応期・確率・予算を無視して連続でも返す・予算消費しない）/ comment-call
busy・OFF 沈黙 / comment 不応期+確率+予算（不応期内で沈黙・跨いで発火）/ comment 確率外れ沈黙（予算も減らさない）/
comment 予算切れ沈黙（comment-call は予算切れでも返る）/ comment 空文字・busy・OFF 沈黙 / **★ handleTranscript(viewer)
no-op**（you 経路の call 照合/armSilence を誤起動しない）/ コメント活動は沈黙タイマ再武装（lastFire は発火時のみ更新）。

**cockpit-server.test.mjs（+5）**: viewer コメント取り込み＝append(viewer+displayName・0,0) + viewer 行 transcript SSE
1 回（**二重放送しない**・自発 OFF で fire なし）/ comment-call が `fire({vision:"preferred"})` を **1 回**・selfFire SSE
に kind:"comment-call"（**二重発火しない**＝`call` 0 件）/ 耳未起動（バッファ無し）は `chatBufferAbsent` 診断のみで
append/fire しない / `broadcastChatStatus`→SSE "chatStatus"・`broadcastChatDiagnostic`→SSE "chatDiagnostic" /
空コメントは捨てる（append/broadcast/fire しない）。

**無退行（S1〜S6）**: 既存の you/soul 経路・barge-in・沈黙/区切り/呼びかけ・視覚発火・注入整形・cockpit HTTP/SSE は
期待値変更ゼロで全通過（viewer/displayName は追加フィールド・comment 系は新設 handleChatMessage で既存経路に触れない・
scheduler の determinism/import-zero 構造テストも緑）。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 583
# suites 0
# pass  583
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

- **実行前ベースライン（Domain A 後）563 → 実行後 583（+20）**。内訳（`node --test <file>` 個別実測）:
  transcript-buffer.test.mjs 14→17（+3）/ fire-injection.test.mjs 8→10（+2）/ fire-scheduler.test.mjs 22→32（+10）/
  cockpit-server.test.mjs 60→65（+5）。既存 563 本は**期待値変更ゼロで全通過**（無退行）。
- **SDK 実消費ゼロ・実 YouTube/実チャット器官/実ネットワーク不出**（全 fake）。

## 9. §質問（Domain C・人間ゲートへの申し送り・迷った裁定点）

1. **【要 escalate】バッファ所有権と「耳なしチャット」（§5）**: viewer コメントの合流先（転写バッファ）は耳
   パイプライン所有ゆえ、**耳未起動ではコメントを合流できず発火もしない**（v0 は `chatBufferAbsent` 診断のみ）。
   これで人間ゲート（テスト配信でコメントを拾って返す）は「マイク＝耳を起動した状態で Connect」を前提にすれば
   成立する（cohost は声も拾うので自然）が、**耳を切ったままチャットだけ動かす運用を許すなら**バッファ所有権の
   巻き上げ（cockpit-server がバッファを常設所有し耳・チャット双方が append する構造）が要る。これは S1〜S6 の耳
   ライフサイクル・器不変を脅かしうる構造変更なので **v0 では実装せず escalate**。要否と設計は Orch/Undine の裁定待ち。

2. **comment 予算 30 の妥当性（人間ゲート・s7-followup へ）**: `COMMENT_BUDGET_V0=30` は「配信 1 本ぶんの確率
   コメント応答の上限」の当て推量（comment-call は予算外なので呼びかけは常に返る）。活発なチャットで途中で枯れて
   「たまに拾う」が止まると寂しく、緩すぎると費用が嵩む。実測（人間ゲートの体感・S5 usage 計器の代金）で直す前提。
   頻度は将来 Cockpit 可変（s6-followup §12「口数モード」に合流・声とコメントへの反応が一緒に変わる裁定 7）。

3. **テキスト用揺れ集合の混在ケース（Domain C docs・followup へ）**: `NAME_VARIANTS_TEXT_V0` は `Cody/cody/CODY` の
   3 形と日本語表記を持つが、`CoDy` 等の任意混在大小は拾えない（`normalizeForMatch` は英字大小を畳まない・音声照合を
   変えないため不変にした）。実運用で混在表記が多いと分かればデータ定数に足す（またはテキスト専用に小文字化正規化を
   導入する）——s7-followup 台帳の「表記揺れ集合の実運用拡張」欄の回収先。**`コーピー`（「コピー」誤爆）は音声同様に
   見送り**（precision 優先）。

4. **comment/comment-call はどちらも視覚優先で発火（Domain C・人間ゲートへ）**: 振り分けは call/turn-end と同じ
   `fire({vision:"preferred"})`（視覚対象が設定済みなら画像付き・無/キャプチャ失敗なら画像なしの通常発火へ静かに
   劣化）。「コメントに触れつつ画面にも触れる」返事になりうる。silence だけは従来どおり `fire({vision:true})`（見え
   なければ中止）。**どのコメントに触れるか・何を言うかは LLM が選ぶ**（機械信号は「来た」だけ・裁定 4）。selfFire SSE
   に kind:"comment"|"comment-call" が載るので、Domain C は自発発火マーカー行に種別を描ける。

5. **paid（スーパーチャット）の扱い（Domain A §7-7 の回収・Domain C 裁定）**: Domain A は本文のある有料メッセージを
   `kind:"paid"` で onMessage に流す。本取り込み経路は **kind を区別せず** text/displayName だけで合流する（単一
   タイムライン＝話者 viewer・裁定 3）。有料を演出で区別（例: 名前装飾・優先応答）したいなら ingestChatMessage に
   kind を渡して viewer 行の描画/確実応答に反映する余地がある（v0 は区別なし）。金額は onMessage に載っていない。

6. **状態表示・ゴースト行の材料は SSE で用意済み（Domain C へ）**: `chatStatus`（connecting/live/retrying/dead）と
   `chatDiagnostic`（kind/message/atMs/delayMs/attempt）を SSE に載せる口を用意した。**器官の生成・Connect/停止
   ボタン・状態表示 UI・取得死のゴースト行・viewer 行の CSS・selfFire マーカーの kind 表示は Domain C の領分**。
   viewer 行は既存 "transcript" イベント（speaker:"viewer" + displayName）で流れるので、Domain C は `d.speaker` 分岐で
   `viewer(displayName):` を描ける（既存 you/soul 行の流儀 + CSS 追加のみで済む見込み）。

7. **人間ゲートの申し送り（wave-plan §1・§5）**: テスト配信（限定公開可）を立て、マイク（耳）を起動した状態で操縦席
   から配信 URL を Connect → コメントを投げる → こーでぃーが拾って返す（コメント内容への言及）。コメント内「こーでぃー/
   Cody」呼びかけへの確実応答（comment-call）も一言確認。相乗り 2 件（S6 持ち越し④の沈黙発火の頻度体感 + 追撃 E 再
   ゲートの自発発火が画面に触れる）も同席で確認。**手順書は Domain C**。この Domain は全 fake ゆえ「合流→注入→発火要求
   →振り分け」の縦串までしか検証していない（実 SDK の返事の質・実チャットの取得は人間ゲート/Domain A 実疎通の領分）。
