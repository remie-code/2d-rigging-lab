# S6 Domain B レビュー（test レーン）

> レーン: **test**（barge-in 経路が全 fake で決定論的に縦検証されているか・切断点の正直性・S3/S5 無退行）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（S6 Domain B 実行責任者）。
> 対象: `apps/soul/agent`（`node --test`）／`src/mind/barge-in.mjs`・`barge-in.test.mjs`・`fire-orchestrator.mjs`・
> `fire-orchestrator.test.mjs`・`src/channel/channel-client.test.mjs`。日付: 2026-07-13。
> 読み取り専任・自分で再実行した生数字を根拠にする。install/commit/器コード変更は一切実行していない。
> 総合判定: **PASS**（blocking ゼロ・non-blocking 3 件は軽微観察）。

## 0. 自分で再実行した `node --test` 生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s 付き・1 回で緑・空/interrupted なし・再試行不要）:

```
1..452
# tests 452
# suites 0
# pass 452
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1221.817
```

`cd apps/soul/agent && node --test src/mind/barge-in.test.mjs src/mind/fire-orchestrator.test.mjs src/channel/channel-client.test.mjs`（対象 3 ファイルのみ）:

```
1..70
# tests 70
# suites 0
# pass 70
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 467.365
```

- domain-b.md §9 の Claim（tests 452 / pass 452 / fail 0 / S6 Domain A 後ベースライン 425→452）と自分の実行結果が**完全一致**。
- 3 ファイル本数 17（barge-in）+ 39（fire-orchestrator）+ 14（channel-client）= **70**（自分で `test(...)` 出現行を数えて照合。内訳は §1）。skipped 0 / todo 0 のため緑の偽装は無い。

## 1. 実行と数字の一致・内訳照合 — **PASS**

- `src/mind/barge-in.test.mjs`: `test(...)` 出現を数えると定数 1 + computeSpokenPrefix 10 + createBargeInGate 6 = **17 本**（Claim と一致）。新規ファイル。
- `src/channel/channel-client.test.mjs`: 既存 11 本（sendSpeech accepted/rejected ×1/supportedKinds throw ×2/sendEnvelope accepted・rejected/hello timeout/大きな timeline/未知イベント/応答前切断/redactToken）+ 新規 3 本（sendSet accepted・ttlMs 省略・rejected）= **14 本**（Claim と一致）。
- `src/mind/fire-orchestrator.test.mjs`: 既存 32 本（L43〜L862、S3〜S5）+ 新規 7 本（L950〜L1177: 中断縦検証／自然完了タイミング固定／no-op 冪等／口閉じ rejected 握り／dispose 中断／gate 結線縦検証／スパイク取消）= **39 本**（Claim と一致）。
- 合計 17+14+39=70、425+27=452 で自分の実行結果と整合。

## 2. 切断点の正直性テスト（最重要・blocking 基準 4） — **PASS**

`barge-in.test.mjs` の `computeSpokenPrefix` 境界テストを全数個別に確認した:

| 境界 | テスト | 結果 |
|---|---|---|
| 経過0 | L75-79「経過0 は何も出ていない」 | charsSpoken=0・prefix="" |
| 経過が負 | L81-85「下限で保守側」 | charsSpoken=0（負でも溢れない） |
| 最初のオンセット丁度 | L87-92「厳密不等号・まだ音になっていない」 | startedMoras=0・charsSpoken=0（`<` の非等号側を直接突く境界値） |
| 途中経過 | L94-100「過大にならない・floor」 | elapsedMs=350→3要素→"こんに"（3/5 の floor が正しく効く） |
| 最後のオンセットを厳密に過ぎた | L102-107「経過≥全長=全文」 | elapsedMs=501→charsSpoken=5=全文 |
| **最後のオンセット丁度** | L109-115「まだ全文でない」 | elapsedMs=500（=timeline最終要素と同値）→charsSpoken=4（**全文にしない**。過大評価を防ぐ最も鋭い境界を直接固定） |
| 文字数>モーラ数 | L117-133「単調非減少・floor 上限」 | 25ms 刻みで elapsed=0〜700 を全数走査し単調非減少+上限を確認・全経過超で全文=10 |
| 空 timeline・空文字 | L135-138 | 両方とも 0 文字 |
| timeMs 非数の要素 | L140-150「成功を捏造しない側」 | 汚染要素 `"x"` を混入させ、無視されることを直接確認（2/3 の計算） |
| 不正入力 | L152-156 | speechText 非文字列・timeline 非配列・elapsedMs=NaN の 3 パターンで throw を確認 |

