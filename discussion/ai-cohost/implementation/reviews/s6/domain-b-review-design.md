# S6 Domain B レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-13。対象: `apps/soul/agent`（S6 Domain B「barge-in・会話が続く」実装）。
> 総合判定: **PASS-with-nonblocking**。blocking なし。

観点は wave-plan §2・§3 Domain B・§4 blocking 基準／inventory §2・§3-3・§5／Gnome 成果物 domain-b.md（§3 切断点写像・§4 追記タイミング・§8 質問）／器契約 `channel-intent-set-payload-schema.json` に対する適合。design レーンの 6 観点（①器/契約/lock 不変 ②口停止が契約内既存意味論のみ ③append-only+二重 append なし ④状態機械の健全性 ⑤event loop 安全 ⑥「いつ喋るか」に LLM ask 経路が存在しないこと）を、自分でファイルを読み・自分でコマンドを実行して確認した（Gnome の報告値を転記していない）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' pnpm-lock.yaml apps/soul/agent/package.json
```
→ **出力なし・EXIT=0**（器コード・契約ディレクトリ配下 JSON・pnpm-lock.yaml・apps/soul/agent/package.json すべて完全不変）。

```
node scripts/check-soul-zone-boundary.mjs
```
→ `Soul zone boundary guard passed: 1339 source files scanned; no 器→魂 imports and no 魂→器 code imports.`・**EXIT=0**。

```
cd apps/soul/agent && node --test 2>&1 | tail -20
```
→ 全緑・ハングなくプロンプト復帰。生数字:
```
# tests 452
# suites 0
# pass 452
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1136.8534
```
EXIT=0（`node --test` の終了コード）。Gnome 報告の総数 452 と一致。event loop リーク（テストランナーのハング）は観測されなかった。

---

## 1. 器/契約/lock 不変（最重要 blocking）— PASS

- 上記 §0 の `git diff --stat` が空。器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON（`apps/runtime-player/src/main/control-channel/contract/**`）・`pnpm-lock.yaml`・`apps/soul/agent/package.json` は 1 バイトも変わっていない。
- 新規依存ゼロを自分でコードから裏付けた:
  - `src/mind/barge-in.mjs`: import 文ゼロ（依存ゼロ・I/O ゼロの純部品）。
  - `src/mind/fire-orchestrator.mjs` の import（82-92 行）は既存モジュール（`../voice/speak.mjs`・`./fire-injection.mjs`・`./expression-parser.mjs`・`./expression-translator.mjs`・`../eyes/window-capture.mjs`）と新規同ゾーンの `./barge-in.mjs` のみ。Node 組み込み・外部パッケージの新規追加なし。
- 魂ゾーン境界 guard pass（§0）。`barge-in.mjs` は魂ゾーン内であり器↔魂の越境 import を生んでいない。

## 2. 口停止が契約内の既存意味論のみ（blocking）— PASS

sendSet が送るワイヤ（`channel-client.mjs` 199 行）:
```
socket.send(JSON.stringify({ v: 1, id, kind: "intent.set", payload }));
```
`payload` は 190-194 行で `{ slotId, value }`（`ttlMs` は `intent.ttlMs !== undefined` のときだけ載せる）。barge-in が渡す実引数は `interrupt()` 内（427-431 行）で `{ slotId: MOUTH_CLOSE_SLOT_ID(="mouth-open"), value: 0, ttlMs: 400 }`。

器契約 `channel-intent-set-payload-schema.json` との厳密突き合わせ:
- `kind`: 既存の `intent.set`（S6 で kind を新設・捏造していない。器は C5 から広告済み）。**停止専用 kind の捏造なし**。
- `slotId: "mouth-open"`: スキーマ enum（13-30 行）に含まれる。
- `value: 0`: `type: number`。`normalizedRanges.mouth-open` = `{min:0, max:1}` の域内（0=閉口）。域外クランプの捏造なし（契約どおり 0 は valid）。
- `ttlMs: 400`: `exclusiveMinimum: 0` を満たす（400>0）。指定時のみ payload に載る＝省略経路も契約の「omitted = 器既定窓」に整合。
- `required: ["slotId","value"]` / `additionalProperties: false`: payload は `{slotId, value, ttlMs?}` のみで余剰キーなし＝適合。

「口を閉じる」は停止専用の新意味論ではなく、既存 `mouth-open` スロットへ value=0 の intent.set を送って speech タイムラインを強制 release する **契約内の既存意味論の流用**（barge-in.mjs 39-44 行の設計コメントと一致）。ws-double 側 `onSet`（`test-support/ws-double.mjs` 155・162 行）は intent.set を speech/envelope と並んで扱う additive 追加で、未知 kind 拒否経路（183 行〜）は残置＝無退行。

## 3. append-only + 二重 append なし（blocking）— PASS

1 発話 = soul 1 エントリを、コードで追って確認した。append は 2 経路にしか存在しない:

- **自然完了**: `processAskedReply` 末尾 385 行 `buffer.append({...text: speechText, speaker:"soul"})`（全文）を 1 回。
- **barge-in 中断**: `interrupt()` 465 行 `pb.buffer.append({...text: soulText, speaker:"soul"})`（`soulText = cut.prefix + BARGE_IN_NOTE`）を 1 回。

**二重 append を防ぐガードを実コードで確認**:
- `interrupt()` は先頭で `pb.interrupted = true` を立て（407 行）、自然完了タイマを `clearTimeoutImpl` で解除（409-412 行）。
- 自然完了タイマのコールバックは `if (currentPlayback === pb && !pb.interrupted)` のときだけ resolve（345-350 行）。interrupt 後は `pb.interrupted===true` のため発火しても no-op＝二重 resolve しない。
- interrupt が resolve した後、`processAskedReply` の `completion.interrupted` 分岐（368-381 行）は **append せず** 戻る（「二重 append しない（append-only 維持）」のコメントどおり）。全文 append（385 行）に到達するのは `!completion.interrupted && !completion.disposed` の自然完了のみ。
- 上書き・削除は存在しない（`append` のみ・`splice`/index 代入なし）。「遮られた事実」は上書きではなく接頭辞＋`BARGE_IN_NOTE`（"…（遮られた）"）の追記で表現＝append-only 維持。

`charsSpoken=0`（発話ごく直後の中断）でも `"…（遮られた）"` の 1 行を積む設計（domain-b.md §8-4 の申し送り）。append-only 上は正当（削除・上書きなし）で、注記のみ行の是非は人間ゲート裁量＝non-blocking。

## 4. 状態機械の健全性（blocking）— PASS

- **speaking が実再生区間を覆う**: `processAskedReply` は setState("speaking")（307 行）後、`completion` Promise（333-352 行）で `wavDurationSec` 完了タイマ or `interrupt()` のどちらかまで await する。speak() の play() 送出直後に idle へ抜けていた S5 以前と異なり、speaking window が実再生尺を覆う（inventory §3-3 の回収）。
- **interrupt の no-op 冪等**: `if (!pb || pb.interrupted)` で `not-speaking`（idle/thinking で currentPlayback=null）/`already-interrupted`（連続 interrupt）を no-op 返し（403-406 行）。二度目以降の interrupt は append を増やさない。
- **dispose 安全**: `dispose()`（622-634 行）は発話中なら `pb.interrupted=true`・timer clear・`pb.resolve({interrupted:false, disposed:true})`。`processAskedReply` の `completion.disposed` 分岐（363-366 行）は append せず `reason:"disposed"` で畳む＝dispose 時に soul を積まない・await を残さない。
- **busy 中 fire 無視**: `fire()` は `if (state !== "idle")` で busy return（568-571 行）。speaking が実再生区間を覆うようになった結果、再生中の 2 発目 fire は busy で無視される（domain-b.md §4-1 の意味変化を確認）。キューはしない＝取りこぼしはあるが状態機械は詰まらない。
- **競合（interrupt 直後の完了タイマ／連続 interrupt）**: interrupt が timer clear＋interrupted フラグを先に立てるため、タイマ側ガード（347 行）と二重 resolve 防止が成立。デッドロック・リークに至る経路は読めなかった。

## 5. event loop 安全（blocking）— PASS

- **完了タイマ全解除**: 自然完了経路（357-360 行 `clearTimeoutImpl`）・interrupt 経路（409-412 行）・dispose 経路（628-631 行）のいずれでも timer を clear し `timer=null`。張りっぱなしになる経路は読めなかった。
- **gate 待機タイマ全解除**: `createBargeInGate` は `dispose()` で `clearPending()`（202-205 行）、confirm 発火時・speechCancel 時・speechStart 張り替え時も `clearPending`/`pending=null`（167-173・186-195 行）。
- **結線層で確実に解除**: `cockpit-server.mjs` `close()` は `bargeInGate.dispose()` → `fireOrchestrator.dispose()` を冪等に呼ぶ（870-880 行）。
- **決定論化**: 完了タイマは `setTimeoutImpl`/`clearTimeoutImpl` 注入（fire-orchestrator 146-147・173-174 行）、gate は `setTimeoutImpl`/`clearTimeoutImpl` 注入（barge-in 148-149・158-159 行）で fake timer 化されている。
- 実測として `node --test` 452 本がハングせずプロンプト復帰（§0）＝テストランナーに残留ハンドルが漏れていない裏付け。

## 6. 「いつ喋るか」に LLM ask 経路が存在しない（blocking）— PASS

- barge-in 判定経路に `session.ask` は一切現れない。判定は `createBargeInGate`（機械弁・注入 timer のみ・時計を持たない）と、`cockpit-server.mjs` の `onVadEvent`（VAD 機械信号 speechStart/Cancel/End）→ `bargeInGate.handle(e)`（493-504 行）だけ。
- gate の `onConfirm` は `void fireOrchestrator.interrupt()` を直接呼ぶだけ（cockpit-server 828-838 行）。ここに LLM 問い合わせは無い。
- `interrupt()` 本体（401-484 行）に `session.ask` 呼び出しは無い（stop/sendSet/computeSpokenPrefix/append/diagnostic のみ）。
- fire-orchestrator で `session.ask` を呼ぶのは `fire()`（600 行）・`fireVision()`（545 行）＝**発話内容の生成**経路のみで、barge-in / interrupt のタイミング判定には一切絡まない。「いつ喋るか（＝いつ止めるか）」は機械信号だけで決まる設計になっている。

---

## 7. blocking / non-blocking の総括

**blocking 指摘: なし。** 器/契約/lock 不変・口停止が契約内既存意味論のみ・二重 append なし・append-only 破壊なし・event loop リーク（ハング）なし・状態機械のデッドロックなし・LLM-in-timing 経路の不在、すべて確認済み。

**non-blocking（設計裁量・人間ゲート／後続 Domain 領分・design レーンとしては不問）**:
1. `fire()` が再生実区間を await するようになり POST /api/fire の HTTP 応答が発話尺だけ遅れる（domain-b.md §8-1）。UX 裁定（早期 resolve の Design Y か）は Domain D の操縦席 UX と合わせて Orch/人間ゲートで決める事項。機械テストは全 fake が `wavDurationSec:0` のため無退行。
2. 機械弁窓 200ms と耳セグメンタの speechCancel タイミングの相互作用（§8-2）。独立定数のままで妥当。連動が要ると分かってから根拠付きで足す方針に同意。
3. 切断点算出が「時間比」ではなく「始まった voiced モーラ割合 × 全文長」の近似（§8-3）。§3 の 3 保守化（厳密不等号 `<`・floor・オンセット基準按分）で過大評価しない側へ倒しており設計として健全。実人声のズレは人間ゲート観測領分。
4. `charsSpoken=0` でも注記のみ行を積む（§8-4）。append-only 上は正当。注記のみ行の煩わしさは人間ゲート裁量。
5. 実器での口閉じの見え方（release の自然さ・声停止と口閉じの体感ズレ）は全 fake ゆえ未検証（§8-5）。「sendSet が正しい payload で 1 回飛ぶ」までは本レーンで確認済み。
6. cockpit-server の barge-in 結線に専用機械テストなし（§8-6）。核心は純部品/orchestrator 側で全 fake 縦検証済み・結線は薄い糸で既存 cockpit-server テスト全緑により無退行担保、という切り分けは design 上妥当。end-to-end は人間ゲート/Domain D 領分。

## 8. §質問（Orch への申し送り）

design レーンとして blocking を止める疑義はない。以下は裁定を Orch/人間ゲートへ委ねる点の再掲（本レーンでは合否に影響させない）:

- Q1. `fire()` の await 化（§8-1）は Domain D の操縦席 UX（発火ボタンの応答体感・measure-fire の意味）と結合する。design 適合上は問題ないが、UX として Design Y（早期 resolve・再生追跡を裏で回す）へ倒すか否かは Orch/人間ゲートの裁定事項。本レーンは「現状の await 設計が状態機械・append-only を破壊していないこと」までを保証する。

以上。判定 **PASS-with-nonblocking**（blocking なし）。
