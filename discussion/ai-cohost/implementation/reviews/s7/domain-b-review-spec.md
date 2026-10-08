# S7 Domain B レビュー — spec レーン（設計契約への逐条適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test` と
> `git diff --stat`（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §1・§2・§3 Domain B・§4 /
> [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md) §1 裁定 3/4/5・§3・§3-1 /
> [../../waves/s7/domain-b.md](../../waves/s7/domain-b.md)（Claim）/
> [../../waves/s7/domain-a.md](../../waves/s7/domain-a.md) §7-1（上流消費物 `onMessage(msg)` の形）。
> 対象コミット状態: S7 Domain A + B は未コミット・working tree に存在。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜5 はすべて満たす。spec 検証項目 1〜5（逐条照合）はすべて PASS。
domain-b.md §9 の 7 件の §質問（うち §9-1 が「要 escalate」と明記）はいずれも契約違反ではなく、
v0 スコープの正当な裁量または Domain C・人間ゲートへの正当な申し送りと判定（non-blocking）。ただし
§9-1 の裁定が人間ゲートの成立条件に暗黙の前提を追加している点は Domain C 手順書での明記が必須（下記参照）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が実行・タイムアウト 300s・空/interrupted なし・1 回で成功）:

```
# tests 583
# suites 0
# pass 583
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1247.6648
```

→ **Claim（domain-b.md §8）の 583/583/0 と完全一致**。

**器不変・依存ゼロ・lockfile不変の検証**（自分で実行）:

```
git diff --stat -- apps/runtime-player packages                 → 出力ゼロ（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json   → 出力ゼロ（lockfile・依存不変）
git status --porcelain -- apps/soul/agent
  M apps/soul/agent/src/cockpit/cockpit-server.mjs
  M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
  M apps/soul/agent/src/ears/transcript-buffer.mjs
  M apps/soul/agent/src/ears/transcript-buffer.test.mjs
  M apps/soul/agent/src/mind/fire-injection.mjs
  M apps/soul/agent/src/mind/fire-injection.test.mjs
  M apps/soul/agent/src/mind/fire-scheduler.mjs
  M apps/soul/agent/src/mind/fire-scheduler.test.mjs
  ?? apps/soul/agent/src/chat/   ← Domain A 成果物（未追跡・Domain B は触れていない）
```

domain-b.md §1 の一覧（8 変更ファイルのみ）と完全一致。`src/chat/**` は Domain B の diff に一切現れない
（1 バイトも触っていないという claim と整合）。

**構造チェック 3 種**（repo ルートで自分で実行）:

```
node scripts/check-dependencies.mjs           → "Dependency guard passed." EXIT=0
node scripts/check-soul-zone-boundary.mjs     → "...1347 source files scanned; no 器→魂 imports..." EXIT=0
node scripts/check-source-organization.mjs    → EXIT=1（唯一の違反 apps/runtime-player/src/main/physiology/index.ts）
```

いずれも domain-b.md §6 の claim（passed/passed/唯一違反は器側 pre-existing・`.ts` のみ検査で
soul/agent スコープは違反ゼロ）と完全一致。

**import ゼロの構造確認**（fire-scheduler.mjs を自分で全文読み）: ファイル全体（496 行）に
`import` 文が 1 つも存在しないことを目視で確認。既存の構造テスト
（`fire-scheduler.test.mjs:633-640`「LLM 非依存: fire-scheduler は import ゼロ」）も自分で読み、
`readFileSync` でソースを読んで正規表現照合する実装になっていることを確認（正しく構造を固定している）。

---

## spec 検証項目（逐条照合・PASS/FAIL + file:line 根拠）

### 1. 合流の形が裁定通りか（inventory §1 裁定 3・§3-1）— **PASS**

- `transcript-buffer.mjs:78` `VALID_SPEAKERS = new Set(["you", "soul", "viewer"])` で viewer を閉集合に追加。
  `append` の entry 生成（:161-169）で `speaker`（:166）と `displayName`（:167）を frozen entry に持たせる。
  検証（:134-138）で displayName 非文字列は `TypeError`。既定は you・displayName 省略時 undefined
  （:151-152）— you/soul の既存呼び出しは挙動不変（`transcript-buffer.test.mjs:228-234` で固定済み・自分で
  テストコードとソースを突き合わせ確認）。
- soul 先例踏襲: viewer エントリも `startMs:0, endMs:0`・窓は `appendedAtMs`
  （`transcript-buffer.test.mjs:211-226` で soul 同型を固定・自分で実行して確認 = 上記 583/583 に含まれる）。
