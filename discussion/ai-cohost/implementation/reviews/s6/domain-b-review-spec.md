# S6 Domain B レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-13。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test` と
> `git diff --stat`（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §1・§2・§3 Domain B・§4 /
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §2・§3-3・§4-1・§5 /
> [../../waves/s6/domain-b.md](../../waves/s6/domain-b.md)（Claim）。
> 対象コミット状態: S6 Domain A+B は未コミット・working tree に存在。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜6 はすべて満たす。spec 検証項目 1〜5（逐条照合）はすべて PASS。
domain-b.md §8 の 6 件の §質問はいずれも契約違反ではなく、設計裁量または Domain C/D・人間ゲートへの
正当な申し送りと判定（non-blocking）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が実行・タイムアウト 300s・空/interrupted なし・1 回で成功）:

```
# tests 452
# suites 0
# pass 452
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1155.5219
```

→ **Claim（domain-b.md §9）の 452/452/0 と一致**。S6 Domain A 後ベースライン 425 → +27。内訳を自分でも
ソースで確認: `barge-in.test.mjs` の `test(` 出現数 17（定数1+切断点10+機械弁6）／`channel-client.test.mjs`
14（既存11+sendSet新規3）／`fire-orchestrator.test.mjs` は静的 `test(` 出現数 35 だが、うち1本
（キャプチャ失敗4 kind の `for` ループ・S5 由来）が実行時に4テストへ展開されるため実測39（静的35-1+4）
＝旧32本+新規7本と一致（barge-in 縦検証7本: interrupt/自然完了/no-op/rejected握り/dispose/gate結線/
speechCancel取消）。

**器不変・契約不変・lockfile不変の検証**（Review-Sylph が自分で実行）:

```
git diff --stat -- apps/runtime-player packages                                 → 出力ゼロ
git diff --stat -- apps/runtime-player/src/main/control-channel/contract        → 出力ゼロ
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json                  → 出力ゼロ
```

`git status --porcelain apps/soul/agent`（`.tmp/facex-*` 除く）: 変更 11 ファイルすべて
`apps/soul/agent/**` のみ（うち `audio-player.*`/`speak.*`/`preflight-voice.mjs`/`fake-media-player.mjs`
は Domain A の未コミット成果物・Domain B は 1 バイトも触れていないことを diff 自体が示す）。Domain B の
変更ファイルは domain-b.md §1 の一覧と完全一致（`barge-in.mjs`/`.test.mjs` 新規・`fire-orchestrator.mjs`/
`.test.mjs`・`channel-client.mjs`/`.test.mjs`・`ws-double.mjs`・`cockpit-server.mjs`・`cockpit.mjs` 変更）。
`git diff --stat` の行数実測は claim とわずかに前後する（例: fire-orchestrator.mjs 実測 +227/-7 に対し
claim は +220/-7・ws-double.mjs 実測 +13/-2 に対し claim は +11/-2 等）が、方向・桁は一致しコメント量の
差程度のずれであり、捏造や過小申告ではない（non-blocking・後述）。

---

## spec 検証項目（wave-plan §3 Domain B・inventory §2/§3-3/§4-1/§5 への逐条照合・PASS/FAIL + 根拠）

### 1. barge-in 機構（機械弁 + 3 手順）— **PASS**

- `createBargeInGate`（`barge-in.mjs:152-207`）: `speechStart` で待機タイマ（既定 `BARGE_IN_MIN_SPEECH_MS=200`）
  を張り、`minSpeechMs` 内に `speechCancel` が来なければ `onConfirm` を発火。`speechCancel` で待機取消
  （瞬間スパイクでは譲らない）。連続 `speechStart` は張り替え（二重確定しない）。`speechEnd` は無関係。
  `dispose()` でタイマを畳む。すべて `barge-in.test.mjs`（機械弁 6 本）で境界固定済み（自分で通読）。
