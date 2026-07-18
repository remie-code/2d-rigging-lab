# 「朗読と合いの手」wave — Domain B(配線+操縦席+docs) spec 遵守レビュー

> レビュー担当: Review-Sylph(spec 遵守レーン)。呼び出し元: Orch-Sylph。読み取り専任。
> 検証対象: `discussion/ai-cohost/implementation/waves/reading-interjection/domain-b.md`(Gnome 自己申告)。
> 根拠: `reading-interjection-wave-plan.md` §1/§3 Domain B・`reading-interjection-inventory.md` §1/§3・
> 実装ソース(自分で読んだ file:line)・`node --test` 実測再実行。

## 総合判定: **PASS-with-nits**

blocking な spec 逸脱は見つからなかった。裁定1(既定 ON)・POST /api/barge-in・snapshot additive・
born-disabled 伝播・運転バー Pill・onFireRequest interjection 振り分け・README・followup 台帳、
すべて file:line で実装を確認し、Gnome 自己申告と一致することを裏取りした。`node --test`(apps/soul/agent)
を独立に再実行し `886/886 pass` を実測確認(自己申告の数字と一致)。器/packages/lockfile 不接触も
`git diff --stat -- apps/runtime-player "packages/" "pnpm-lock.yaml" package.json` で再確認(出力なし)。

nit 1 件(fireSchedulerFactory の spec 外追加。詳細は下記)を除き、spec 遵守の観点で問題なし。

## 項目別判定表

| # | 項目 | 判定 | ソース根拠(file:line) |
|---|---|---|---|
| 1 | 裁定1(既定 ON・非対称) | PASS | `barge-in.mjs:216` `let enabled = options.enabled !== false;`(Domain A・既定 true)。`cockpit-server.mjs:447` `const bargeInInitialEnabled = options.bargeInInitialEnabled !== false;`。`scripts/cockpit.mjs:329` `createBargeInHooks(settings, defaultEnabled = true)`・`:481` 呼び出し `createBargeInHooks(settings, true)`。self-fire 側(`selfFireInitialEnabled === true`・:442・既定 false)の機械的写経になっておらず、3 箇所すべて ON 側で揃っている。 |
| 2 | POST /api/barge-in | PASS | `cockpit-server.mjs:950-970`。`body.enabled === true`(:958)・gate 未生成 503(:953-956)・`bargeInGate.setEnabled(enabled)`(:959)・`onSetBargeInEnabled` 永続化(失敗寛容 try/catch・:960-966)・`broadcastState()`(:967)・`snapshot()` 200 返却(:968)。POST /api/self-fire(:929-948)と完全同型。テスト 6 種を `cockpit-server.test.mjs:2513-2611` に確認(gate 未生成 503・enabled 切替+既定 ON 確認・非 boolean 強制・永続化橋渡し・broadcastState)。 |
| 3 | snapshot bargeIn キー | PASS | `cockpit-server.mjs:544` `bargeIn: bargeInGate ? { enabled: bargeInGate.isEnabled() } : null`。`selfFire`(:541)の直後に追加され、周辺の既存キー(channel/visionTarget/verbosity/killed/brain/audioDevice 等)は変更なし。 |
| 4 | born-disabled 伝播(blocking) | PASS | 経路 `scripts/cockpit.mjs:332-335`(`resolveInitialEnabled()` が記憶済み bool を defaultEnabled より優先)→`:712` `bargeInInitialEnabled: bargeInHooks.resolveInitialEnabled()`→`cockpit-server.mjs:447`(オプション束縛)→**gate 構築時点**`:1287-1299` `createBargeInGate({ enabled: bargeInInitialEnabled, onConfirm })`。構築後の `setEnabled` 後追いは無い(grep で `bargeInGate.setEnabled` の呼び出しは POST ハンドラ(:959)のみ)。テスト `cockpit-server.test.mjs:2619-2667` が `bargeInInitialEnabled:false` で VAD フル猶予(200+2000ms)後も `interruptCount===0`、未指定(既定 ON)では `interruptCount===1` になることを実時間で固定。`node --test` 再実行で全緑を実測確認済み。 |
| 5 | 運転バー Pill | PASS | `control-bar.mjs:113-127` `BargeInPill`(`SelfFirePill:90-104` の写経)。`:327-328` で `SelfFirePill` の隣に配置。`:240-259` `onToggleBargeIn` が `POST /api/barge-in` を叩き `applySnapshot(res.j)` で反映(`onToggleSelfFire:214-233` と同型)。`view-logic/control.mjs:207-239` `bargeInToggleView`/`bargeInPostErrorText`/`bargeInRequestErrorText` が `selfFireToggleView` 系(:99-131)と同型。 |
| 6 | onFireRequest interjection → vision:"preferred" | PASS | `cockpit-server.mjs:1342-1345` `req.kind === "silence" ? fire({vision:true}) : fire({vision:"preferred"})`。分岐コード自体は既存のまま(コメント追記のみ・grep で分岐条件式は 1 箇所だけ)であり、"interjection" は自動的に else 枝を通る。テスト `cockpit-server.test.mjs:2697-2736` で `fireSchedulerFactory` 注入により `{kind:"interjection"}` → `vision:"preferred"` 呼び出し固定 + selfFire SSE への `kind:"interjection"` 素通し固定を確認。 |
| 7 | README | PASS | 発火語彙表(`apps/soul/README.md:281`)に「④ 合いの手(`interjection`)」追加。`:439-467`「朗読と合いの手」節に barge-in トグル既定 ON(:445-449)・切断猶予 2000ms(:450-453)・合いの手の機構(:454-461)・人間ゲート観点(:462-464)を記述。 |
| 8 | followup 台帳 | PASS | `discussion/ai-cohost/implementation/waves/reading-interjection/followup.md` に §1 VAD minSpeechMs 独立性疑義・§2 再武装コメント nit(base=refractory×2 依存)・§3 lastFireAtMs 共有 nit・§4 Domain B 裁量事項(app.mjs/styles.mjs 配線・fireSchedulerFactory)を確認。 |
| 9 | 裁量の spec 妥当性(app.mjs/styles.mjs 配線) | PASS(妥当) | `app.mjs:83` `bargeIn: (s && s.bargeIn) ?? null`・`:257` `bargeIn=${settings.bargeIn}` を `ControlBar` へ橋渡し(selfFire/verbosity/killed と同型 2 行 diff)。`styles.mjs:261-272` `.barge-in-pill`/`.barge-in-toggle`/`.barge-in-status` 3 クラスのみ(`.self-fire-pill` 系の写経)。wave 計画 §3 B-4 の記載は control-bar.mjs/view-logic/control.mjs のみだが、この配線がなければ `BargeInPill` は永久に「not available」表示のまま機能せず、§1 ゴール(運転バーでの ON/OFF 切替)を満たせない。範囲は必要最小限で spec のゴール達成に資する。 |
| 10 | 裁量の spec 妥当性(fireSchedulerFactory) | PASS・ただし疑義あり(nit) | `cockpit-server.mjs:352-356`(JSDoc)・`:1326-1327` `typeof options.fireSchedulerFactory === "function" ? options.fireSchedulerFactory : createFireScheduler`。本番(`scripts/cockpit.mjs`)は未指定のままで grep 確認済み(`createFireScheduler` 直接呼び出しの記述は無い=既定にフォールバック)、ワイヤ契約(HTTP/SSE)への影響なし。ただし wave 計画 §3 Domain B の項目列挙には**明記されていない**追加オプションであり、spec 原文をそのまま読むと B-3(server テスト 6 種+onFireRequest テスト)の実現手段としての「テスト注入口の新設」まではスコープに含まれていない。実害はゼロだが、spec 遵守の観点では「未記載の裁量」として下記 nit に記録する。 |

