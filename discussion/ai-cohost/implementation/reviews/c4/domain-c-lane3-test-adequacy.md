# C4 Domain C レビュー (Lane3: test adequacy)

> Review-Sylph(test adequacy 専任・読み取り専任)→ Orch-Sylph。
> 対象=`cohost-c4-channel-page-degraded`(Channel bridge+ページ+自律Overview+degraded解消+合成根配線)。
> 独立評価(spec/design レーンと非統合)。テストコード・実行結果を自分で確認。

## 判定: 合格(non-blocking follow-up 1件を付す)

blocking 観点はすべて固定されている。唯一の欠落は degraded 置換の enumerated 5面のうち **Header(`Drive: Physiology`)のみテスト未固定**。実装は存在し(control-window-app.tsx L695-701)、他4面は固定済み・全機械ゲート緑のため、wave gate を止める性質ではないと判断。follow-up テスト追加を推奨。

## テスト結果(自分で実行して確認)

- **focused**(`src/control` + `src/main/channel-bridge-handlers.test.ts` + `src/main/control-channel`): **24 files / 120 tests 全 pass**。Domain C 新規5ファイル(channel-page=8・control-window-app.channel=3・control-window-degraded=6・channel-bridge-handlers=6・channel-server-events=1)含む。physiology-page(8)・live-controller-page(5)・stage-page.stage-motion(6)・stage-page.browser-source(4)・overlay-store(5)・channel-server(8) 等の既存も緑=無退行。
- **runtime-player 全体**: **816 passed / 2 failed(135 files: 133 passed / 2 failed)**。
  - 失敗2件=`stage/browser-source/browser-source-server-message.test.ts` と `broadcast-source/browser-source-server.test.ts`、いずれも `effectiveDynamicsTuning` フィールド不一致。**Wave21 既知 baseline** で Domain C と因果無関係(browser-source 未接触)。Gnome §9 主張と一致・検証済み。
- 実行環境: 私(Review-Sylph)自身が vitest を回した実測。`pnpm install` は未実行。

## test adequacy 観点別の充足

| # | 観点 | 判定 | 根拠(テスト) |
|---|---|---|---|
| 1 | ページrender(blocking) | ✓ 充足 | channel-page.test.ts: checking/empty/Closed(Open Channel・endpoint無)/Open(endpoint+Copy)/Connected(protocol 1)/Active overlays/Recent Events を個別 assert。Closed/Open/Connected の3状態が描かれる。 |
| 2 | 開閉コマンド | ✓ 充足 | channel-page.test.ts「wires Open/Close/Copy」(onClick 実呼び)+control-window-app.channel.test.ts で bridge の openChannel/closeChannel invoke を固定。状態遷移は channel-bridge-handlers.test.ts「starts Closed and opens/closes」で closed→open→closed を endpoint null↔非null 込みで固定。 |
| 3 | 空状態(blocking) | ✓ 充足 | channel-page.test.ts「tracking-host empty state」= available:false で「This host has no control channel; the body is driven by tracking.」の一文を assert、かつ Open Channel/token 非出現も assert。 |
| 4 | Overview data描画 | ✓ 充足 | control-window-degraded.test.ts: 自律=Model/Physiology/Channel+Open Physiology/Open Channel・Input Source/Connect Input 非出現。tracking=Input Source/Input Profile 出現・Open Channel 非出現(Channelカード無し)。 |
| 5 | degraded置換(blocking) | △ 部分不足 | Input/Mapping/Motion Safety/Stage Motion の4面は control-window-degraded.test.ts で「自律=空状態文出現・旧操作(Receive port/Semantic Slots/Toggle Stage Motion/Horizontal Follow)非出現」を固定。Input は tracking(drivenByPhysiology:false)で Receive port 出現=無退行も固定。**Header の `Drive: Physiology`/tracking従来表示の data 分岐テストが存在しない**(下記 follow-up)。 |
| 6 | 秘匿非露出(blocking) | ✓ 充足(強) | channel-bridge-handlers.test.ts「token ONLY inside endpoint URL, no seed/raw slot」= `occurrences(json, token)===1`・endpointUrl に含む・`"seed"` 非包含。Closed 時は token 非包含。activeOverlays テストで絶対 `expiresAtMs`(FIXED_NOW+300)非包含。channel-server-events.test.ts で event JSON に token 非包含。session-only=「ring buffer(most-recent-first・capped)」で in-memory 有界を固定(永続化パス自体が存在しない)。 |
| 7 | 残TTL | ✓ 充足(強) | channel-bridge-handlers.test.ts「relative remaining TTL」= FIXED_NOW+300 と失効分(FIXED_NOW-1)を混在させ、`[{head-horizontal, 0.4, 300}]` のみ=失効除外+相対値を固定。絶対時刻非包含も assert。 |
| 8 | 偽陰性・決定論性 | ✓ 充足 | 全て renderToStaticMarkup / 実 onClick / toStrictEqual の実アサーション。bridge は `nowMs`/`nowIso` 注入で決定論。IPC は electron mock で physiology-page 系と同流儀。channel-server-events は実 WS 往復だが port:0+waitFor(1000ms/10ms poll)で既存 channel-server.test.ts と同パターン、217ms 完走で flaky 兆候なし。channel-page の "intent.set" は accepted event の formatEvent 由来で常時出現ではない(偽陽性でない)。 |
| 9 | Domain A追加分 | ✓ 充足 | `onEvent`/event型は channel-server-events.test.ts が実WS往復で connected/accepted/rejected/disconnected と公開data限定(accepted=slotId+value、rejected=code、token非包含)を固定。`activeOverlays`(store)は overlay-store.test.ts では直接ユニット未固定だが、channel-bridge-handlers.test.ts が**実 store インスタンス**(mock でない)で setOverlay→activeOverlays 出力(相対TTL・失効除外)を固定=統合レベルで挙動固定。既存 Domain A テスト(channel-server 8・contract 6・dispatch 7・config 4・slot-ports 3・token 3・validation 12・normalized-range 3)全緑=無退行。 |

