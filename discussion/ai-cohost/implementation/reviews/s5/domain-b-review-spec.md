# S5 Domain B レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-13。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test`
>（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §2・§3 Domain B / §4 /
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-1〜2-4, §5 /
> [../../waves/s5/domain-a.md](../../waves/s5/domain-a.md)（消費した Domain A 契約: `captureWindow`/`listWindows`）/
> [../../waves/s5/domain-b.md](../../waves/s5/domain-b.md)（Claim）。
> 対象コミット状態: S5（Domain A+B）は未コミット・working tree に存在。

## 総合判定: **PASS-with-nonblocking**

blocking 基準（wave-plan §4）は 5 項目すべて満たす。spec 検証項目 1〜7 はすべて PASS。
domain-b.md §7 の 6 件の §質問はいずれも契約違反ではなく、Domain C/human gate への正当な申し送りと判定
（non-blocking）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が 1 回実行・タイムアウト 300s・空/interrupted なし）:

```
# tests 392
# suites 0
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1431.0577
```

→ **Claim（domain-b.md §8）の 392/392/0 と一致**。Domain A 完了時点ベースライン 372 → +20（内訳:
`llm-session.test.mjs` +3 / `cockpit.test.mjs` +3 / `fire-orchestrator.test.mjs` +14。うち fire-orchestrator の
14 本は静的 10 本 + `for (const kind of [...])` ループ生成 4 本の内訳であることをソースで確認済み・
domain-b.md §8 の記述と一致）。

**器不変の検証**（working tree）:

```
git diff --stat -- apps/runtime-player packages        → 出力ゼロ
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json → 出力ゼロ
git diff --stat -- apps/soul/agent/src/eyes             → 出力ゼロ（Domain A 成果物に一切触れていない）
git status --porcelain                                  → 変更 6 ファイルすべて apps/soul/agent/** のみ
```

変更ファイル（6・すべて `apps/soul/agent/**`）: `src/mind/llm-session.mjs` / `.test.mjs` /
`src/mind/fire-orchestrator.mjs` / `.test.mjs` / `scripts/cockpit.mjs` / `.test.mjs`。新規追加は
`src/eyes/**`・`scripts/preflight-eyes.mjs`（いずれも Domain A の成果物・B は触れていない）と
`discussion/**` のみ。`.tmp/facex-*`（別セッション領分）には一切触れていない。テスト実行後も
`git status --porcelain` は同一内容のまま（ディスクへの副産物なし）。

新規 import は `fire-orchestrator.mjs` の `import { captureWindow as defaultCaptureWindow } from
"../eyes/window-capture.mjs"` のみ（同パッケージ内・Domain A の純部品。新規依存ゼロ）。
`llm-session.mjs`/`cockpit.mjs` に新規 import は無い。

---

## spec 検証項目（契約適合・PASS/FAIL + 根拠）

### 1. 器コード・契約 JSON・lockfile 完全不変・新規依存ゼロ — **PASS**

上記「自分で走らせた機械ゲート生数字」節の `git diff --stat` 群がいずれも出力ゼロ。新規 import は
Domain A 内の純部品 1 件のみ。wave-plan §4-1 に適合。

### 2. 通常 Fire の無退行（§4-1 後段） — **PASS**

- `git diff apps/soul/agent/src/mind/fire-orchestrator.mjs` を全量確認（scratchpad に保存し精読）。
  旧インライン実装（削除された 41 行・usage 計器を除く）と新設 `processAskedReply`（追加された
  該当ブロック）は **1 行単位で完全に同一のロジック**（パーサ→hasSpeech/hasEvents 分岐→
  fireEmptyReply→speaking 遷移→expression-only 分岐→speak→buffer.append→戻り値組み立て）。
  唯一の追加は usage 計器（項目 4 で検証）。