## blocking

なし。

## nit

1. **fireSchedulerFactory の追加は spec(wave 計画 §3 Domain B)に明記のない拡張**(`cockpit-server.mjs:352-356`・`:1326-1327`・テスト `cockpit-server.test.mjs:2669-2736`)。Gnome 自身も domain-b.md §7-1/§7-6 で「レビューでスコープ超過と判断されれば分離できる」「代替方針の指示を仰ぎたい」と明記済み。挙動・ワイヤ契約への影響はゼロで、`fireOrchestratorFactory`/`pipelineFactory` と同型の既設パターンに沿っているため実装として不自然ではないが、**spec 遵守の形式的な観点では「文書に無い追加」である**ことは Orch の判定材料として明記しておく。
2. born-disabled の 2 テスト(`cockpit-server.test.mjs:2619`/`2644`)は `BARGE_IN_MIN_SPEECH_MS`+`BARGE_IN_GRACE_MS` の実時間待機(最大 2.4 秒)に依存しており、テスト時間の増加(全体 1.8s→6.4s)の主因になっている。cockpit-server.mjs に barge-in 用のタイマー注入経路が無いことが原因(Domain A 側の設計のまま)。followup.md には明示記録されていないが domain-b.md §7-4 に記録済み。non-blocking。

## Orch への質問

1. nit 1(fireSchedulerFactory)について、このまま Domain B の成果物として確定してよいか、それとも Gnome が提示した代替(fire-scheduler の完全なタイマーサイクルを長時間実行で許容する / このテストをコードレビュー担保に留めて注入口を撤去する)を採用すべきか、Orch の判定を仰ぎたい。design/test レーンの評価と合わせて最終判断されたい。
2. born-disabled テストの実時間待機(nit 2)についてタイマー注入経路の追加をこの wave で実施するか、followup 送りのままにするかは design レーンの判断領域と考え、本レビューでは spec 遵守上の blocking とはしていない。

## 検証時に実行したコマンド(参考)

- `node --test`(`apps/soul/agent` 配下)→ `tests 886 / pass 886 / fail 0`(自己申告と一致)。
- `git diff --stat -- apps/runtime-player "packages/" "pnpm-lock.yaml" package.json` → 出力なし(不接触)。
- `grep -oE '(method === "(POST|GET)" && pathname === "[^"]+")' cockpit-server.mjs | sort -u | wc -l` → 20(エンドポイント数コメント "20 エンドポイント" と一致)。
- `grep -oE 'broadcast\("[a-zA-Z]+"' cockpit-server.mjs | sort -u` → 13 種(chatDiagnostic/chatStatus/diagnostic/discard/expression/fire/selfFire/soul/state/transcript/usage/vad/visionCaptured)。SSE 種別増なしを確認(interjection は selfFire に kind として素通し)。
