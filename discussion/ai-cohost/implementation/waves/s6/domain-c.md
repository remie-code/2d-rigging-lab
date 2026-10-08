# S6 Domain C: 発火スケジューラ（自発発火・「いつ喋るか」は機械信号だけで決める）

> Status: 実装完了・機械ゲート緑（2026-07-13）。人間ゲート（実配信での呼びかけ命中率・区切り応答の頻度体感・
> 沈黙発火のうるささ・定数の体感調整）は Domain D + 人間ゲートに持ち越し。**実マイク・実器・実 SDK・実 TTS は
> 一切引いていない（全 fake・無音・LLM 実消費ゼロ）**。自発発火は既定 OFF（Domain D の永続トグルが ON にする）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §2・§3 Domain C・**§4 blocking 基準 3** /
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §1 裁定 4・§4-1・**§4-2**・§5 /
> 消費した Domain B 成果物: [domain-b.md](domain-b.md)（barge-in gate の結線作法・onVadEvent/onTranscript 配線・
> 定数の流儀・soul 追記タイミング＝魂発話の signal）。

## 0. パイプライン（この Domain が敷いた線）

```
自発発火 経路（全 fake で決定論検証済み・LLM 非依存）:

  耳（ear-pipeline）
   ├─ onVadEvent(speechStart/End/Cancel) ──▶ 結線層（cockpit-server startEars）
   │                                          │ ① 従来どおり SSE "vad" 放送
   │                                          │ ② barge-in gate（Domain B）
   │                                          └▶ ③ fireScheduler.handleVadEvent(e)
   │                                                speechEnd → 区切り応答タイマ（X 無音待ち）
   │                                                speechStart → 区切りタイマ取消 + 沈黙タイマ再武装
   └─ onTranscript(entry) ─────────────────▶ 結線層（soul 除外の**前**に scheduler へ）
                                              └▶ fireScheduler.handleTranscript(entry)
                                                    you  → 呼びかけ照合（正規化+揺れ集合）+ 沈黙リセット
                                                    soul → 直近発火の基点更新（不応期リセット）+ 沈黙リセット
                                              （soul の除外は SSE 放送側のみ・scheduler は you/soul 両方を要る）

  fireScheduler 判定（純ロジック・fake clock/注入 RNG）
   ├─ 呼びかけ（call）    : 名前命中 → 確実に発火要求（不応期・確率なし）※busy/OFF は出さない
   ├─ 区切り応答（turn-end）: speechEnd 後 X 無音 + 不応期 + 確率（注入 RNG）→ 発火要求
   └─ 沈黙（silence）    : 最後の活動から Y + ジッター（注入 RNG）+ 長不応期 + 予算 → 発火要求
                             │
                             ▼  onFireRequest({ kind })
                          結線層（cockpit-server）が kind で fire を出し分ける:
                             call / turn-end → fireOrchestrator.fire()           （通常 Fire）
                             silence         → fireOrchestrator.fire({vision:true}) （視覚発火＝画面を見て一言）
                          （busy 無視・空窓/対象未設定/ears 未起動は既存状態機械が処理・scheduler は要求のみ）
```

- **核心ロジック（自発 3 種の判定・不応期・確率・ジッター・予算・OFF トグル・呼びかけ照合）は純部品
  `fire-scheduler.mjs` に閉じ、fake clock + 注入 RNG + 注入 timer で全分岐を決定論テスト**（blocking 基準 3）。
- cockpit-server の結線は「onVadEvent/onTranscript を scheduler へ回し、onFireRequest を fire へ写す」だけの
  薄い additive 層。Domain B の barge-in gate 結線と同じ作法（orchestrator が fire/getState を持つときだけ生成）。
- **「いつ喋るか」判断に LLM ask を使うコード経路は存在しない**（§6）。scheduler は発火要求を出すだけで、
  ask/発話は fire-orchestrator が担う（scheduler は session に触れない）。