- 特に「最後のオンセット丁度ではまだ全文でない」（L109-115）は、`timeMs < elapsedMs` の厳密不等号が実際に効いていることを**等号側の値そのもの**で突いており、過大評価を許す実装（`<=` への劣化）が混入すれば直ちに fail する強い固定。
- 実装（`barge-in.mjs` L109-125）を読み、テストの期待値がコード上の分岐（`elapsedMs<=0`／`t<elapsedMs`／`floor`／`charsSpoken>textLen` クランプ）と 1 対 1 で対応していることを確認した。過大評価を許す穴は見当たらない。

## 3. barge-in 縦検証（全 fake 決定論・blocking 基準 4） — **PASS**

`fire-orchestrator.test.mjs` の新規 7 本（L950-1177）を個別に確認:

1. **中断**（L950-1016）: `orch.fire()` → speaking 到達 → `interrupt(1350)` で `player.stop` 1 回・`channel.sendSet({slotId:"mouth-open",value:0,ttlMs:400})` 1 回・soul 追記が「こんに」+ 注記の 1 エントリ・`bargeIn` 診断（elapsedMs/charsSpoken/totalChars/prefix）・状態遷移 `["thinking","speaking","idle"]`・二度目の interrupt が no-op（buffer 長不変）を全て assert。
2. **自然完了のタイミング固定**（L1018-1057）: `wavDurationSec:2` の fake で、speaking 到達直後は `buffer.all().length===1`（soul 未追記）を確認 → `timers.advance(2000)` で初めて全文が積まれることを確認。S3〜S5 の「speak 直後 append」との差分が可視化されている。
3. **interrupt no-op（idle 時）**（L1059-1075）: 発話していない状態で `interrupt` を呼び `reason:"not-speaking"`・`stop` 未呼び出しを確認。
4. **口閉じ rejected でも中断継続**（L1076-1108）: `sendSet` が rejected を返しても `stop` は呼ばれ・接頭辞+注記は soul に積まれ・`bargeInMouthCloseRejected` 診断が出ることを確認。
5. **dispose 中断**（L1109-1133）: 再生中に `dispose()` すると `fire()` の await が `{fired:false, reason:"disposed"}` で解放され、soul 追記なし・dispose 後の interrupt も no-op。
6. **gate 結線縦検証**（L1135-1176）: `createBargeInGate` を実際に使い、`speechStart` → 機械弁 200ms 経過 → `onConfirm` → `orch.interrupt(...)` という VAD → gate → interrupt の縦串を確認（結線層の再現）。
7. **スパイク取消**（L1177-終端）: `speechStart` 後、窓内（150ms 経過時点）で `speechCancel` → `interruptCount===0`・`stop` 未呼び出し → 自然完了で全文が積まれることを確認。「barge-in を確定させない」経路が実際に interrupt を呼ばないことを直接検証している。

- 全テストが `makeFakeTimers()`（手動 advance 式・`barge-in.test.mjs` と同型の決定論タイマ）・`makeBargeSpeak`（fake speakImpl・timeline/wavDurationSec/playbackStartedAtMs を返すのみ）・`makeBargeChannel`（fake sendSet）・`makeStopPlayer`（fake play/stop）を使い、実マイク・実時計・実 SDK・実乱数への依存が無いことをコードで確認した（`grep` で `Math.random`／`Date.now` の直接使用が無いことも該当ファイル内で確認）。
- busy 判定（`state !== "idle"` の 1 行）自体は S3 から不変であり、speaking window が実再生区間を覆うよう伸びたことで「再生中の 2 発目 fire は busy で無視される」という新しい振る舞いが論理的に生じるはずだが、**この新しい speaking window に対する明示的な busy 拒否テストは新規 7 本に含まれていない**（既存の busy テスト L355-392 は thinking 状態のみを検証）。ロジック自体は不変なので実害は薄いと判断したが、§ non-blocking に記載する。