- `fire()` 本体: busy 判定（`state !== "idle"`）→ 耳未起動判定（`buffer == null`）は**視覚発火分岐の前**に
  位置し、通常 Fire・視覚発火が完全共有（`fire-orchestrator.mjs:363-382`）。視覚発火分岐
  （`fireOptions.vision === true` のときのみ `fireVision` へ迂回）はこの後に挿入されており、
  `fireOptions` 省略時（通常 Fire）はこの分岐を素通りして元のコードパスへ進む。
- `llm-session.test.mjs`・`fire-orchestrator.test.mjs`・`cockpit.test.mjs` いずれも diff が**純追加**
  （`git diff --stat` で `insertions` のみ・`deletions` は import 行 1 箇所のみ）であることを確認済み
  → 既存アサーションは 1 本も書き換わっていない。node --test 392/392 緑（既存 372 本を含む）で実測確認。

### 3. 失敗時に発火を正直に中止（no-target・4 kind） — **PASS**

- `fireVision`（`fire-orchestrator.mjs:291-354`）: `getVisionTarget` が null/空/throw のいずれでも
  `session.ask` を呼ばずに `{fired:false, reason:"vision-no-target"}` を返す（:299-307）。
- キャプチャ `{error:{kind}}` の場合も `session.ask` を呼ばずに `fireVisionError` 診断 +
  `{fired:false, reason:"vision-capture-failed", kind}`（:316-320）。
- テストで実測固定: `fire-orchestrator.test.mjs:662-701`（`for (const kind of ["notFound",
  "minimized", "failed", "timeout"])` ループ）が各 kind ごとに `askCalled === false` /
  `fakeSpeak.spoken.length === 0` / `buffer.all().length === 1`（soul 追記なし）を明示的に assert。
  no-target 系 3 パターン（null / 未注入 / throw）も同様に `askCalled === false` を固定
  （:703-788）。成功を捏造しない設計（Domain A の白紙成功ガードをそのまま信頼する設計判断・
  domain-b.md §3-5）は wave-plan §2「失敗は正直に」の裁定と一致。

### 4. usage 計器（§4-3・blocking） — **PASS**

- `processAskedReply` 冒頭（`fire-orchestrator.mjs:238-241`）が `asked.usage != null` のときのみ
  `onUsage({usage, vision})` を発火。**通常 Fire・視覚発火の両方**から `processAskedReply` を通るため
  配線は共通（通常 Fire は `vision:false`・視覚発火は `vision:true`）。
- fake テストで実測固定: `fire-orchestrator.test.mjs:535-550`（通常 Fire で
  `{usage:{input_tokens:42}, vision:false}` 通知）・:552-567（usage 未定義なら発火しない）・
  :655-656（視覚発火成功時 `{usage:{input_tokens:900}, vision:true}`）。
- wave-plan §4-4「usage計器が実測で数字を出すこと（裁定2の計器はblocking）」について: 実数字（実 SDK
  経由の計測）は Domain C の領分（§3 Domain C「実 SDK 確認…input_tokensのask毎推移」）であり、
  Domain B の責務は**配線 + fake テストでの固定**——ここまでは満たされている。実数字自体は本 Domain の
  スコープ外（Domain C レビュー時に再検証すべき事項）。

### 5. 画像のディスク非書き込み + 会話ログに画像を積まない — **PASS**

- ディスク書き込み: 本 Domain の変更ファイル 3 本（llm-session/fire-orchestrator/cockpit）に
  `fs.write`・`writeFile` 等のファイル書き込み API は一切登場しない（新規ファイル I/O コードなし）。
  レビュー実行後 `git status --porcelain` を再取得し、テスト実行前後で差分ゼロ（ディスクへの副産物
  なし）を自分で確認した。