- 注入描画: `fire-injection.mjs` の `labelOf`（:37-41）が soul/viewer/you の三値、`formatLine`（:51-58）が
  `viewer(名前): 本文` を生成し、displayName 欠落/空白は `viewer: 本文` へ劣化（`fire-injection.test.mjs:64-86`
  で命中・劣化の両方を固定・自分で実行して確認）。「箱を分けない」という裁定 3 の要件（単一タイムライン・
  viewer は同じ `entries` 配列の要素として窓/上限ロジックに自然に乗る）をコード構造（`formatFireInjection`
  が `{text,speaker?,displayName?,appendedAtMs}` しか見ない純関数のまま）で確認。

### 2. 発火語彙が裁定通りか（裁定 4/5）— **PASS**

- `fire-scheduler.mjs:437-457` `handleChatMessage` が comment-call（テキスト揺れ集合命中で確実発火・
  不応期/確率/予算を掛けない）→ comment（予算→不応期→確率の順）の順で判定。裁定 5 の記述順と一致。
- 「どのコメントに触れるかは LLM が選ぶ・機械信号は『来た』だけ」という裁定 4 の再適用は、scheduler が
  comment/comment-call のいずれも「発火要求」（`{kind}` のみ）を通知するだけで、コメント本文の意味解釈を
  一切行わない構造（`emitFire` は kind 文字列のみを運ぶ・:331-337）で確認。実際に何を言うかは
  `fire-injection.mjs` が整形した会話ログ全文（viewer 行含む）を LLM 側に渡した後の領分であり、
  scheduler・cockpit-server いずれにも LLM ask 呼び出しは存在しない（import ゼロ確認・上記）。

### 3. 既存純関数の再利用（inventory §3）— **PASS**

- `normalizeForMatch`/`textMatchesName`（:175-216、S6 由来・不変）をコメント照合にそのまま再利用
  （`buildNeedles`/`textMatchesName` 呼び出し :299-301, :445）。
- テキスト用 needle 集合 `NAME_VARIANTS_TEXT_V0`（:132-141）を新設（英字 3 形 + 日本語表記 + ひらがな）。
  `normalizeForMatch` 自体は不変（音声照合への影響ゼロ・英字大小を畳まない設計をコメントで明記 :126-130）。
  `fire-scheduler.test.mjs:414-430` で英字大小・全角・日本語・誤爆回避（コピー/コーヒー/code review）を
  自分で読み、テスト内容がこの設計と一致することを確認。

### 4. blocking 基準（wave-plan §4）の充足 — **PASS（全項目）**

1. **器コード・契約 JSON・lockfile 完全不変・新規依存ゼロ・S1〜S6 既存挙動不変**: 上記 `git diff --stat`
   3 種すべて出力ゼロで確認済み。speaker/displayName 拡張は既定値により追加的（既存 583 本中の
   Domain A 後ベースライン 563 本は期待値変更ゼロで全通過 = domain-b.md §7「無退行」節と自分の 583/583
   実行結果が一致）。
2. **機械テストは実ネット/実チャット器官/実 SDK に出ない**: `cockpit-server.test.mjs` の S7 テスト 5 本
   （:1341-1485）はすべて `makeOnAppendPipeline`/`makeFakeOrchestrator`（fake pipeline・fake orchestrator）
   を注入しており実体を生成していない。`fire-scheduler.test.mjs` は fake clock（`makeFakeClock`）+ 注入
   RNG のみ。Domain A の `src/chat/**` は Domain B のテストからも import されていない
   （`cockpit-server.mjs` 冒頭 import 群 :43-53 に `../chat/` 系は無し・自分で確認）。
3. **チャット器官の独立を壊さない**: `cockpit-server.mjs` は `src/chat/**` を一切 import していない
   （import 一覧を自分で確認・上記）。合流は `ingestChatMessage`（:1028）という**外向きの attach 点**を
   公開するだけで、Domain A の器官からの逆方向 import は存在しない。器官の生成・hooks 接続は Domain C の
   領分として明確に切り分けられている（domain-b.md :1004-1021 のコメントで自己申告どおり）。
4. **スケジューラ拡張の決定論テスト・全分岐固定**: `fire-scheduler.test.mjs` の comment/comment-call
   セクション（:405-586）で以下を自分で読み、全分岐が固定されていることを確認:
   - comment-call 確実発火（確率外れ値+予算 0 でも影響を受けない・:451-463）
   - comment-call busy/OFF 沈黙（:465-480）
   - comment 不応期+確率+予算の順（1 通目発火→2 通目不応期内で沈黙→不応期跨ぎで再発火・:482-499）
   - comment 確率外れ（予算不変・:501-508）
   - comment 予算切れ（comment-call は無関係に出続ける・:510-526）
   - comment 空文字/busy/OFF 沈黙（:528-541）
   - ★ viewer no-op（`handleTranscript(viewer)` は発火せずタイマも張り替えない・対照で
     `handleChatMessage` に同じ本文を入れると comment-call が出ることも確認・:543-568）
   - コメント到着の活動扱い（沈黙タイマ再武装・`lastFireAtMs` は発火時のみ更新・:570-586）
   fake clock + 注入 RNG（`rngHit`/`rngMiss`/`makeSeededRng`）のみで全分岐が実 clock/実 RNG に触れず
   決定論的であることを自分で確認。

