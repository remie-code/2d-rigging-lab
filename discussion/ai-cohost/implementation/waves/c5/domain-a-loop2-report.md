# C5 Domain A loop-2 実装報告: 連続性性質テストの遷移点網羅 + コメントdrift修正

> Gnome (実装) → Orch-Sylph。Domain A 第2ループ。狭域: **テスト4本追加 + コメント2箇所修正のみ**。source 曲線ロジックは無変更。
> 根拠: [domain-a-lane3-test-adequacy.md](../../reviews/c5/domain-a-lane3-test-adequacy.md) の「カバレッジの穴」#1-5 と質問1/2、wave plan §8 の機械受け入れ基準「連続性: すべての遷移点(attack開始・re-attack・失効・切断)で導出bound内」。

## 1. 要約

test adequacy レビューが指摘した「re-attack と 切断(releaseAll) が点検査止まりで bound-walk 化されていない」穴を、**狭域の追加テスト4本**で閉じた。source ロジックは一切変更していない。コメントdrift(disconnect の旧C4「clearAll」記述→実装は releaseAll)を2箇所修正した(挙動無影響)。

- 追加テスト4本 全pass。テスト4(非零base×decay)は **連続で pass**(bound超過の observe 無し → escalate 不要)。
- 全体退行なし。既知baseline(browser-source系2件)のみ fail。

## 2. 追加したテスト4本(各遷移点での導出bound算出・マジックナンバー不在)

既存の導出bound式 `step = |amplitude| / durationMs × RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE × frameIntervalMs`、`bound = max(...)` を踏襲。固定閾値は一切書かない。全因子が spec フィールド or 公開定数(`RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE=1.5`, `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS=400`, `frameIntervalMs`)。

### テスト1: re-attack seam の bound-walk (store層) — 穴#1
`control-channel-overlay-store.test.ts` の "continuity property" describe に追加。
- envelope A(peak0.8/attack240/sustain160/decay240)稼働中、mid-attack(t=96)で同一スロットに新 envelope B(peak0.5/…)到達。`prevResolved` を毎tick threading(心臓の案B retain を手動再現)し、re-attack の startValue = 直近実効値。
- 導出bound: 値は常に `[0, maxPeak]` に留まるので、任意の attack/re-attack 振幅 `|peak−startValue|` と decay 振幅(peak→0)は `≤ maxPeak`。**最広スパン `maxPeak` ÷ 最短相 duration** が両曲線の全per-tick step を上界。`maxPeak=max(peakA,peakB)`, `min(attackMsA,attackMsB)` 等、spec 由来のみ。
- re-attack を**跨ぐ隣接tick全域**(0→B終端)で `|frame[n]−frame[n-1]| ≤ bound` を walk。seam step は ~0(startValue=prevResolved)。重ねがけ(目玉③)の機械保証。

### テスト2: releaseAll(切断) の per-tick bound-walk (心臓層) — 穴#3
`autonomous-frame-heart-channel-overlay.test.ts` に追加。
- 2スロット(eye-blink-left/right)を open(activation0)で長TTL稼働 → `releaseAll(16)` → 全スロットを forced release。
- 導出bound: hand-off = sustain中の open activation(0)、base = closed generator activation(1)。`|handOff−base|/releaseMs × MAX_SLOPE × frameIntervalMs`。`|Δparam|=|Δactivation|`(invert・単位域, harness既存コメント:59-65 準拠)なので activation bound がそのまま param 系列に適用。
- releaseAll 後、全スロットの隣接published-frame差を release窓全域で walk(点検査でなく性質テスト)、終端で基底復帰。魂殺し(目玉④)の機械保証。