- 会話ログ非画像: `processAskedReply` の `buffer.append` 呼び出しは `{startMs:0, endMs:0,
  text:speechText, speaker:"soul"}` の一形のみ（`fire-orchestrator.mjs:277`）。視覚発火専用の
  分岐・画像フィールド追加は無い。テストで実測固定
  （`fire-orchestrator.test.mjs:638-643`: `buffer.all()` の JSON 文字列化に base64 データ
  `"ZmFrZQ=="` が含まれないことを明示 assert）。
- `onVisionCaptured` にのみ `jpegBase64` が載る設計（`fire-orchestrator.mjs:322-329`）。SSE 配線
  自体は Domain C の領分（domain-b.md §7 質問4で正しく申し送り済み）。

### 6. content 配列の形状（画像先行・型ガード） — **PASS**

- `fireVision` の contentBlocks 組み立て（`fire-orchestrator.mjs:339-342`）: 配列 index 0 が
  `{type:'image', source:{type:'base64', data, media_type:'image/jpeg'}}`、index 1 が
  `{type:'text', text}`。inventory §2-2 の型・順序と一致。
- テストで固定: `fire-orchestrator.test.mjs:623-632`（配列長 2・`[0].type==='image'`・
  `[0].source.type==='base64'`・`[0].source.media_type==='image/jpeg'`・`[1].type==='text'`）。
- `llm-session.ask` の型ガード（`llm-session.mjs:212-218`）: 非空文字列 or 非空配列のみ受理、
  それ以外（空文字列・空配列・非文字列非配列・null・undefined・数値）は同期 TypeError。
  テストで固定（`llm-session.test.mjs:220-232`: `""` / `[]` / `42` / `null` / `undefined` すべて
  `TypeError` で reject）。push 形状は文字列/配列を分解せずそのまま透過
  （`llm-session.mjs:224-228`・テスト :188-218 で文字列/配列双方の push 形状を実測固定）。

### 7. FIRE_SYSTEM_PROMPT の最小追記 — **PASS**

- 追記は 1 文のみ: `"画面（画像）が渡されることがあります。その場合は画面を見て、自然に反応して
  ください。"`（`fire-orchestrator.mjs:88-89`・diff で確認: 既存 6 語タグ教示の末尾に文字列連結で
  追加しただけ、他の文言は無変更）。人格の作り込み・振る舞いの詳細指定は無い。
  視覚指示の本体（`VISION_INSTRUCTION_TEXT`）は system prompt でなく ask ごとの動的 text ブロック側
  （`fire-orchestrator.mjs:74`）にあり、wave-plan §3「システムプロンプトへの追記は『画面が渡ることが
  ある』程度の最小」に一致。テストで固定（`fire-orchestrator.test.mjs:859-861`）。

---

## §質問（domain-b.md §7）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | 視覚発火は空窓でも続行する設計 | **non-blocking**。wave-plan §3 Domain B の文言は「キャプチャ成功なら注入」とのみ規定し、空窓時の中止/続行を明示していない。通常 Fire の「空窓は無駄撃ちしない」判定（§2 裁定）を視覚発火に適用すべきという契約上の明記も無い。「画像だけで見て反応する」解釈は wave-plan §1 の UX 意図（「画面に映っているものに言及した返事」）と矛盾しない。Domain C の人間ゲートで確認すべき挙動として正しく開示されている。 |
| 2 | onUsage に `vision` フラグを独自追加 | **non-blocking**。wave-plan §3 の文言「usage(...)をonUsageフックで通知」は形状を規定していない。`{usage, vision}` は `usage` を破壊しないスーパーセットであり、Domain C 側が `info.usage` を読む限り後方互換。裁定2の目的（累積コストの早期検知）に資する追加情報であり契約違反ではない。 |
| 3 | getVisionTarget の注入形は Domain C 待ち | **non-blocking（想定どおりの分業）**。wave-plan §3 Domain C は「操縦席: 対象ウインドウ設定UI」を明示的に自分の担当としており、Domain B が関数型の口だけ開けるのは正しいスコープ分割。 |
| 4 | onVisionCaptured の SSE 配線が未接続 | **non-blocking（想定どおりの分業）**。wave-plan §3 Domain C「サムネ表示」の領分。S4 domain-a.md §9-5 の「onExpression 未接続」と同型の前例があり一貫した手口。 |
| 5 | onFire ペイロードの形状差（`vision:true`・`injectedChars`/`includedCount` 欠落） | **non-blocking**。wave-plan は `onFire` のペイロード形状を契約として固定していない（domain-a.md 由来のワイヤ契約にも `onFire` の詳細形は無い）。対象解決時点ではまだキャプチャ前でこれらの値が存在しないという構造的制約であり、恣意的な逸脱ではない。Domain C の操縦席実装が吸収すべき事項として正しく申し送りされている。 |
| 6 | captureImpl の予期しない throw を `fireError`（`fireVisionError` でなく）に落とす使い分け | **non-blocking**。Domain A の契約（domain-a.md §2）は `captureWindow` の構造化エラーを `{error:{kind}}` 型で返す設計であり、想定外の同期/非同期 throw は「未分類の異常」。既存の `fireError` 経路（wave-plan の「ask/speak の throw は fireError」という既存パターン）を picks up するのは一貫性があり、`fireVisionError` を構造化エラー専用に保つ設計判断は妥当。 |