## 4. append-only + 1 回 append の固定 — **PASS**

- 中断ケース（L950 テスト）: `buffer.all().length` が you(1件) + soul(1件) = 2 であることを assert しており、`processAskedReply` の `completion.interrupted` 分岐が二重 append しない設計（コード L368-381 のコメント「ここでは二重 append しない」）をテストが実測で裏付けている。もし実装にバグが混入して 2 回 append されれば `length===2` の assert が直ちに fail する検知力がある。
- 自然完了ケース（L1018 テスト）も同様に `length===2` を assert。
- dispose ケース（L1109 テスト）は `length===1`（soul 追記なし）を assert。
- 二度目の interrupt（no-op）でも `buffer.all().length` が増えないことを直接 assert（L1015 付近）。
- 4 パターンとも soul append 回数をバッファ長という観測可能な形で固定しており、「1 発話 = soul 1 エントリ」の担保は実効性がある。

## 5. S3/S5 無退行 — **PASS**

- `git diff -- apps/soul/agent/src/mind/fire-orchestrator.test.mjs` を自分で実行し、既存部分（L1-862、S3〜S5 の 32 本）への変更が **import 1 行の追加のみ**（`createBargeInGate, BARGE_IN_NOTE, MOUTH_CLOSE_TTL_MS` の import）であり、既存テストの期待値・アサーション本体は 1 バイトも変更されていないことを diff の hunk（`@@ -859,3 +860,363 @@` の 1 箇所のみ）で確認した。
- `git diff -- apps/soul/agent/src/channel/channel-client.test.mjs` も同様に確認し、既存 11 本（`@@ -146,6 +146,63 @@` の 1 箇所のみ）は無変更・新規 3 本の追記のみ。
- `git diff -- apps/soul/agent/src/test-support/ws-double.mjs` を確認し、`onSet` オプションの追加が additive（既定 accepted）であり、`intent.speech`/`intent.envelope` 以外を拒否していた既存の unknownKind 経路（未知 kind テスト L240-266）には手を入れていないことを確認（`if` 分岐に `intent.set` を additive に追加しただけ）。
- `git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json` を自分で実行し、出力なし（器コード・契約 JSON・lockfile・依存完全不変）を確認。
- soul 追記タイミング変更（S3 からの意図的差分）が「0 尺 fake の既存テストでは観測差が出ない」という domain-b.md §4-2 の主張は、既存テストが `makeFakeSpeak()` で `wavDurationSec: 0` を返す fake（L21）であること・タイマの 0ms 発火が `await orch.fire()` の中で自然に解決される実装（`setTimeoutImpl(...,durationMs)` で `durationMs=0`）であることをコードで確認し、妥当と判断した。
- 手動 Fire（既存 32 本のうち通常 Fire 系）・視覚発火（`fire({vision:true})` 系 L587-859）のテストは上記 diff により無変更で全緑（452/452 に含まれる）。

## 6. ハング・終了処理 — **PASS**

- `node --test`（全体・タイムアウト300s）が 1 回で緑・`duration_ms 1221.817` で正常終了、プロンプト復帰を確認。event loop リークやハングは観測されなかった。
- 対象 3 ファイル単体実行も 1 回で緑・`duration_ms 467.365`。
- barge-in.mjs の `createBargeInGate` は `dispose()` で `clearTimeoutImpl` によりタイマを畳む設計であり、`barge-in.test.mjs` の dispose テスト（L240-257）が `timers.pending()===0` を直接 assert している（real timer ではなく fake timer 管理だが、実装が real `setTimeout`/`clearTimeout` を既定注入として使うため、dispose を怠ればプロセスが残ることをこのテストが間接的に担保している）。
- fire-orchestrator の `interrupt`/自然完了タイマも `clearTimeoutImpl` で解除される設計で、dispose 時の解放（L1109 テスト）も確認済み。実 SDK・実マイク・実 PowerShell を呼ぶコード経路は該当 3 ファイルに存在しない（grep で `child_process`／`spawn`／`WebSocket`（実 undici 差し替えなし）等が無いことを確認。channel-client.test.mjs は `MinimalWebSocket` という自前実装を注入しており、実ネットワーク越しではなく localhost の実 TCP loopback のみ使用）。

