# 「朗読と合いの手」wave — Domain A(魂: src/mind/)test 妥当性レビュー

> レビュアー: Review-Sylph(サブエージェント委任・Orch-Sylph より)。テストレーン(機械ゲートの実測+テストが基準を実際に固定しているか)。
> 対象: `apps/soul/agent/src/mind/barge-in.mjs`・`fire-scheduler.mjs`・`fire-orchestrator.test.mjs`(結線テストのみ・SOURCE不変)。
> Gnome 自己申告(`domain-a.md`・`domain-a-fix1.md`)を鵜呑みにせず、自分でテストを実行し、テストソース全文・関連実装ソース(barge-in.mjs 全文・fire-scheduler.mjs の合いの手該当部分)を読んで検証した。

## 総合判定: **PASS**

blocking に該当する欠陥は見つからなかった。nit(軽微な指摘)は §5 に記載。

---

## 1. 自分で実行した node --test の生サマリ

### 1.1 全体(`apps/soul/agent` で `node --test`)

```
1..863
# tests 863
# suites 0
# pass 863
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1952.5647
```

fail 0・cancelled 0 を実測で確認。ベースライン 842 からの増分は +21(内訳: barge-in +12/16→28・fire-scheduler +10/48→58・fire-orchestrator は結線 2 テストの advance 追随のみでテスト数不変 66→66)。Gnome 報告の最終値(pass 863)と一致。

### 1.2 対象 2 ファイル(`node --test src/mind/barge-in.test.mjs src/mind/fire-scheduler.test.mjs`)

```
1..86
# tests 86
# suites 0
# pass 86
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 170.2672
```

barge-in 28 + fire-scheduler 58 = 86。全緑。

### 1.3 fire-orchestrator.test.mjs 単体(結線テスト含む)

```
1..66
# tests 66
# suites 0
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 171.8435
```

cancelled 0 を実測で確認(Gnome 申告どおり、二段化追随後は cascade cancel が解消している)。

### 1.4 決定論チェック(2 回目実行・3 ファイル合算)

```
1..152
# tests 152
# suites 0
# pass 152
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 208.1794
```

28+58+66=152 で 1 回目と完全一致。フレークなし。

---

## 2. wave 計画 §3 Domain A テスト列挙 × 充足表

| 列挙項目 | 対応テスト名 | 実際に固定しているか |
|---|---|---|
| 猶予内 speechEnd で切られない | `bargeInGate: 猶予中の speechEnd は確定を取り消す（見合い成立=切られない・新意味論）` | ○。第一段通過後 speechEnd → isPending false・graceMs 満了まで advance しても confirms.length=0 を assert。実装(barge-in.mjs L277-283)と一致。 |
| 猶予超過で切断 | `bargeInGate: 猶予超過(speechEnd 未着のまま満了)で切断する` | ○。1999ms で confirms 0・+1ms(=2000ms)で confirms 1 の境界を assert。 |
| OFF で割り込みゼロ | `OFF トグル: setEnabled(false) 後は...onConfirm ゼロ` + `猶予段の進行中に OFF...` + `第一段(ノイズ弁)の進行中に OFF...` | ○。OFF 前・第一段中 OFF・猶予段中 OFF の 3 パターンを個別に固定(進行中のタイマが両方 clearAll で畳まれることを confirms 0 で確認)。 |
| 短い相槌(<2s)無害 | `bargeInGate: 短い相槌(<graceMs)は無害（猶予の早いタイミングで来た speechEnd でも切られない）` | ○。猶予開始から 50ms 後に speechEnd → isPending false・以後 5000ms 進めても confirms 0。 |
| run 継続と 2s 切断 | `interjection: 間隙 < turnEndSilenceMs の speechStart は run を継続する` + `interjection: 間隙が turnEndSilenceMs(2s) に達したら run が終了する` | ○。前者は間隙 1000ms(<2000ms)で run 継続・元の合いの手タイマーが生き残ることを確認。後者は間隙が正確に `TURN_END_SILENCE_MS`(2000ms)に達して run 終了・累積リセットされることを確認。 |
| 30s(base+jitter)累積→発火→リセット→再累積 | `interjection: run 中に base+jitter 満了で発火・lastFireAtMs 更新・次の一巡が再武装され再発火しうる` | ○。テストは base=3000ms(短縮値)で検証しているが、意味論(1 回目発火後 lastFireAtMs 更新・2 回目の周期でも発火)は本番 base(normal=60000ms)と同一ロジック経路。base の実値ではなくロジックを固定するテストとして妥当。 |
| 不応期割り込み時の再武装 | `interjection: 不応期に弾かれても累積は殺されず再武装し、不応期明けに再判定で発火する` | ○。不応期内で弾かれた周期は emit 0・不応期明けの次周期で emit 1 を確認。実装(fire-scheduler.mjs L568-579)の `armInterjection()` 再武装ロジックと一致。 |
| busy 再試行 | `interjection: busy に弾かれても累積は殺されず再武装し、busy が明けたら発火する` | ○。busy 中は emit 0・busy 解除後の次周期で emit 1 を確認。 |
| 口数 3 モードの値切替(12 値) | `interjection: v0 定数...VERBOSITY_BUNDLES は 12 値` + `interjection: setVerbosity は run を仕切り直し(畳む)、以後の run は新モードの値で武装する` | ○。前者は 3 モード×3 値(base/jitter/refractory)の存在・normal が既存 export 定数への参照であることを確認。後者は setVerbosity 実行時に run が畳まれ、新モードの値(chatty の base)で再武装されることを実測(値の実切替を assert)。 |
| **区切りとの排他(2s 境界で両語彙が同時発火しない)** | `★ 2 秒境界の排他: 間隙 2s で turn-end は armed に入るが interjection は emit しない（両語彙同時発火なし）` | ○(§3 で詳細検証)。 |