---

## blocking / non-blocking の分離

### blocking（wave-plan §4）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約JSON・lockfile完全不変・新規依存ゼロ | PASS | git diff --stat 群すべて出力ゼロ・新規 import は Domain A 内の純部品 1 件のみ。 |
| 2. 3チェック無退行 | PASS | node --test 392/392（既存 372 本を含む）。cockpit.test.mjs の createSessionProxy 抽出は旧インライン実装と1:1同値（diff 精読済み）。 |
| 3. eyes器官のfakeテスト必須・失敗系全分岐が固定・失敗時に発火が正直に中止 | PASS | 項目3参照（no-target 3 パターン + 4 kind ループ・計 7 テストで askCalled===false を固定）。eyes 自体は Domain A の領分（本レビュー外）だが、B 側の消費（中止判定）はテストで固定済み。 |
| 4. SDK実消費上限5ask・usage計器が実測で数字を出す | PASS（配線部分）| Domain B は実 SDK を一切呼んでいない（domain-b.md §0 冒頭・自分でも grep 未実施だが記述と整合＝fake session のみのテスト構成を確認済み）。usage 配線 + fake テストは項目4で固定済み。**実数字は Domain C の領分**（wave-plan §3 Domain C「実SDK確認」）。 |
| 5. 終了処理・タイムアウト | PASS | fireVision の finally で必ず idle へ戻す（通常 Fire と同型の finally 構造・fire-orchestrator.mjs:351-353）。dispose 後の視覚発火拒否をテストで固定（:844-857）。 |

### non-blocking

- domain-b.md §7 の 6 件の §質問（上表参照）——いずれも設計判断として妥当・契約違反なし。Domain C /
  人間ゲートでの確認事項として正しく開示されている。
- 本レビューでの追加指摘は無し。

---

## Orch への申し送り

- spec レーンとして S5 Domain B は契約適合。通常 Fire の無退行は「削除された旧インライン実装」と
  「新設 processAskedReply」を diff レベルで突き合わせ、usage 計器以外は完全同一ロジックであることを
  自分で確認した（Gnome の説明への依存を避けるための最も強い検証）。
- 視覚発火の「正直に中止する」設計は、Domain A が既に「白紙成功マーカー」を形式ガードで弾く責務を
  引き受けているため、Domain B はその戻り値を信頼するだけでよい——という責務分担がドキュメント・
  コード双方で一貫している。
- 残る不確実性（実ゲーム窓での白紙判定・DPI・実 usage 数字・cockpit 結線）はすべて Domain C /
  人間ゲートの領分として正しく切り出されている。Domain B のスコープ外。