## non-blocking（軽微観察・修正不要）

1. **speaking window（新しい再生実区間）に対する明示的な busy 拒否テストが無い**: 既存の busy テスト（`fire-orchestrator.test.mjs` L355-392）は thinking 状態中の 2 発目 fire 拒否のみを検証しており、S6 で新設された「speaking（実再生区間）中の 2 発目 fire も busy で無視される」という新しい振る舞い（domain-b.md §4-1 に明記）を直接固定する新規テストは無い。`state !== "idle"` の判定ロジック自体は不変なので実害は低いと判断したが、次ドメイン（C/D）が busy 判定まわりを触る際にリグレッションを静かに通す余地がある。
2. **`computeSpokenPrefix` の timeline 要素が `null`/`undefined` 自体（配列要素そのもの）を直接突くテストが無い**: 「timeMs が数でない要素は数えない」テスト（L140-150）は `timeMs: "x"` という汚染値のみで、要素自体が `null`（コード L116 の `m == null ? undefined : m.timeMs` 分岐）は未検証。実装コードで安全に処理されることは確認したが、直接のテストケースはない。
3. **「文字数>モーラ数」テスト（L117-133）の上限 assert が実装式のトートロジー気味**: `r.charsSpoken <= Math.floor((r.startedMoras/5)*10)` という assert は実装の計算式をそのまま再計算しており、独立したオラクルではない。単調非減少・elapsed=0で0・全経過超で全文の 3 点は独立した検証だが、上限 assert 自体の検知力は限定的。

## 総合判定

**PASS**（blocking ゼロ）。自分で実行した生数字 452/452/0（全体）・70/70/0（対象3ファイル）は domain-b.md の Claim と完全一致・いずれも 1 回で緑・ハングなし。内訳（17+14+39=70、425+27=452）を自分で数えたテスト実数と照合し一致。

切断点の正直性（blocking 基準 4 の心臓）は `computeSpokenPrefix` の全境界（経過0/負・最初/最後のオンセット丁度・途中・文字数>モーラ数・空入力・非数混入・不正入力）を個別テストで固定しており、特に「最後のオンセット丁度ではまだ全文でない」という最も鋭い境界（厳密不等号の等号側）を直接突いている点で過大評価を許す穴は見当たらない。barge-in 縦検証は中断・自然完了タイミング・no-op 冪等・口閉じ rejected 握り・dispose 中断・gate 結線・スパイク取消の 7 本すべてが全 fake（fake timer/speak/channel/player）で決定論的に固定されており、append-only + 1 回 append はバッファ長という観測可能な形で検知力を持って担保されている。S3/S5 無退行は git diff で既存テストが追加のみ（期待値変更ゼロ）であることを直接確認し、器コード・契約 JSON・lockfile 不変も確認した。

non-blocking 3 件（speaking window の busy 拒否テスト不在・timeline null 要素の直接テスト不在・文字数>モーラ数テストの上限 assert のトートロジー気味な点）はいずれも blocking 基準に抵触せず、修正不要の軽微観察として記載した。

## §質問（Orch への申し送り）

1. non-blocking 1（speaking window の busy 拒否）は、Domain C（発火スケジューラ）が busy 判定を消費する際に前提とする挙動なので、Domain C 着手前に 1 本テストを足す価値があるかもしれない。ロジック自体は既存不変ゆえ blocking にはしていないが、念のため申し送る。
2. domain-b.md §8 の§質問1（`fire()` が再生実区間を await するようになったことによる HTTP 応答レイテンシの意味変化）は design/spec レーンの領分と考え、test レーンでは検証していない（機械テストは全 fake `wavDurationSec:0` のため無退行、との Claim はコードで確認済み）。