### 5. 成果物の主張の正直性（583・器不変・3 チェック）— **PASS**

583/583・`git diff --stat` 3 種の空出力・3 チェックの結果はいずれも自分の再実行で domain-b.md の記述と
完全一致（上記「自分で走らせた機械ゲート生数字」節）。捏造・過小/過大申告は見つからない。

---

## §9-1（バッファ生存の裁定・escalate）の spec 評価

### 裁定の内容（再掲）

転写バッファは耳パイプライン所有（遅延起動）。チャットが繋がっても耳が未起動なら合流先の正本バッファが
存在しない。v0 の `ingestChatMessage`（:1028-1060）は、バッファが無ければ `chatBufferAbsent` 診断のみを
出し、append/scheduler をスキップする（`cockpit-server.test.mjs:1417-1440` で固定・自分で読み実装と
一致を確認）。バッファ所有権の巻き上げ（耳非依存化 = チャット単独でも合流先を持つ構造）は v0 では
実装せず、Orch/Undine の裁定待ちとして escalate している。

### 評価: **non-blocking（妥当な v0 裁定・正当な escalate）**

理由:

1. **blocking 基準のいずれにも直接違反しない**。基準 1（器コード・契約完全不変・S1〜S6 挙動不変）・
   基準 3（チャット器官独立・魂の他部位への逆方向 import なし）は、むしろ「バッファ所有権を耳非依存化
   しない」という保守的な選択によって守られている。耳非依存化（cockpit-server がバッファを常設所有し
   耳・チャット双方が append する構造）は、耳のライフサイクル（遅延起動・`pipeline` の生成/破棄タイミング）
   に触れる構造変更になりうり、実施すれば逆に基準 1/3 を脅かすリスクを増やす。v0 でこれを避けた判断は
   「壊れる前提の独立器官」という inventory §1 裁定 2 の精神（チャット器官の生死が魂の動作に無影響）とも
   整合する——耳の構造を触らないことは、耳側の安定性を守ることに直結する。
2. **回避工作で黙って凌いでいない**。`chatBufferAbsent` 診断を出す実装は自分で `cockpit-server.mjs:1035-1043`
   で確認済みで、UI 側（Domain C）がゴースト行として見える形にする材料を正直に用意している。盲目発火
   （会話ログにコメントが載らないまま発火する）を避けるために scheduler も回さない、という判断
   （費用/頻度の無駄遣いを防ぐ）は S7 wave-plan §2 の「発火は既存経路に相乗り」という節約思想と整合する。
3. **人間ゲートの成立条件への影響**: ここが唯一の注意点。wave-plan §1・§5 の人間ゲート記述
   （「テスト配信を立て、チャットにコメントを投げる→こーでぃーが拾って返す」「操縦席で配信 URL を
   設定し Connect→コメントを投げる→拾って返すのを見る」）には**マイク（耳）起動状態という前提が
   明記されていない**。domain-b.md §9-1 は「マイク（耳）を起動した状態で Connect するのが素直な運用
   （cohost はどのみち声も拾う）」という解釈で人間ゲートが成立すると述べているが、これは domain-b.md
   側の申し送りであって wave-plan 本文の明文ではない。もし人間ゲート実施者が耳を起動せずにチャットだけ
   Connect した場合、v0 裁定により「コメントを投げても一切反応がない」（`chatBufferAbsent` 診断のみで
   UI 上は静かに失敗する）という体験になり、これは wave-plan の意図した人間ゲート（一目でわかる成功/
   失敗）を損ないうる。**blocking ではないが、Domain C の人間ゲート手順書に「マイクを起動した状態で
   Connect する」ことを明記することが実質的な前提条件になる**——この明記が漏れると人間ゲートが
   構造的に失敗しうるため、Orch は Domain C のレビュー時にこの手順書の記載を確認すべき。

### wave-plan の人間ゲートは耳 ON 前提で成立するか

成立する（cohost は声もコメントも拾う設計であり、耳を切ってチャットのみ運用するのは元々の
wave-plan のシナリオではない）が、**その前提が wave-plan 本文に明記されていない**という文書上の
ギャップがある。これは Domain B の契約違反ではなく、Domain C の docs／手順書が埋めるべき申し送り事項
として正しく §9-1 に切り出されている。