### テスト3: release 途中の re-attack 連続性 + 案B end-to-end (心臓層) — 穴#4/#5
`autonomous-frame-heart-channel-overlay.test.ts` に追加。
- envelope A で開眼→release相へ。release相の最中(t=640)に同一スロットへ envelope B 到達。**心臓が `lastResolvedActivations` を retain・供給する実フィードバックループ経由**で startValue = releasing中の実効値(案B end-to-end)。手動 prevResolved 注入なし。
- 導出bound: activation ∈[0,1]、`maxSpan=1`。attack/re-attack ≤1, decay ≤ 大きい方の peak, release は 0→base(1)。`max(attackStep, decayStep, releaseStep)`。
- A onset(baseから smooth)→A release→**re-attack seam**→B全生涯 の隣接frame差全域を walk、スナップ無しを確認。案B の load-bearing 経路(重なる intent の再attack起点)を心臓層で1本通した(穴#5 同時回収)。

### テスト4: envelope decay×非零・動く基底の characterization (store層) — 穴#2/#4 + 質問2
`control-channel-overlay-store.test.ts` の "continuity property" describe に追加。
- livingBase が**非零かつ毎tick動く**(0.3→0.5 の有界線形ramp、per-tick delta = slope×frameInterval は導出可能)スロットに envelope(peak0.8/attack100/sustain100/decay100)。全域 attack→sustain→decay→release→prune を walk。
- 導出bound: `max(attackStep, decayStep, releaseStep) + baseMovementStep`。release は 0→livingBase を blend するので base移動項 `baseMovementStep = baseSlopePerMs × frameIntervalMs` を上乗せ(全相に保守的加算=安全な上界)。base移動由来もマジックナンバーでなく ramp 定義から導出。
- **現行実装の挙動を固定・文書化**: decay は base非依存に peak→0 へ落ちる(`slot-curve-state.ts:124`)ため value は非零baseの下へ**dip(潜り)**、その後 release が 0→livingBase へ戻す。テストは `sawDipBelowBase===true`(dip を実際に観測)を assert しつつ、**全walkが導出bound内**であることも同時に固定。decay のターゲット意味論は変更していない。

## 3. テスト4(非零base×decay)の結果: **連続で pass(escalate 不要)**

**bound超過は observe されなかった。** 全隣接tick差が導出bound(`max(attackStep=0.12, decayStep=0.192, releaseStep=0.03) + baseMovementStep≈0.0046 = 約0.197`)以内。decay が非零base(0.3〜0.4付近)の下へ dip する現行挙動は観測(`sawDipBelowBase===true`)されたが、release blend が連続性を吸収し、終端の生きた基底(0.5)への hand-off も pruneでスナップ無し。

→ 委任の escalate条件(bound超過の不連続=decay意味論の設計論点)には**該当せず**。連続(bound内)なので通常の pass テストとして固定した。lane3 質問2(非零base×envelope decay の相互作用が未テスト)の穴を、意図どおりか否かの裁定を待たず「現状挙動の characterization」として無害に固定(挙動変更なし)。**decay を peak→0 か peak→livingBase かにするかの設計裁定は依然 open**(下記§7 申し送り)。

## 4. コメント修正の diff 概要(source, 挙動無影響)

`apps/runtime-player/src/main/role-composition/input-subsystem.ts` の2箇所、disconnect の write を旧C4「clearAll」から実装どおり「releaseAll」へ(文言のみ、コード挙動不変):
- :67付近(型 doc) — `` `setOverlay` on accept, `clearAll` on disconnect `` → `` `setOverlay` on accept, `releaseAll` on disconnect ``
- :229付近(composer コメント) — `WRITES setOverlay/clearAll` → `WRITES setOverlay on accept / releaseAll on disconnect`(行折返しも整形)

※ 同ファイルの `getChannelOverlay: (nowMs, baseValues, prevResolved) => …` 拡張は**loop-1 の未コミット変更**であって本ループの変更ではない(私は当該行に触れていない)。

## 5. テスト結果(pass/fail・既知baseline分離)

コマンド(Windows/PowerShell 相当・`pnpm install` 不使用・既存 node_modules):

- 対象2ファイル `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay` → **24 passed**(store 13→**15**, heart-overlay 7→**9**; 計 +4本すべて green)。
- `npm run typecheck`(`tsc --noEmit -p tsconfig.json`)→ **pass**(exit 0)。
- 全体 `npx vitest run -c vitest.config.ts` → **832 passed / 2 failed / 136 files**(loop-1 の 828 passed から +4、失敗数は不変)。
- **既知baseline fail 2件**(本ループ責任外・分離確認): `src/stage/browser-source/browser-source-server-message.test.ts:216` と `src/stage/broadcast-source/browser-source-server.test.ts`、いずれも `effectiveDynamicsTuning: null` の schema drift(Wave21 由来)。overlay/曲線と無関係、当該ファイルは無変更。

## 6. 触っていないことの確認

- **source 曲線ロジック無変更**: `slot-curve-state.ts`(未コミット新規=loop-1成果、本ループで無編集)・`control-channel-overlay-store.ts`(評価ロジック)・`autonomous-frame-heart.ts`(マージ/retain)いずれも**私は編集していない**(Edit は input-subsystem.ts コメント + 2テストファイルのみ)。git status 上の他 source 変更(channel-server.ts 等)は loop-1 の未コミット残置。
- physiology/ ・`headless-slot-resolver.ts` ・contract JSON ・Runtime Export schema ・package-format ・Editorソース: 無変更。
- smoothstep を physiology から import せず(bound-walk は `RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE` 定数参照のみ、smoothstep 評価不要)。
- `pnpm-lock.yaml` 無変更(`pnpm install` 未実行・回避工作なし)。`apps/soul` 無変更(package.json追加なし)。
- 実行時 role分岐の新設なし。拒否コード列挙に追加なし。無関係変更の revert なし。

## 7. 質問 / escalate

- **escalate: なし**(テスト4は連続で pass、bound超過 observe されず)。
- **申し送り(既存 open 論点の再掲、本ループでは裁定しない)**: lane3 質問2 の「envelope decay が **base非依存に0へ**落ちる(非零baseでは dip 後 release で戻す)」意味論は、テスト4で**現状挙動として無害に固定**したが、これが意図どおり(peak→0)か、それとも decay を peak→livingBase にすべきか、は依然 lane2/設計(Undine)の裁定事項。連続性は保たれているため実装は現状のままで問題ないが、**表現意図として dip-below-base が望ましいかは美的/設計判断**として残る。テストは挙動を変えず固定しているので、将来 decay意味論を変える場合はテスト4の characterization を更新する必要がある(その時に気づけるよう `sawDipBelowBase` assertion で明示)。