## 1. 実装/変更ファイル一覧（すべて `apps/soul/agent/`・scope 内）

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/mind/fire-scheduler.mjs` | 新規 | 発火スケジューラの純ロジック。`createFireScheduler`（自発 3 種判定・注入 clock/RNG/timer）・`normalizeForMatch`/`textMatchesName`（呼びかけ照合の正規化純関数）・v0 定数 7 種 + 揺れ集合 `NAME_VARIANTS_V0`。**import ゼロ＝LLM 非依存を構造で担保**。 |
| `src/mind/fire-scheduler.test.mjs` | 新規 | 上記の決定論テスト 22 本（呼びかけ/区切り/沈黙/OFF トグル/決定論/LLM 非依存/正規化境界）。fake clock+timer+RNG 注入。 |
| `src/cockpit/cockpit-server.mjs` | 変更（結線・薄い） | scheduler を生成（orchestrator が fire/getState を持つときだけ）し、`onVadEvent`→`handleVadEvent`・`onTranscript`→`handleTranscript`（soul 除外の前）を回す。`onFireRequest` で kind に応じ fire()/fire({vision:true})。close() で dispose。snapshot に `selfFire:{enabled}`、返り値に `setSelfFireEnabled`/`selfFireStatus`、option `selfFireInitialEnabled`（既定 false）を追加。 |
| `src/cockpit/cockpit-server.test.mjs` | 変更 | self-fire 結線の縦串テスト 5 本追加（呼びかけ命中で fire()・OFF で沈黙・busy で沈黙・snapshot/トグル・未注入で scheduler 無し）。既存テストは 1 行も変更していない。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§7 の `git diff --stat` で確認・新規依存ゼロ・fire-scheduler.mjs は import ゼロ）。`.tmp/facex-*`
（別セッション領分）・`scripts/cockpit.mjs`・`src/mind/fire-orchestrator.mjs`・`src/mind/barge-in.mjs`・
`src/eyes/**`・`src/voice/**` は一切触っていない（読んで契約を消費しただけ）。

## 2. スケジューラの契約（入力・出力・状態・失敗の扱い）

### 2-1. `createFireScheduler(options)` → scheduler

```
createFireScheduler({
  onFireRequest: (request: { kind: "call"|"turn-end"|"silence" }) => void,  // 必須
  isBusy?: () => boolean,          // orchestrator が thinking/speaking か（既定 () => false）
  enabled?: boolean,               // 自発の初期 ON/OFF（既定 false）
  nowImpl?: () => number,          // 現在時刻（不応期・活動時刻の基点・既定 Date.now）
  rng?: () => number,              // 乱数 [0,1)（区切り確率・沈黙ジッター・既定 Math.random）
  setTimeoutImpl?, clearTimeoutImpl?,  // タイマ注入（決定論テスト）
  turnEndSilenceMs?, turnEndProbability?, turnEndRefractoryMs?,   // v0 定数の上書き（テスト用）
  silenceBaseMs?, silenceJitterMs?, silenceRefractoryMs?, silenceBudget?,
  nameVariants?: string[]          // 呼びかけ照合の揺れ集合（既定 NAME_VARIANTS_V0）
}) => {
  handleVadEvent(event: { type: string }): void,       // speechStart/End/Cancel を食わせる
  handleTranscript(entry: { text?, speaker? }): void,  // you/soul の転写を食わせる
  setEnabled(enabled: boolean): void,                  // 自発 ON/OFF（OFF でタイマ畳み・3 種黙る）
  isEnabled(): boolean,
  silenceBudgetRemaining(): number,
  dispose(): void                                      // タイマ解除・以後のイベント無視
}
```

- **入力**: VAD イベント（handleVadEvent）・転写 append（handleTranscript・**you も soul も届く**）・注入 clock/RNG/timer・
  自発 enable 状態（bool）。busy 判定は注入 `isBusy()`。
- **出力**: 発火要求 `{ kind }` を `onFireRequest` で通知（結線層が対応する fire を呼ぶ）。scheduler 自身は
  fire も ask もしない。
- **状態**: `enabled`・`lastFireAtMs`（不応期の基点）・`silenceBudget`（残予算）・区切りタイマ/沈黙タイマ。
- **失敗の扱い**: `onFireRequest` の throw は握る（best-effort・判定経路を壊さない）。不正 event/entry（null・
  type/speaker 欠落）は無視。`normalizeForMatch` の非文字列入力のみ throw（照合純関数のバグを黙殺しない）。
- **busy 中・自発 OFF 中は発火要求を出さない**（3 種とも）。OFF はタイマも畳む（イベントループに残さない）。

### 2-2. 呼びかけ照合の純関数

```
normalizeForMatch(text: string): string   // NFKC → ひら→カナ → 濁点/半濁点剥がし（清濁吸収）
textMatchesName(text, needles: string[]): boolean  // 正規化後の部分文字列一致
```

- 転写文字列と揺れ集合を**同じ規則で正規化**し、正規化 needle が正規化テキストの**部分文字列**なら命中
  （呼びかけ直後の読点が消えて本文と連結する実測「コーディこれどう思う?」に対応するため部分一致）。

## 3. 自発 3 種の判定規則と全 v0 定数（コード内定数・ツマミは作らない・裁定 8）

| 定数 | 値 | 意味・根拠・調整方針 |
|---|---|---|
| `TURN_END_SILENCE_MS` | 2000 | 区切り応答の追加無音待ち。speechEnd（セグメンタは既に minSilence=常駐 400ms の無音を確定済み）から**さらに** 2s。ASR の warm レイテンシ（≈1.5〜1.8s）より長く取り、区切り応答が撃つ時点で直前 you 発話の転写が会話ログに載っている確度を上げる（発火は buffer.all() を読むため）。 |
| `TURN_END_PROBABILITY` | 0.35 | 区切り応答の発火確率（注入 RNG）。「全部には返さない」（裁定 4）を機械的に実現する希釈弁。独り言への誤応答は味（裁定 9）。 |
| `TURN_END_REFRACTORY_MS` | 8000 | 区切り応答の不応期。直近発火から 8s 未満なら出さない（立て続けの相槌でうるさくしない）。 |
| `SILENCE_BASE_MS` | 45000 | 沈黙発火の基礎無音長。最後の活動から 45s + ジッターで候補化。 |
| `SILENCE_JITTER_MS` | 30000 | 沈黙ジッター幅（注入 RNG）。base に [0,30s) を足して規則性を崩す（実効 45〜75s）。 |
| `SILENCE_REFRACTORY_MS` | 90000 | 沈黙の長い不応期。直近発火から 90s 未満なら出さない（視覚発火は S5 usage 計器で代金も見えるため保守的に長く）。 |
| `SILENCE_BUDGET_V0` | 6 | 沈黙発火のセッション予算（生存中の回数上限）。予算切れで沈黙タイマは張らない（イベントループに残さない）。 |

**判定規則**:

1. **呼びかけ（call）**: `handleTranscript(you)` で名前照合（§4）が命中したら**確実に**発火要求。**不応期・確率は
   掛けない**（呼ばれたら返す・裁定 4）。ただし自発 OFF・busy 中は出さない（busy 中の要求は orchestrator が無視
   するだけなので出さない設計）。soul 発話・空文字は照合しない。
2. **区切り応答（turn-end）**: `handleVadEvent(speechEnd)` で無音待ちタイマ（X=2000ms）を張る。タイマ満了時に
   ①自発 ON ②`!isBusy()` ③`now − lastFireAtMs ≥ TURN_END_REFRACTORY_MS`（不応期）④`rng() < TURN_END_PROBABILITY`
   （確率当たり）を**全て満たせば**発火要求。無音待ち中に `speechStart`（新しい発話オンセット＝まだ喋っている）が
   来たらタイマ取消（次の speechEnd から測り直し）。`speechCancel`（スパイク棄却）は無視（1 スパイクで区切り応答を
   落とすのは免罪符・裁定 2）。
3. **沈黙（silence）**: 最後の活動（you/soul 転写・speechStart/End）で沈黙タイマを `SILENCE_BASE_MS + floor(rng()×
   SILENCE_JITTER_MS)` に再武装。満了時に ①自発 ON ②予算残 ③`!isBusy()` ④`now − lastFireAtMs ≥
   SILENCE_REFRACTORY_MS`（長不応期）を満たせば発火要求 + 予算 −1。②〜④の不成立（busy/長不応期内）は**出さずに
   再武装**（後で条件を満たしうる）。予算切れは再武装しない（タイマを残さない）。silence は視覚発火相当。

**不応期の基点 `lastFireAtMs`**: call/turn-end/silence の発火要求を出した時点で更新するほか、**魂の転写 append
（speaker:"soul"）でも更新**する。これにより手動 Fire・呼びかけ・区切り・沈黙のいずれの発火でも、実際に魂が
喋った時点（append）で不応期がリセットされ、自発が直後に重ならない。初期値 `-Infinity`（最初の不応期は必ず通過）。

## 4. 呼びかけ照合集合 v0 の中身・正規化規則・採否理由（inventory §4-2）

名前 =「こーでぃー」（Claude Code → Cody）。inventory §4-2 の実測 7 種の転写揺れに対し、**precision 重視**で採否を
決めた（call は不応期・確率の希釈が無く**命中即発火**なので、誤爆コストが区切り/沈黙より高い）。

**採用（`NAME_VARIANTS_V0`・データ定数）**: `コーディ` / `コーディー` / `コーティ` / `コーティー`（ディ/ティ軸 +
末尾長音の有無）。**見送り**: `コーピー`（「コピー」との誤爆リスク・§4-2 明記）・`コーキー`（まれな子音誤認・ディ/ティ
軸から外れる）・`こうて`/`こうで`（名前単独発話の崩壊形だが「こうです」「買うて」等の**本文部分文字列と衝突**する
誤爆リスクが高い——照合は部分一致のため）。

**正規化規則（`normalizeForMatch`・決定論純関数）** ——転写と揺れ集合を同じ規則で畳み、正規化 needle が正規化
テキストの部分文字列なら命中:
1. **NFKC**: 全角/半角・互換文字を統一（半角カナ `ｺｰﾃﾞｨ` → 全角）。
2. **ひらがな → カタカナ**（U+3041..U+3096 を +0x60）: かな種別の揺れを吸収（`こーでぃー` を拾う）。
3. **濁点・半濁点を剥がす**（NFD 分解 → 結合マーク U+3099/U+309A 除去 → NFC）: **ディ↔ティ の清濁を吸収**。
   末尾長音（ー）は剥がさない——集合に `コーディ`（長音なし）と `コーディー`（長音あり）の両方を持ち、短い needle が
   長い方の部分文字列になるため、部分一致で末尾長音の有無を自然に吸収できる。

正規化後、揺れ集合は `{コーティ, コーティー}` の 2 needle に畳まれる（`コーティ ⊂ コーティー`）。実測命中/非命中は
テストで固定（採用 4 種 + かな + 連結が命中・`コーピー`/`コーキー`/`こうて`/`こうで`/`コピー`/`コーヒー` が非命中）。

**既知の誤爆（受容・人間ゲートで観測）**: `コーディネート`（coordinate）は正規化後 `コーティネート` となり `コーティ`
を部分文字列に含むため**命中する**（名前自体が Cody=コーディ 由来ゆえ構造的）。call は確率の希釈が無いので毎回撃つが、
配信文脈での出現頻度は低いと見込み v0 は受容（誤爆は起きてよい失敗・裁定 2）。実害があれば照合の緊縮（語境界・
前後文脈）を人間ゲート後に検討。**照合集合はデータ定数**ゆえ、実人声・マイク経由の揺れ（未採取＝実マイク規律）で
後から拡張/緊縮できる。

## 5. 結線層（cockpit-server）の薄さと additive 性

- scheduler は **orchestrator が fire/getState を持つときだけ生成**する（未注入なら scheduler なし＝S2.5〜S5 無退行）。
  既定 `selfFireInitialEnabled=false`＝生成しても**自発は黙る**（タイマを張らず要求も出さない）＝既存テストは無影響。
- `onVadEvent` は従来（SSE "vad" 放送 + barge-in gate）に**並んで** `fireScheduler.handleVadEvent(e)` を呼ぶだけ。
  `onTranscript` は **soul 除外の前**に `fireScheduler.handleTranscript(entry)` を呼ぶ（scheduler は soul を不応期の
  基点に使うため you/soul 両方を要る・SSE 放送側の soul 除外は不変）。
- `onFireRequest` は `req.kind==="silence"` なら `fire({vision:true})`・それ以外（call/turn-end）は `fire()`。いずれも
  **非 await の best-effort**（barge-in interrupt の作法に倣う・fire 経路をブロックしない・throw は握る）。busy 無視・
  空窓/対象未設定/ears 未起動は既存状態機械が処理（scheduler は要求を出すだけ）。
- close() で `fireScheduler.dispose()`（タイマ解除）。返り値 `setSelfFireEnabled(enabled)`/`selfFireStatus()` と
  snapshot `selfFire:{enabled}` が **Domain D の永続トグルの継ぎ目**（§8 質問 1）。**手動 Fire・視覚発火・barge-in・
  S1〜S5 既存挙動は全て不変**（scheduler は additive・既存経路に触れない）。

## 6. 「いつ喋るか判定に LLM ask 経路が無い」ことの担保（blocking 基準 3）

- **構造的担保**: `fire-scheduler.mjs` は **import 文が 1 つも無い**（依存ゼロの純ロジック）。LLM/SDK/session/
  fire-orchestrator への到達経路がソースに存在しない。判定は機械信号（VAD イベント時刻・タイマ・文字列照合・
  注入 RNG・注入 clock）のみで、scheduler は発火「要求」を出すだけ（ask/発話は結線層の fire-orchestrator が担う）。
- **テストで固定**（`fire-scheduler.test.mjs`「LLM 非依存」）: ソースを読み ①`import ... from` が 0 件
  ②`.ask(` が 0 件 ③`createLlmSession|llm-session|claude-agent-sdk|session.ask` が 0 件 を assert。
- **全分岐決定論**（同ファイル 22 本）: fake clock + 注入 setTimeout/clearTimeout + 注入 RNG で、呼びかけ命中/非該当/
  soul 除外/OFF/busy・区切りの無音 X 境界/不応期/確率当たり外れ/speechStart 取消・沈黙の Y+ジッター/長不応期/予算/
  busy 再武装・OFF トグルのタイマ畳み・**決定論（同じ入力列 + 同じ seed RNG → 同じ発火要求列）**を固定した。

## 7. 器不変・依存ゼロ・チェック無退行の確認

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json → 出力なし
  （器コード・契約 JSON・lockfile・依存 完全不変＝新規依存ゼロ。fire-scheduler.mjs は import ゼロ）

本 Domain の変更/新規（git status・.tmp / Domain A・B の未コミット成果物を除く）:
   M apps/soul/agent/src/cockpit/cockpit-server.mjs        (+105 −2・うち Domain B の barge-in 結線分を含む)
   M apps/soul/agent/src/cockpit/cockpit-server.test.mjs   (+116・self-fire 縦串 5 本)
  ?? apps/soul/agent/src/mind/fire-scheduler.mjs           (382 行・新規・import ゼロ)
  ?? apps/soul/agent/src/mind/fire-scheduler.test.mjs      (473 行・新規・22 本)
```

- `scripts/cockpit.mjs`・`src/mind/fire-orchestrator.mjs`・`src/mind/barge-in.mjs`・`src/channel/*`・`src/voice/*`・
  `src/test-support/*` の変更は **Domain A/B の未コミット成果物**であり本 Domain では 1 バイトも触っていない
  （cockpit.mjs は `git diff --stat` が Domain B の +16 のまま＝本 Domain の追加ゼロ）。
- 構造チェック 3 種（このセッション・リポジトリ root）:
  - `check:deps`: **passed**（Dependency guard passed）。
  - `check:soul-zone`: **passed**（1341 files・器↔魂 越境 import なし。fire-scheduler.mjs は同一魂ゾーン内）。
  - `check:source`: 唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`（器コード・**本 Domain で不変＝
    `git diff --stat` 空**）。私のスコープ（soul/agent）には違反ゼロ。この違反はブランチ既存（Domain B §7 で申し送り済み）
    ＝無退行。
- `.tmp/facex-*`（別セッション領分）は一切触っていない。実 SDK・実 PowerShell・実マイク・実 TTS はいずれも
  呼んでいない（clock/timer/RNG/VAD イベント/転写すべて fake・無音・SDK 実消費ゼロ）。

## 8. §質問（Orch / Domain D への申し送り・迷った裁定点）

1. **自発 ON/OFF の永続トグル + UI は Domain D の領分（継ぎ目を用意した）**: 本 Domain は
   `selfFireInitialEnabled`（既定 false）で scheduler を生成し、`server.setSelfFireEnabled(bool)` /
   `server.selfFireStatus()` / snapshot `selfFire:{enabled}` を露出した（vision-target/channel と同型の継ぎ目）。
   **HTTP エンドポイント（POST /api/self-fire 等）・settings 永続化（createSelfFireHooks 相当）・操縦席のモード
   スイッチ UI は Domain D が配線する**（vision-target の写経）。既定 OFF ゆえ、Domain D が ON にするまで人間ゲート
   ②③④（自発 3 種）は実射されない——これは意図した順序（自発が暴発する前にトグルを載せる）。Domain D で
   永続の初期値（ON にするか）を裁定してほしい。

2. **呼びかけ照合の既知誤爆「コーディネート」（§4）**: 名前が Cody=コーディ 由来ゆえ `コーディネート` を部分一致で
   拾う。call は確率の希釈が無く毎回撃つ。v0 は受容（誤爆は免罪符）。実人声の人間ゲートで実害が判明したら照合の
   緊縮（語境界・前後）を検討。照合集合はデータ定数ゆえ実人声の揺れで拡張/緊縮可能（人間ゲートで補完）。

3. **区切り応答は VAD 無音ベース（X=2000ms）で撃つ＝転写到着とは非同期**: turn-end は speechEnd + X の VAD 無音で
   撃ち、その時点の会話ログ（buffer.all()）を注入する。X=2000ms を ASR warm レイテンシ（≈1.5〜1.8s）より長く取り
   直前 you 発話の転写が載っている確度を上げたが、ASR が遅れると「最後の一言が入る前」に撃ちうる（区切り応答は
   ソフトな相槌ゆえ許容）。turn-end を転写到着イベントに連動させる設計もありうる——実配信の体感で Domain D/後続が
   裁定してほしい。

4. **呼びかけ（call）も busy 中は出さない設計にした**: 「呼ばれたら確実に返す」（裁定 4）だが、busy（魂が喋っている
   最中）に emit しても orchestrator が無視するだけなので出さない（busy 中は要求を出さない・§設計原則）。barge-in で
   魂が停止→idle に戻った後の転写なら通る。この非対称（call は不応期/確率を掛けないが busy だけは respect する）が
   適切か申し送る。

5. **不応期の基点は「発火要求を出した時点」でも更新する**: emit 時に `lastFireAtMs` を即更新するため、要求が
   busy/空窓/ears 未起動で**実際には発話に至らなくても**、次の turn-end/silence はしばらく抑制される（魂が喋れば
   soul append で改めて更新される）。リトライ嵐を避ける保守側の設計だが、「撃ったが不発」の連続で自発が過度に沈黙
   しうる。実配信の体感で調整（v0 定数 + この基点更新方針）してほしい。

6. **沈黙の「活動」定義**: speechStart/speechEnd + you/soul 転写を活動として沈黙カウントを再武装する
   （speechCancel は無視）。ノイズ環境で speechStart スパイクが頻発すると沈黙が発火しにくくなりうるが、スパイクは
   稀 + 免罪符ゆえ v0 は受容。

7. **cockpit-server 結線のテストは呼びかけ（call・タイマ不要）で縦串を固定した**: turn-end/silence はタイマ依存で
   cockpit-server 経由の決定論テストが難しいため、純ロジック側（fire-scheduler.test.mjs）で全分岐を固定し、
   cockpit-server 側は「転写 onAppend → scheduler → onFireRequest → fire()」の縦串を即時判定の call で固定した
   （+ OFF/busy/snapshot/未注入）。実マイク経由の VAD → 実自発発火の end-to-end は人間ゲート/Domain D の実 SDK 確認
   の領分。

## 9. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 479
# pass  479
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

**S6 Domain B 後ベースライン 452 → 479（+27）**。内訳:
- `src/mind/fire-scheduler.test.mjs`: **+22**（新規）。定数 1 + 正規化/照合 3 + 呼びかけ 3 + 区切り 5 + 沈黙 6 +
  OFF トグル 1 + 決定論 1 + LLM 非依存 1 + dispose 1。
- `src/cockpit/cockpit-server.test.mjs`: 44 → 49（**+5**）。呼びかけ命中で fire()・OFF で沈黙 + トグル ON・busy で
  沈黙・snapshot/setSelfFireEnabled/selfFireStatus・未注入で scheduler 無し。既存 44 本は無変更＝無退行。
- 他ファイル（fire-orchestrator・barge-in・cockpit・cli・speak・audio-player 等の既存テスト）は**期待値変更ゼロで
  全通過**（scheduler は additive・既定 OFF ゆえ既存経路に観測差を出さない）。

`node --test` は自然終了（ハングなし・全 timer は fake か dispose で解除・実プロセス/実タイマを残さない）。
実 SDK・実 PowerShell・実マイク・実 TTS はいずれも呼んでいない（全 fake・無音・SDK 実消費ゼロ）。
```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json → 出力なし
```