- `interrupt()`（`fire-orchestrator.mjs:401-484`）が確定を受けて①〜③を順に実行:
  ① `player.stop()`（:415-421） ② `channel.sendSet({slotId:"mouth-open", value:0,
  ttlMs:MOUTH_CLOSE_TTL_MS})`（:425-452） ③ `computeSpokenPrefix` で切断点算出（:454-461）。
  wave 計画 §2/§3 の記述順（プレイヤー停止→口 intent.set→切断点記録）と実装順が一致。
  縦検証: `fire-orchestrator.test.mjs:950-1016`（interrupt 全手順を1本で確認）・
  `:1135-1175`（VAD イベント→gate→interrupt の結線縦検証・全 fake）・`:1177-`（窓内 speechCancel は
  interrupt を呼ばず自然完了・機械弁が譲る側で正しく動くことを縦で確認）。

### 2. 切断点の正直記録 + soul 追記タイミング変更 — **PASS**

- `computeSpokenPrefix`（`barge-in.mjs:90-134`）: 厳密不等号 `<`・`floor`・オンセット基準按分の3保守化を
  ソースで確認。境界（経過0/負/最初のオンセット丁度/途中/最後のオンセット丁度/厳密超過/文字数>モーラ数/
  空timeline/空文字/timeMs非数/不正入力throw）を `barge-in.test.mjs:75-156` の10本で実測固定。「オンセット
  丁度でもまだ全文にしない」（:109-115）まで保守側に倒しており「声に出とらん文字を出したことにしない」を
  最も厳しい境界で担保している。
- append-only 維持: `processAskedReply` は完了時 (:385) と中断時 (`interrupt` 内 :464-469) のいずれか
  1 回だけ `buffer.append` を呼ぶ設計で、中断確定後の自然完了パス（`completion.interrupted` 分岐 :368-381）
  では **二重 append しない**ことをコードで確認。テストでも「2度目の interrupt は no-op・追記は増えない」
  （:1011-1014）・「dispose 中断は soul 追記せず畳む」（:1109-1132）を実測固定。
- soul 追記タイミング変更: 従来「speak 直後」→ S6「発話完了時 or 中断時」への変更を
  `fire-orchestrator.test.mjs:1018-1057`（自然完了: speaking 到達時点で `buffer.all().length===1`＝
  未追記・`durationMs` 経過後に初めて全文追記）で明示的に固定。これは wave-plan §2/§3 の「裁定済みの
  意図変更」に該当し、blocking 基準1の除外事項と一致（他の挙動は不変）。

### 3. 口停止＝契約内の既存意味論のみ・sendSet payload の契約適合 — **PASS**

- `MOUTH_CLOSE_SLOT_ID="mouth-open"`・value=0・`MOUTH_CLOSE_TTL_MS=400` の intent.set 送出は、器の
  `control-channel-overlay-store.ts` の `#yieldSpeechForSlot`→`#forceReleaseSpeech`
  （:328-359）を自分でソース確認: `mouth-open` は `speech-timeline-state.ts:54-68` の
  `RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS`（6 スロット）に含まれ、この6スロットへの per-slot
  intent.set/envelope 着弾は speech タイムライン全体を強制 release へ切り替える設計が**既存コード**として
  存在する（inventory §2 の記述と一致）。器コード側は本 Domain で1バイトも変更していない
  （`git diff --stat -- apps/runtime-player` 空・上記で自分で確認済み）。契約拡張なし＝既存意味論の流用の
  みで実現されている。
- `channel.sendSet`（`channel-client.mjs:188-201`）の payload は `{slotId, value, ttlMs?}`（ttlMs は
  指定時のみ載せる）で、器契約 `channel-intent-set-payload-schema.json`
  （`required:["slotId","value"]`・`value` は number・`ttlMs` は `exclusiveMinimum:0` の optional）と
  完全一致。ワイヤ形 `{v:1, id, kind:"intent.set", payload}` は reference-driver
  （`apps/soul/reference-driver/reference-driver.mjs:786-800` の `sendIntent`）と1:1同型であることを
  自分で読み比べて確認（写経元記載どおり）。
- 既定 `requiredKinds`（`connectChannel` の hello 照合）は `["intent.speech", "intent.envelope"]` のまま
  不変（`channel-client.mjs:65`）— `intent.set` は追加していない。よって「intent.set 非広告の相手でも
  接続は張れる＝口閉じは best-effort」という claim（domain-b.md §2-4）は実装と一致し、S1〜S5 の接続契約
  （fail-fast 対象）を拡げていない。