## 不足

### blocking
- なし。

### non-blocking(follow-up 推奨)
1. **Header degraded 置換のテスト未固定**(観点5)。`control-window-app.tsx` L695-701 は `inputLabel = drivenByPhysiology ? "Drive: Physiology" : getInputStatusPillLabel(inputStatus)`(tone も teal/従来)を実装済みだが、これを固定するテストが無い。wave plan §6 と本レーン要件#5 は degraded 置換の enumerated 面として Header を明示しており、UX §3 は `Input: Disconnected`(嘘に近い表示)の data 差し替えを名指しで要求している。他4面が leaf component 直 render で固定されているのに対し、Header は app 合成内のインライン三項でありテスト面が無い。
   - リスク評価: 低。入力である `drivenByPhysiology` 派生自体は既に4つの degraded leaf を駆動して固定されており、Header は薄い表示ロジック。role 問い合わせでなく data 分岐であることも実装上明白。
   - 推奨: 自律で Header が `Drive: Physiology`(teal)・tracking で従来 `getInputStatusPillLabel` を出すことを 1 ケースで固定(role 回帰への防波堤)。
2. **overlay-store `activeOverlays(nowMs)` の直接ユニット未固定**(観点9)。挙動は bridge 統合テストで実 store 経由に固定済みのため実害は小。store 側に snapshot 同様の直接ケース(相対TTL・失効除外)を足せば局所退行を早期に捕捉できる。

## Overview tracking 4パネルの assertion 粒度(参考・不足ではない)
control-window-degraded.test.ts の tracking ケースは Input Source/Input Profile の存在+Open Channel 非出現で「4パネル維持・Channelカード無し」を担保。全4パネル名の網羅 assert ではないが、tracking レイアウト回帰(Channelカード混入)は捕捉できる=許容範囲。

## 質問(Orch/Undine 判断)
1. **Header テスト(follow-up 1)を本 wave 内で足すか、C4 Domain E/後続へ回すか**。wave plan §6 は Header を Domain C のテスト要件に列挙しているため、厳密には Domain C 内で固定するのが筋。ただし実装済み・低リスクのため gate は止めていない。Orch の裁量で「Domain C に1テスト追記して閉じる」か「follow-up 票として繰延」かを判断されたい。
2. Gnome §10-3 の「Recent Events の rejected 行は code のみ(slotId なし)」は本レーン(test adequacy)としては現行テストが code のみを前提に固定しており偽陰性はない。mockup の rejected 行 slotId を要件化するかは spec レーン/UX 判断であり、test adequacy 上は現状で整合。
