# S8 Domain A レビュー — spec 適合レーン

> レビュアー: Review-Sylph（spec 適合レーン・読み取り専任）
> 対象: `apps/soul/agent/src/mind/fire-orchestrator.mjs` / `barge-in.mjs` / `fire-orchestrator.test.mjs`
> 判定基準: [s8-wave-plan.md](../../orchestration/s8-wave-plan.md) §Domain A・§1・§4、[s8-planning-inventory.md](../../orchestration/s8-planning-inventory.md) §1-2・§2-1・§3

## 判定: **合格**

機械ゲート（`node --test` 全緑）を独立再実行で確認。`apps/soul/agent` を cwd に実行し、Gnome 報告と同一の結果を得た。

```
1..738
# tests 738
# pass 738
# fail 0
```

（ベースライン 729 + 新規 9 件 = 738、一致。）

## spec チェックリスト（✓/✗ + 根拠）

### 1. キル = 全発火 OFF（manual 含む）— ✓

`fire()`（fire-orchestrator.mjs:764-798）のガード順は `disposed`(:765-767) → `killed`(:768-772) → `busy`(:773-777) → `ears-not-running`(:778-783)。visionMode 分岐（`vision:true` → `fireVision`、`"preferred"` → `firePreferred`、undefined → `fireNormalCore`）は :789-798 でこのガード列より**後**に位置する。したがって manual `fire()`・視覚 `fire({vision:true})`・自発 `fire({vision:"preferred"})` の全経路が唯一の合流点である `killed` ガードを通過してから分岐する構造を確認した。`fireVision`/`firePreferred` は戻り値オブジェクト（:756-819）に公開されておらず、`fire()` を経由しない外部呼び出し経路は存在しない。

戻り値は `{fired:false, reason:"killed", state}`、`onFire({accepted:false, reason:"killed"})`（:769-772）で spec 記載どおり。

テストで 3 経路全て確認: `fire-orchestrator.test.mjs:1692-1725`（`kill: manual fire()・fire({vision:true})・fire({vision:"preferred"}) の全経路がキルで弾かれる`、`session.ask`/`captureImpl`/`speakImpl` いずれも不呼び出しを assert）。

### 2. 声の即切断（再生中キル）— ✓

`kill()`（fire-orchestrator.mjs:571-580 付近、diff より）は `currentPlayback` があり未 interrupted なら `severSpeaking(pb, KILL_NOTE, "kill", atMs)` を呼ぶ。`severSpeaking` 内で ① `player.stop()`（同期呼び・try 内） ② `channel.sendSet({slotId:"mouth-open", value:0, ttlMs:...})` ③ `computeSpokenPrefix` で切断点算出 ④ `pb.buffer.append({text: cut.prefix + note, speaker:"soul"})`（note=`KILL_NOTE`） ⑤ `emit(onDiagnostic, {type:"kill", elapsedMs, charsSpoken, totalChars, prefix})` を実行。

テスト: `fire-orchestrator.test.mjs:1519-1575`（`kill: 再生中キルは声を止め・口を閉じ・soul へ prefix+KILL_NOTE を1回追記・kill 診断`）で `player.stop` 呼び出し回数 1、`sendSet` 引数の厳密一致、soul 追記が `"こんに" + KILL_NOTE` の 1 件のみ、`kill` 診断（`bargeIn` 診断は出ない）を直接 assert 済み。

### 3. in-flight 破棄 — ✓

`processAskedReply`（fire-orchestrator.mjs:318-）内、`parseExpressionTags` 実行(:326-328)・未知タグ診断 emit(:330-332)の**後**、`hasSpeech`/`hasEvents` 計算(:340 以降)の**前**に `killed` チェック(:336-339)を挿入。命中時は `emit(onDiagnostic, {type:"killDiscarded"})` のみ・`return {fired:false, reason:"killed-inflight", ...extra}`。speechText 本文は診断オブジェクトに含まれない。

`processAskedReply` は通常 Fire・視覚発火の両方から呼ばれる共通関数（:310 コメントで明記）ため、in-flight 検査は両経路に適用される。

テスト: `fire-orchestrator.test.mjs:1577-1620`。`deferred()` で ask を保留 → thinking 中に kill → ask 解放 → `speakImpl` 不呼び出し・soul 追記なし・`killDiscarded` 診断のキーが `["type"]` のみ・`JSON.stringify(diags)`/`JSON.stringify(result)` に応答本文（"こっそり"）が含まれないことを直接 assert（秘匿の直接検証）。

### 4. 一クリック復帰（revive）— ✓

`revive()`（fire-orchestrator.mjs）は `killed = false` のみ（副作用なし・void）。

テスト: `:1622-1667`（再生中キル後revive→次のfireが thinking→speaking→自然完了まで正常進行、`interrupted` 汚染なし・busy 固着なしを確認）、`:1669-1690`（idle キル後の簡易版）。

### 5. 耳/転写は生存 — ✓

`fire-orchestrator.mjs` の import 一覧（:109-120）に `src/ears/` からの import はゼロ。本体コード中の `ears` という語は全てコメント（:95, :554）と既存の `reason:"ears-not-running"`（buffer が getBuffer() 経由で null のケース、ears モジュールへの依存ではない）のみ。`kill`/`revive`/`severSpeaking` は `player`/`channel`/`pb.buffer.append`/`state` 以外に触れない構造を維持している。

テスト: `:1747-1766`（kill 後も `buffer.append()` で you 転写が積めることを直接確認）。

### 6. in-memory のみ・プロセス不殺 — ✓