---

## その他の §質問（domain-b.md §9-2〜§9-7）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 2 | `COMMENT_BUDGET_V0=30` の妥当性 | **non-blocking**。v0 コード内定数として明記され「人間ゲートで直す」前提が明示（裁定6/8の精神と整合）。テストで境界（予算切れ・comment-call 無関係）は固定済み。 |
| 3 | テキスト揺れ集合の混在ケース（`CoDy` 等）未対応 | **non-blocking**。`normalizeForMatch` を不変に保つ設計判断（音声照合への影響回避）の必然的帰結であり、データ定数側で拡張可能なまま followup 送りにしている。誤爆回避（precision 優先）はテストで固定済み。 |
| 4 | comment/comment-call は視覚優先で発火 | **non-blocking**。`cockpit-server.mjs:959-961, 980-983` のコメントと実装（silence 以外は `else` 枝で `fire({vision:"preferred"})`）を自分で確認。S6 Domain E の既定路線をそのまま踏襲しており新規裁定を要しない。 |
| 5 | paid（スーパーチャット）は区別せず合流 | **non-blocking**。Domain A の `onMessage` は kind を渡すが、Domain B は text/displayName だけで単一タイムラインに合流する裁定 3 の忠実な実装。演出差別化は Domain C 裁量として正しく切り出し。 |
| 6 | 状態表示・ゴースト行材料は SSE で用意済み | **non-blocking**。`chatStatus`/`chatDiagnostic` の SSE 口（:1067, :1078）はテスト（:1442-1461）で固定済み。UI 描画は明確に Domain C 領分。 |
| 7 | 人間ゲートの申し送り | 上記 §9-1 評価に包含。 |

---

## blocking / non-blocking の分離

### blocking（wave-plan §4）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約JSON・lockfile完全不変・新規依存ゼロ・S1〜S6無退行 | PASS | `git diff --stat` 3種すべて空・583/583で無退行確認（自分で実行）。 |
| 2. 機械テストは実ネットワークに出ない | PASS | 全fakeパイプライン/fakeオーケストレータ/fake clock。Domain Aの器官はimportされていない。 |
| 3. チャット器官の独立（逆方向importなし・死んでも魂に無影響） | PASS | `cockpit-server.mjs`のimport一覧に`../chat/`系なし。合流は`ingestChatMessage`という外向きattach点のみ。 |
| 4. スケジューラ拡張は決定論テスト（fake clock+注入RNG） | PASS | comment/comment-callの全分岐（不応期・確率・予算・busy/OFF・viewer no-op・活動扱い）を`fire-scheduler.test.mjs`で自分で確認。 |
| 5. 3チェック無退行・SDK実消費ゼロ・終了処理 | PASS | 構造チェック3種を自分で再実行し一致確認。この Domain はLLM/SDKに一切触れない。 |

### non-blocking

- §9-1（バッファ生存・escalate）— 上記詳述のとおり non-blocking。ただし Domain C 手順書での
  「マイク起動状態で Connect」の明記が実質的な前提条件（漏れると人間ゲートが構造的に沈黙失敗しうる）。
- §9-2〜§9-7 の残り 6 件の §質問 — 上表のとおりすべて non-blocking（設計裁量または Domain C/人間ゲートへの
  正当な申し送り）。

---

## §質問（Sylph からの申し送り・判断に迷った点）

1. **人間ゲート手順書の前提明記（Domain C レビュー時に確認事項）**: §9-1 の評価で述べたとおり、
   wave-plan §1・§5 の人間ゲート記述自体には「マイクを起動した状態で Connect する」という前提が
   明文化されていない。Domain C の docs／人間ゲート手順書がこの前提を明記しているかどうかは、
   このレビュー（Domain B・spec レーン）のスコープ外（対象ファイルに docs を含まない）のため
   確認していない。Orch は Domain C のレビュー（spec/design/test いずれか）でこの記載の有無を
   確認することを推奨する。
2. **「振り分け switch」という wave-plan の表現と実装の形の差異（軽微・non-blocking）**: wave-plan §3
   Domain B は「振り分けswitchにcomment/comment-call追加」と記述しているが、実装（`cockpit-server.mjs:980-983`）
   は switch 文ではなく三項演算子（`kind === "silence" ? ... : ...`）である。機能的には契約どおり
   comment/comment-call が silence 以外の枝（視覚優先発火）に自然に流れており、実質的な逸脱はないと
   判断した（S6 由来のコード構造をそのまま踏襲）が、念のため記録する。