### 4. 結線（onVadEvent → barge-in 判定を SSE と並んで・手動 Fire/視覚発火の外形不変）— **PASS**

- `cockpit-server.mjs:493-505`: `onVadEvent` は従来どおり `broadcast("vad", ...)` した**直後**に
  `bargeInGate.handle(e)` を呼ぶだけ（additive）。`bargeInGate` は `fireOrchestrator.interrupt` が
  関数であるときのみ生成（:828-839）＝fake orchestrator を注入する既存テストには影響しない設計で、
  実際に既存 cockpit-server テスト群は無変更のまま全緑（node --test で確認済み）。
- `cockpit.mjs`: `createLazyChannel` に `sendSet` を追加（:150-153）・`playerProxy` に `stop` を追加
  （:335-338）のみ。既存の遅延生成・URL記憶ロジックは無変更（diff がその2ブロックの純追加であることを
  自分で確認）。
- 手動 Fire（通常 `fire()`）の署名・busy判定・耳未起動判定・注入窓・診断発行順序は
  `fire-orchestrator.mjs:563-611` で完全に元の構造のまま（視覚発火分岐 :580-582 の前後に変更なし）。
  視覚発火（`fireVision`）も無変更（processAskedReply の共通化のみで独立フローは触れていない）。
  既存の視覚/演出/usage系テストは全通過（452/452 に含まれる）。

### 5. 成果物の主張の正直性（生数字452・器不変・§8-1 の HTTP 応答変化の記述）— **PASS**

- 452/452 は自分の実行で再現・一致（上記「自分で走らせた機械ゲート生数字」節）。
- 器コード・契約 JSON・lockfile 完全不変は自分の `git diff --stat` で確認済み（出力ゼロ3件）。
- §8-1（`fire()` が再生実区間 await するようになり、`POST /api/fire` のHTTP応答が「発話完了 or 中断」まで
  遅延する）: `cockpit-server.mjs:671` の `await fireOrchestrator.fire()` を自分で確認。
  `processAskedReply` は `speak()` 後、`durationMs`（自然完了）または `interrupt()` の resolve まで
  `await new Promise` で待つ（`fire-orchestrator.mjs:333-352`）ため、claim どおり HTTP 応答が遅延する
  設計変更は実装と一致している。これは「実行していない数字」ではなく設計上の事実の記述であり、
  Domain D への正当な申し送り（§質問1）として扱う。

---

## §質問（domain-b.md §8）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | `fire()` が再生実区間を await（HTTP応答の意味変化） | **non-blocking**。wave-plan §3 Domain B は「再生実区間の追跡」を明示的に要求しており、speaking window を正しく保つ実装の必然的帰結。HTTP応答遅延という UX 判断は Domain D の操縦席領分として正しく申し送りされている。機械テストは全 fake `wavDurationSec:0` のため無退行（自分でも確認: 既存テストは speaking→completion が0msで閉じるため観測差なし）。 |
| 2 | 機械弁窓(200ms)とセグメンタ speechCancel タイミングの相互作用 | **non-blocking**。wave-plan §2 裁定2「誤爆は起きてよい失敗」の範囲内。両定数は独立のv0コード内定数として明記されており、連動設計は根拠が要る変更として正しく先送りされている。 |
| 3 | 切断点算出を時間比でなくモーラ割合で採用 | **non-blocking**。inventory §2/§3-3 の設計意図（母音オンセットが最も真な信号）と一致し、§3の3保守化で過大評価しない側に倒す実装をテストで固定済み。実人声での精度は人間ゲートの領分として正しく開示。 |
| 4 | 中断注記は接頭辞0文字でも付く | **non-blocking**。append-only の下で「遮られた事実を常に残す」という設計選択は wave-plan §2「切断点の正直記録」の趣旨に反しない。UXの煩さの調整は人間ゲート後の裁量。 |
| 5 | 口閉じの見え方は実器目視が必要 | **non-blocking（想定どおりの分業）**。この Domain は全 fake（wave-plan §1 人間ゲート①の対象）であり、「sendSet が正しい payload で1回飛ぶ」までを検証する責務分担は正しい。 |
| 6 | cockpit-server の barge-in 結線に専用機械テストなし | **non-blocking**。核心（機械弁・切断点・interrupt）は純部品/orchestrator側で全fake縦検証済み（`fire-orchestrator.test.mjs` の結線テスト2本がVAD→gate→interruptの縦串を固定）。結線層自体は「onVadEvent→gate.handle」の薄い糸のみで、既存cockpit-serverテスト（実orchestrator縦貫通含む）の全緑で無退行を担保する設計は、domain-a.md/domain-b.md 系列で一貫した手口（blocking基準4は「全fake縦検証」を核心ロジック側に要求しており、結線層固有のテストまでは要求していない）。 |