列挙 10 項目すべてに対応するテストが存在し、飾りではなく実際にその挙動を assert していることを実装ソースの読解でも確認した。

---

## 3. 2 秒境界の排他テストの実体検証(飾りでないか)

`fire-scheduler.mjs` の実装を読んで確認した:

- `handleVadEvent` の `speechEnd` 分岐(L668-679)で、`turnEndTimer`(2000ms・armed へ入るだけ)と `armInterjectionGapIfRunning()`(2000ms・`interjectionGapTimer`)が**両方**張られる。
- `onInterjectionGapTimer`(L601-606)は `endInterjectionRun()` を呼ぶのみで **`emitFire` を一切呼ばない**。
- `onTurnEndTimer`(L643-653)も判定通過時は `armTurnEnd()`(armed へ入るだけ)を呼び、**即座には emitFire しない**(転写到着まで待つ・別の追撃修正で担保済みの機構)。

テスト`★ 2 秒境界の排他`は、interjection の base を 30000ms(2s 境界よりずっと長い)に設定した上で speechEnd 後 2000ms で `reqs.length===0` を assert し、その後 `you` 転写到着で `turn-end` のみが 1 件発火することを確認している。これは実装の構造(両ハンドラとも emit しない設計)を正しくなぞった decisive なテストであり、飾りではない。

---

## 4. 不応期再武装テストが「発火し続ける」ことを固定しているか

`interjection: 不応期に弾かれても累積は殺されず再武装し...` テストは、1 回不応期に弾かれた後、次の周期で実際に発火することを assert している。実装(`onInterjectionTimer` L568-579)は不応期/busy で弾かれても常に `armInterjection()` でフル再武装するため、「ある段階から全く発火しなくなる」状態(タイマーが二度と張られない状態)は構造的に作られない。

Gnome の申し送り(domain-a.md §3.2/§8-1・§9.2-2)にある通り、この再武装が「次の周期で必ず不応期を解消する」ことを保証するのは `interjectionBaseMs = interjectionRefractoryMs × 2` という v0 の数値関係に依存しており、テストはこの前提を明示的にコメントで述べた上で 1 回分の弾かれ→解消のみを検証している。複数回連続で弾かれ続けるケース(数値関係が崩れた場合)は検証範囲外だが、これは v0 定数のもとでは起こりえないケースであり、テストの不足というより設計前提の話。nit として §5 に記載。

---

## 5. 抜け・弱い assert の指摘(nit)

いずれも blocking ではない。

