# S8 Domain A レビュー — test 適合レーン

> レビュアー: Review-Sylph（test 適合レーン・読み取り専任）
> 対象: `apps/soul/agent/src/mind/fire-orchestrator.test.mjs` 末尾「S8『キルスイッチ』」節（新規9件）・`fire-orchestrator.mjs`・`barge-in.mjs`
> 判定基準: [s8-wave-plan.md](../../orchestration/s8-wave-plan.md) §Domain A 機械テスト列挙、Gnome 報告 [domain-a.md](../../waves/s8/domain-a.md)

## 判定: **合格**

## 1. 独立再実行の生集計

`apps/soul/agent` を cwd に `node --test` をフルスイート実行（自分で再実行、Gnome 報告の数字を鵜呑みにしていない）。

```
1..738
# tests 738
# suites 0
# pass 738
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1845.2278
```

ベースライン 729 + 新規 9 = 738、一致。Gnome 報告の集計と同一。

## 2. 要件×テスト対応表

wave 計画 §Domain A が列挙する機械テスト要求（6項目）と、追加された9件の対応関係。テスト名だけでなく assert 内容を実読して確認した。

| # | 計画の機械テスト要求 | 対応テスト（行番号は `fire-orchestrator.test.mjs`） | 判定 |
|---|---|---|---|
| 1 | idle 中キル → fire() が reason:"killed" で弾かれる・speakImpl 不呼び出し | `kill: idle 中キルは fire() を reason:'killed' で弾く`(:24-47) — `result.reason==="killed"`・`fakeSpeak.spoken.length===0`・`onFire({accepted:false,reason:"killed"})` を直接 assert | ✓ |
| 2 | 再生中キル → player.stop 呼ばれ・口閉じ（mouth-open value 0）・soul に prefix+KILL_NOTE が1回・diagnostic type:"kill" | `kill: 再生中キルは声を止め...`(:49-105) — `pl.calls.stop===1`・`ch.sets[0]` を `{slotId:"mouth-open",value:0,ttlMs:MOUTH_CLOSE_TTL_MS}` と `deepEqual`・`buffer.all()[1].text==="こんに"+KILL_NOTE`（1件のみ）・`diags.find(type==="kill")` に加え `!diags.some(type==="bargeIn")` も明示 assert | ✓ |
| 3 | ask 待ち中（in-flight）キル → speakImpl 不呼び出し・soul 追記なし・diagnostic killDiscarded・破棄本文が診断/戻り値に出ない | `kill: ask 待ち中（in-flight）にキルすると...`(:107-150) — `fakeSpeak.spoken.length===0`・`buffer.all().length===1`（追記なし）・`Object.keys(discardDiag)` が `["type"]` のみと `deepEqual`・`!JSON.stringify(diags).includes("こっそり")` と `!JSON.stringify(result).includes("こっそり")` を直接 assert（秘匿の直接検証） | ✓ |
| 4 | revive 後の発火復活（fired:true・speakImpl 呼ばれる・残留なし） | `revive: 再生中キル後に revive...`(:152-197)（`interrupted` 汚染なし・busy 固着なしを状態遷移で確認・`speak.spoken.length===2`）／`revive: idle キル後に revive...`(:199-220)（簡易版） | ✓ |
| 5 | manual/視覚/自発 preferred すべて弾かれる（session.ask/captureImpl/speakImpl 不呼び出し） | `kill: manual fire()・fire({vision:true})・fire({vision:"preferred"}) の全経路がキルで弾かれる`(:222-255) — 3種の fire 呼び出し全ての `reason==="killed"`・`askCalled===false`・`capture.calls.length===0`・`fakeSpeak.spoken.length===0` | ✓ |
| 6 | 耳系（transcript-buffer 等）無影響 | `kill: 耳系（transcript-buffer）に無影響`(:277-296) — kill 後に `buffer.append()` が `appended:true` を返し、要素が積まれることを確認 | ✓ |

計画に明記のない追加2件:

| 追加テスト | 妥当性 |
|---|---|
| `kill: born-killed（initialKilled:true）は生成直後の fire() から reason:'killed'`(:257-275) | wave 計画 §2「キル中に遅延生成される orchestrator はキル済みで生まれる」・blocking レビュー基準1の「特に『キル中に遅延生成された orchestrator』の漏れ」を裏付ける必須観点。計画 §3 の列挙には明記がないが §2/§4 の要求を満たすために必要で、範囲逸脱ではない。 |
| `kill/revive: 冪等・no-op`(:298-326) | 二度 kill・非 speaking 中 kill の severance no-op・非 killed の revive no-op を確認。堅牢性の裏付けとして妥当な補強。 |