---

## blocking / non-blocking の分離

### blocking（wave-plan §4）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約JSON・lockfile完全不変・新規依存ゼロ・手動Fire/視覚発火/S1〜S5無退行（soul追記タイミングのみ意図変更） | PASS | git diff --stat 群すべて出力ゼロ・新規importなし（Node組み込みのみ）。soul追記タイミング変更はテストで明示固定・他は無変更。 |
| 2. 3チェック無退行・実マイク/録音物非使用 | PASS | domain-b.md §7 の記述（check:deps/soul-zone/source 全passed・source唯一の違反は器側pre-existing・本Domainのgit diffで不変確認済み）を自分でも見た `git diff --stat` の空出力で裏付け。全fake・無音の実装であることをテストコード（fake timer/fake channel/fake player）で確認。 |
| 3. スケジューラ（Domain C領分）該当なし | N/A | Domain Bはスケジューラを実装しない。 |
| 4. barge-in経路の全fake縦検証・切断点記録の正直性・append-only維持 | PASS | 項目1・2で詳述。境界テスト10本+縦検証2本+中断/完了/no-op/rejected/dispose 5本で固定。 |
| 5. SDK実消費上限5ask | PASS | Domain Bは実SDKを一切呼んでいない（session はテスト内でfake固定・cockpit本番結線もDomain Bは追加していない）。 |
| 6. 終了処理・タイムアウト | PASS | `interrupt`はspeaking中でなければ冪等no-op・dispose後も安全（:1109-1132で固定）。`bargeInGate.dispose()`はcockpit-server `close()`で呼ばれタイマを畳む（:870-877）。 |

### non-blocking

- domain-b.md §8 の6件の§質問（上表参照）——いずれも設計裁量またはDomain C/D・人間ゲートへの正当な申し送り。
- `git diff --stat` の行数実測がclaimの数字と数行前後する（fire-orchestrator.mjs等）。方向・桁は一致し
  コメント量の差程度のずれ。捏造ではないが、今後の成果物では実行直前の生出力をそのまま転記することを
  推奨。

---

## Orch への申し送り

- spec レーンとして S6 Domain B は wave-plan §3 Domain B・inventory §2/§3-3/§4-1/§5 の要求を逐条で満たす。
  barge-in機構(機械弁+3手順)・切断点の正直記録(append-only)・口停止の契約内既存意味論限定・結線の薄さ
  ・成果物の主張の正直性、いずれも自分でソース・契約JSON・reference-driver・器の
  `control-channel-overlay-store.ts`/`speech-timeline-state.ts` を読み比べて確認した(Gnomeの説明への
  依存を避けるための最も強い検証)。
- 器側の「mouth-openへのintent.setがspeechタイムラインを強制releaseする」という既存意味論の存在は、
  器コード自体を読んで実在を確認済み(inventory §2の記述は正確)。
- `fire()`のHTTP応答遅延(§質問1)はDomain Bの必然的帰結であり、Domain DのUX裁定待ちとして正しく
  切り出されている。Domain Bのスコープ外。
- 残る不確実性(実マイクでのspeechStart反応・口閉じの実機の見え方・照合集合の実人声命中率)はすべて
  人間ゲート/Domain C・Dの領分として正しく開示されている。