1. **run 継続テストの境界値が緩い**: `interjection: 間隙 < turnEndSilenceMs の speechStart は run を継続する` は間隙 1000ms(base 5000ms との比較で `<2000ms` の代表値)で検証しており、1999ms ちょうどのような厳密境界のテストはない。ただし run 終了側(`interjection: 間隙が turnEndSilenceMs(2s) に達したら run が終了する`)は `TURN_END_SILENCE_MS` を直接使い正確な 2000ms 境界を検証しているため、境界の実質的なカバーはできている。
2. **不応期/busy 再武装は 1 回分のみ検証**: 上記§4 のとおり、複数回連続で弾かれるケースは検証範囲外。v0 定数(base=refractory×2)前提での省略であり、Gnome 自身も申し送り済み(domain-a.md §9.2-2)。将来定数変更時にこの数値関係が崩れると再武装ロジックの再検証が必要になる点、README や定数コメントへの申し送りを Domain B 側で拾うべき事項として妥当。
3. **interjection の `vision:"preferred"` マッピングは Domain A のテスト範囲外**(Gnome 自己申告どおり)。`fire-scheduler.mjs` は `kind: "interjection"` を出すのみで、vision マッピングは cockpit-server.mjs(Domain B)側の既存 else 分岐に委ねられている。Domain A のテストとしては妥当なスコープ限定であり、Domain B レビューでの確認事項として引き継ぐべき。
4. **猶予段中の新たな speechStart を無視する裁量**(barge-in.mjs L257-262)は、テスト `bargeInGate: 猶予段中の新たな speechStart は無視する` で固定されているが、これは実 VAD セグメンタの契約(1 発話 1 speechStart)を前提にした防御的選択であり、機械テストの範囲では正しく固定できている一方、実配信での挙動検証は人間ゲート待ち(Gnome 自身も申告済み)。

---

## 6. 既存語彙・barge-in 二段化の無退行確認

- **既存 5 語彙(call/turn-end/silence/comment/comment-call)+ manual のテストは無改変で全緑**: `fire-scheduler.test.mjs` を通読し、call/turn-end/silence/comment/comment-call の各テストブロックは Domain A 実装前と同じ assert 内容であることを確認(interjection 関連の追加テストは既存ブロックの後に新設された節としてのみ追加されている)。
- **barge-in 既存テストの二段化更新は正当**: 旧テスト「speechEnd は機械弁に無関係」は、新設計で speechEnd が第二段の取消弁になったことを受けて、①「猶予中の speechEnd は確定を取り消す(新意味論)」②「第一段中の speechEnd は無視する(第一段の挙動不変)」③「短い相槌は無害」の 3 テストに分割されている。旧テストの主張(第一段中は無関係)は②でそのまま維持されており、単に緩めて通しただけではなく、新旧両方の意味論を正確に固定している。実装ソース(barge-in.mjs L271-284)の分岐と 1 対 1 で対応することを確認した。
- **結線テスト(fire-orchestrator.test.mjs)の advance 追随は正当**: `結線: createBargeInGate 確定 → orchestrator.interrupt` は `gateTimers.advance(200)` の後に `gateTimers.advance(BARGE_IN_GRACE_MS)` を追加しただけで、`interrupt(1300)` の中断時刻・`replyText==="こん"` の assert は変更されていない(検証内容は変わらず、二段化に伴うタイミングのみ追随)。`結線: 窓内 speechCancel は interrupt を呼ばず自然完了する` は無改変(第一段中の speechCancel で弁が取り消される実装のため、二段化の影響を受けない)。`fire-orchestrator.mjs`(SOURCE)は不変であることも `git diff --stat` の対象外であることから確認できる。

---

## 7. 実消費ゼロ・決定論の確認

- 3 ファイルとも `http|fetch|child_process|WebSocket|net\.|dgram|exec\(|spawn\(|createServer|claude-agent-sdk` を grep して該当なし(実 LLM/実 TTS/実ネット/実マイクへの経路が構造的に存在しない)。
- `fire-scheduler.test.mjs` 自体に「LLM 非依存の担保」テストがあり、`fire-scheduler.mjs` に import が 1 つも無いこと・`.ask(` 呼び出しが無いこと・`createLlmSession|llm-session|claude-agent-sdk|session\.ask` の文字列が無いことをソース読み取りで assert している(interjection 追加後も回帰確認テストあり)。
- `fire-orchestrator.test.mjs` は `session.ask`/`speakImpl`/`channel`/`player`/`captureImpl` を全て fake として注入しており、実体を持つのは `transcript-buffer.mjs`(実バッファだが in-memory のみ)のみ。
- 全テストが fake clock(`makeFakeClock`/`makeFakeTimers`)・注入 RNG(`rngHit`/`rngMiss`/seed 付き線形合同法)を使用しており、実 timer・実 clock・実 Math.random は使われていない。
- 決定論: §1.4 のとおり 2 回実行して完全一致。フレークなし。

---

## 8. Orch への質問

なし。blocking 相当の欠陥は見つからなかった。§5 の nit 4 点(境界値テストの粒度・複数回不応期の検証範囲・vision:"preferred" マッピングの Domain B 引き継ぎ・猶予段中 speechStart 裁量の人間ゲート検証待ち)は Gnome 自身も申告済みの事項であり、いずれも人間ゲート(朗読実射)または Domain B レビューでの確認を待つ形で問題ない。