`kill`/`revive` はクロージャ変数 `killed`（真偽値）の代入のみ。`process.exit`・ファイル/DB 永続化・外部ストレージへの書き込みは一切ない。テスト実行後も orchestrator インスタンスは生存し続け、revive 後に再度 fire できることをテスト 4/5 で確認済み（dispose とは別物であることが構造的に裏付けられている）。

### 7. born-killed（生成時伝播の下地）— ✓

`let killed = options.initialKilled === true;`（構築部、options 検証直後）。厳密 boolean 判定のため nullish/非 true は全て false に落ちる。JSDoc（:183 付近の `@returns` 型・:178-181 の `@param options.initialKilled`）にも明記。

テスト: `:1727-1745`（`initialKilled:true` で構築 → `getKilled()===true` → 直後の `fire()` が `reason:"killed"` で弾かれる）。

### 8. 裁定 7（キルの方向性）— ✓

`kill()` と `revive()` は別メソッドとして実装され、単一メソッドのトグルは存在しない。戻り値オブジェクト（:801-813）に両方が個別に公開されている。in-memory のみで永続化なし（項目 6 と同じ根拠）。

テスト: `:1768-1796`（非 killed 時の revive が no-op・speaking でない kill の severance no-op・二度 kill しても安全＝冪等）で「トグルではない」ことを補強的に確認（二度 kill しても状態が反転しない = トグル的挙動ではない）。

## 機械テストの網羅性（wave 計画 §3 Domain A の 6 項目との対応）

計画が列挙した機械テスト要求と実装テストの対応関係を確認した。

| 計画の要求 | 対応テスト |
|---|---|
| idle 中キル | `:1494` |
| 再生中キル（声停止+口閉じ+注記） | `:1519` |
| ask 待ち中キル（応答が返っても喋らない・soul 追記なし） | `:1577` |
| revive 後の発火復活 | `:1622`, `:1669` |
| manual 発火もキルで弾かれる | `:1692`（vision/preferred も同時に確認） |
| 耳系（transcript-buffer 等）無影響 | `:1747` |

計画に明記のない追加テストとして born-killed（:1727）・冪等性（:1768）があり、これは裁定 7 と inventory §2-1 の「born-killed」要求を裏付けるテストで、範囲逸脱ではなく妥当な補強。

## 裁量許容（spec 未定義を合理的に実装した箇所）

1. **KILL_NOTE の配置**（`barge-in.mjs` の `BARGE_IN_NOTE` 隣）— spec は文言のみ規定（`s8-planning-inventory.md` には具体的な注記文言の指定なし、`domain-a.md` の裁量判断 1 に理由あり）。妥当。
2. **`severSpeaking` のエラー診断 type パラメータ化**（`bargeInStopError`/`killStopError` 等）— spec に명記なし、design レーン領分寄りだが spec 上は「診断が出る」という要求は満たされている。
3. **`kill()` の戻り値形状** `{killed, severed, elapsedMs?, charsSpoken?, prefix?}` — spec は kill の効果のみ規定し戻り値の形は未定義。Domain B が呼び出す際の契約になるため、後続ドメインでの整合確認が必要（下記「質問」参照）。
4. **`reason:"killed-inflight"` という新設計の reason 文字列** — spec/inventory は「diagnostic に破棄事実のみ」とだけ記載し、`fire()` の戻り値の `reason` 名までは規定していない。fire() 冒頭ガードの `reason:"killed"` と区別する目的で新設された裁量判断。合理的だが Domain B 側がこの reason 文字列で分岐する場合は文書化が必要。

## 質問

1. **再生中 kill 時の `fire()` 最終戻り値の意味論**: `severSpeaking` が `interrupt()` と同じ `pb.resolve({interrupted:true, ...})` 経路を共有するため、再生中に `kill()` した場合の `fire()` 全体の戻り値は `{fired:true, interrupted:true, replyText:<声に出た接頭辞>}` になる（Gnome 報告の裁量判断 4・質問と同一箇所）。spec のチェックリスト項目（キル完全性・即効性・秘匿）はいずれも満たされているため spec 適合レーンとしては問題視しないが、**Domain B が kill API のレスポンスとして `fire()` の戻り値（`fired:true`）を使うか `kill()` 自身の戻り値（`{killed:true, severed:true}`）を使うかは Orch-Sylph が Domain B 着手前に明確化する必要がある**。`kill()` 自身の戻り値だけで切断点情報が完結しているため、Domain B は `kill()` の戻り値のみで完結させる設計を推奨する（fire() の Promise を待つ必要がない）。
2. **`reason:"killed-inflight"` の文書化**: 上記裁量 4 について、wave 計画・inventory のどちらにも明記がなかった追加語彙のため、s8-wave-plan.md や followup 台帳への追記要否を Orch-Sylph に確認したい（spec 適合そのものには影響しない軽微な指摘）。

## まとめ

spec チェックリスト 8 項目全て ✓。wave 計画 §3 Domain A が要求する機械テスト 6 項目も全て実装テストに対応が確認できた。`node --test` 独立再実行で 738/738 緑を確認。blocking レビュー基準（§4）のうち spec 適合レーンが直接検証できる項目（1: キルの完全性、3: 耳の不干渉、5: 没の秘匿、6: 復帰の健全性）はいずれも実装・テストの両面で裏付けが取れている。項目 2（即効性の await 位置）・項目 4（ワイヤ契約 additive、Domain B 領域）は design/他レーンの管轄のため本レポートでは判定対象外とした。