6項目すべてに対応するテストがあり、未カバーの要求はない。

## 3. テスト品質の所見

- **(a) 決定論性**: 実 TTS・実ネット・実タイマは一切使わず、`makeFakeSpeak`/`makeBargeSpeak`/`makeBargeChannel`/`makeStopPlayer`/`makeFakeTimers`/`makeFakeCapture`/`deferred`/`bufferWithYou`/`flushMicrotasks` という**既存の**ヘルパーをそのまま再利用している（新規ヘルパー追加はゼロ）。新規テストが独自の疑似乱数やタイマを持ち込んでおらず、既存の縦貫通テスト群と同じ決定論的基盤に乗っている。`makeFakeTimers`（`:1177` 付近で定義済み）による `advance()` 注入で「自然完了」を制御しており、実 `setTimeout` 待ちは発生しない。
- **(b) timeout 付与**: diff を精査し、新規9件すべてに `{ timeout: 5000 }` が付いていることを確認した（抜けなし）。
- **(c) 主張と assert の一致**: 「speak されない」は `fakeSpeak.spoken.length===0` という配列長で直接確認（呼び出し有無の記録配列を検証しており、間接的な状態推測ではない）。「口を閉じた」は `ch.sets[0]` を `deepEqual` で厳密照合（value/ttlMs まで含む）。「1回だけ」は `buffer.all().length` や `ch.sets.length` の厳密な個数チェックで担保。テスト2では `bargeIn` 診断が**出ないこと**まで明示 assert しており、単に「kill 診断が出た」で満足せず種別の取り違えを排除している。見せかけの緑は確認できなかった。
- **(d) 秘匿の直接検証**: テスト3が唯一の秘匿要求（in-flight 破棄本文の非搭載）対象で、`Object.keys(discardDiag)` の完全一致（`["type"]` のみ）と `JSON.stringify()` した診断配列・戻り値オブジェクトへの文字列検索という二重の直接的手法で検証している。曖昧な「含まれていないはず」の推測ではない。

## 4. 実装側の裏付け（テストが本当に検証している経路か）

テストが「見せかけの緑」でないことを確認するため、`fire-orchestrator.mjs` の実装も参照した。

- `fire()` のガード順は `disposed` → `killed`（新規、:768-772相当）→ `busy` で、`killed` ガードは manual・視覚・自発 preferred の唯一の合流点である `fire()` 冒頭に位置する（テスト6の主張と一致）。
- in-flight キル検査（`processAskedReply` 内、:334-339）は `parseExpressionTags` 実行・未知タグ診断 emit の**後**、`hasSpeech`/`hasEvents` 計算・`setState("speaking")`・`speakImpl` 呼び出しの**前**に位置しており、テスト3が検証する「speak されない」経路と実装が一致することを確認した。`parseExpressionTags` の `diagnostics`（`expression-parser.mjs:81,94`）は `unknownTag`/`brokenTag` の型名・件数のみで応答本文を含まないため、killed チェック以前の diagnostic emit が秘匿要求に抵触することもない。
- `severSpeaking` 共有ヘルパー（`interrupt()`/`kill()` 共通）は診断 type を `diagnosticType` 引数でパラメータ化しているだけで、既存 `bargeIn` 経路の外形（`bargeInStopError` 等の type 名含む）は1ビットも変えていない。これは既存のバージイン系テストが新規9件追加後も全緑のままであることでも裏付けられる（今回の独立再実行で無退行を確認済み）。

## 5. 不足テスト

計画 §Domain A の6項目・Gnome 報告が挙げる9件の観点はすべてカバーされており、test 適合レーンとして追加で要求すべき機械テストはない。

## 6. 質問・申し送り

test 適合レーン自体の判定には影響しないが、Orch-Sylph が把握すべき点として記載する（spec 適合レーンのレビューでも同一論点が指摘されている模様のため重複の可能性がある）。

1. `reason:"killed-inflight"` という新設の reason 文字列は wave 計画・inventory のどちらにも明記がない。テスト3はこの文字列を直接 assert しているため、テストとしては仕様として固定されたことになる。Domain B 側でこの reason 文字列を使って分岐する設計になる場合、文書化（followup 台帳等）の要否を確認されたい。
2. 再生中 kill 時の `fire()` 最終戻り値が `{fired:true, interrupted:true}` になる点（テスト2:82-84 で assert 済み・bargeIn と同一の意味論を共有する設計）は、Domain B が kill API のレスポンスとして何を使うか（`fire()` の戻り値か `kill()` 自身の戻り値か）の設計判断に関わる。test 適合レーンとしてはテストが実装の実際の挙動を正しく捉えていることのみ確認済みで、この点自体は設計判断（他レーン領分）と理解している。
