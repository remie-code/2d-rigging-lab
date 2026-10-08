# C3 Domain B レビュー — レーン1: spec compliance

> レビュー: Review-Sylph(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> 対象実装: `cohost-c3-gaze-head-posture-behaviors`(Gnome報告: [../../waves/c3/domain-b-gaze-head-posture-behaviors.md](../../waves/c3/domain-b-gaze-head-posture-behaviors.md))
> basis: [c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §1-§4/§6、[c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §3/§4.2/§6-§10。

## 判定: **合格**

設計討議の三現象・文法・結合3つ・アンチパターン回避・質感語対応、および wave plan の責務境界に忠実。ブロッキング事項なし。7点の裁量/申し送り注記(いずれも非ブロッキング)を末尾に挙げる。証拠: physiology テスト **9 files / 92 tests 全パス**、blink core・blink golden 2本 unmodified(git status で確認)、physiology/ 純度スキャン(grep で Electron/Math.random/壁時計 import ゼロ、コメント言及のみ)。

---

## レーン別ブロッキング観点の突合

### 1. 三現象(§1) — 忠実
- **gaze = 離散サッカード+固視**: `gaze-saccade.ts` が「固視→瞬時ジャンプ→固視」の離散列を event-walk + forward-only cursor で実装(`walkGazeTo`)。着地点間の補間なし。固視中は着地点に留まり微小揺らぎ(振幅 0.015)のみ。連続漂いではない。✓
- **head = 多時間軸3層ノイズ**: `HEAD_LAYERS` = fast 900ms / mid 6000ms / slow 45000ms(振幅比 0.25/0.6/1.0)。設計§1.2 のタイムスケール(1秒未満〜数秒 / 数秒〜十数秒 / 数十秒〜数分)に**厳密一致**。tilt は 2層。単一周波数でない。✓
- **posture = 遅いドリフト+稀な組み替え**: `POSTURE_DRIFT_LAYERS` = 22s/47s の2層(遅いドリフト)+ reseat event(base 150s / min 40s、設計§1.3「数分に一回オーダー」)。二階建て成立。✓

### 2. 結合3つ(§3) — 3つとも実装され意味論一致
- **①目先頭後**(§3-1): `head-behavior.ts` が `deriveBehaviorSeed(couplingSeed, GAZE_BEHAVIOR_ID)` で gaze スケジュールを再計算し、**大サッカードのみ**(`isLarge`, 距離>0.4)を遅延 `300 + hashUnit·400` = 300〜700ms で追従。`gain = FOLLOW_MAX_GAIN(0.6) × config.follow ≤ 0.6 < 1` で**途中まで=全部向かない**。目は瞬時着地、頭は遅れて部分追従。✓
- **②大サッカード瞬き同期**(§3-2): `saccade-blink-coupling.ts` が独立 behavior として gaze スケジュールを再計算し、各大サッカードで `hashUnit < SACCADE_BLINK_PROBABILITY(0.3)` の**確率的**同期 blink を eye スロットへ emit。✓
- **③体は頭の親**(§3-3): head が `deriveBehaviorSeed(couplingSeed, POSTURE_BEHAVIOR_ID)` で posture の**reseat 基線**(drift 除く)を再計算し、`0.4·bodyX` を head-h、`0.5·bodyZ` を head-tilt へ加算。組み替えが頭の基線ごと動く階層。reseat(組み替え)成分のみを親にする読みは設計「組み替えは頭の基線ごと動かす」に忠実。✓

seam 機構(`couplingSeed` = session seed の共有 + `deriveBehaviorSeed` 同一導出による兄弟 sub-seed の厳密再計算)は状態共有ゼロで結合を成立させており、純度・決定論を損なわない。

### 3. アンチパターン回避(§4) — 全5点回避
- **①滑る視線(lerp)不在**: `walkGazeTo` は離散着地点を返し補間しない。サッカードは1フレームで着地距離ぶん跳ぶ。テスト固定あり。✓
- **②単一周波数不在**: head 3層 / posture drift 2層 / tilt 2層。✓
- **③無結合でない**: 結合3つ実装済み。✓
- **④完全中心回帰でない**: head home は `homeSpringValue` の slow層(45s, 振幅1.0)が spring 内にあり中心が漂う+ posture reseat 基線が head home に乗る。連続 value-noise ゆえ「固定ホームへ戻ってリセット」する離散復帰イベント自体が存在しない。✓
- **⑤動きすぎでない**: `HEAD_HOME_PULL(0.5)` が mid-range 偏差を home へ寄せ、静止に句読点。✓

### 4. 質感語対応(§6) — 対応表に厳密一致
config 露出フィールドは gaze `{cameraFocus, restlessness, dwellMs}` / head `{sway, follow}` / posture `{drift, restlessness}` = §6表の7素子に**過不足なく一致**。イージング・3層比・遅延分布(300-700ms)・バケツ幾何・不応期・同期確率(0.3)は全て module 内定数で config 非露出=**普遍既定**。✓
**魂不在**: `pickLanding` は `GAZE_BUCKETS` の重み付き抽選(hashUnit)で着地点を決め、意味を持たない=§1.1「意味を持たない空間バケツの重み付き抽選」に忠実。カメラ支配(既定 cameraFocus 0.6 でホーム比率 ~75%)。✓

### 5. 責務境界(§3.2/§9) — 遵守
- blink golden 2本: git status に現れず(unmodified)。`blink-behavior-fixture.test.ts`(4)パス。✓
- blink core (`blink-behavior.ts`): git 未変更。結合2は独立 behavior + generator の max-abs マージで達成、core 無改変。✓
- Domain A テスト: `physiology-config.test.ts`(4)・`deterministic-noise.test.ts`(14)パス。✓(注記2参照)
- `headless-slot-resolver.ts` / `semantic-slot-definitions.ts` / `body-follow-state.ts` / Editor / package-format / schema / lockfile: git 未変更。✓
- 新規依存 / `pnpm install`: なし(package.json 差分なし)。✓
- 実行時 role 分岐: Domain B は physiology/ のみ変更。physiology は role 非依存で `if(role===)` なし。✓
- slot 配線: gaze→eyeball.x/y、head→face.angle.x/y/z、body-x/z→body.angle.x/z。`semantic-slot-definitions.ts`(既存・未変更)と一致し、既存リゾルバの centered -1..1 契約をそのまま通る。✓

### 6. physiology 純度(§9) — 遵守
- Electron import / 壁時計 / 非シード乱数: grep で新規6ソースに実 import ゼロ(コメント言及のみ)。✓
- 閉形式(dt積分なし): 全 sample が time の純関数。reseat 遷移は `smootherstep((t-startMs)/RESEAT_TRANSITION_MS)` の閉形式ランプ。cursor/ring は forward-only メモに過ぎず from-epoch 評価と一致(cursor 等価テストで固定)。✓
- `body-follow-state` 非経由(裁定2): posture が一切 import せず(構造テスト+grep で確認)。✓
- sanitization 境界: `couplingSeed` は `BehaviorSampleInput`(main 内)に留まり、generator `sample` の返り値(slot activation の Record のみ)には載らない。✓

### 7. Domain B スコープ — 先食いなし
- UI(Domain C): config フィールドを追加したのみ。store/state/page/bridge なし。`DEFAULT_FULL_PHYSIOLOGY_CONFIG` は config 定数であって UI ではない。heart の既定 provider(blink-only)は**意図的に未変更**で、フル config の実配線は Domain C に残した。先食いなし。✓
- fixture 配分(§7/裁定5): blink=フル golden 維持、連続系=代表時刻スナップショット(`full-generator-snapshot.golden.json` 25時刻×8スロット)+分布属性+周期非検出。裁定どおり。✓

---

## Gnome Q1 への見解(blocking でない)

**Q1**: heart 既定を blink-only に保ち、フル既定を `DEFAULT_FULL_PHYSIOLOGY_CONFIG` として別出しした判断は Domain C 前提として妥当か。

**見解: 妥当かつ spec 整合。** 根拠:
- wave-plan §4.1/§4.3/裁定3 が「config の持ち主は Physiology state(main)」「Domain C が provider の供給源を実 state に差し替える」「Domain C が既定ON config を組み立てる」と明記。**走行時の既定 config を決めるのは Domain C の責務**。Domain B が heart 既定を差し替えると (a) Domain A の retirement gate テスト(default→[blink])と (b) blink golden 退行ゲートの双方を壊す。よって差し替えないのが正しい。
- `DEFAULT_FULL_PHYSIOLOGY_CONFIG` を土台として提供したのは Domain C への清潔な申し送りで、過剰でない(Domain C は使うも上書きするも自由)。

**ただし Orch へ要注意事項(下記注記4)**: Domain B 単独では走行時挙動が blink のみ。Product Goal §2 と手動ゲート §7-1/§7-2(視線・頭・姿勢が生きて見える)は **Domain C が `DEFAULT_FULL_PHYSIOLOGY_CONFIG`(または profile 上書きクローン)を provider 既定に配線して初めて観測可能**。Orch は Domain C の AC にこの配線を明示的に含めること。

---

## 非ブロッキング注記(裁量・申し送り)

1. **gaze 微小揺らぎ(0.015)は設計未記載の裁量**。§1.1 は固視中の micro-jitter を明示許可していないが、振幅 0.015 は LARGE_SACCADE_THRESHOLD(0.4)・バケツ間隔より遥かに小さく、着地点間の smooth slide を生まない=§4-1「滑る視線」に抵触しない。「留まるが生きている」の合理的付加。問題なし。
2. **Domain B が Domain A の `deterministic-noise.test.ts` に quintic C¹/C² テスト2本を追加**(Domain A 申し送り対応)。test-only の additive でクロスドメインだが、Domain A が申し送った quintic 消費の連続性固定として正当。深追いはレーン3(test adequacy)へ委ねる。
3. **`physiology-generator.ts` のマージ意味論を last-write-wins → max-abs-on-collision へ変更**(C2 共有ファイル)。結合2の union 意味論に必要。C2 blink-only 経路は単一所有スロットで衝突が起きず挙動不変(golden・generator テスト8本パスで確認)。Gnome が§2/§5で報告済み。妥当。
4. **クロスドメイン依存(Orch 向け)**: 注記済みのとおり、走行時にフル生理を観測するには Domain C の provider 既定配線が必須。Domain B 完了=走行時 blink のみ、は設計順序どおり(Domain C は「B の後」)だが、手動ゲートを Domain C 完了まで判定不能にする点を Orch が追跡すること。
5. **`deriveBehaviorSeed` リファクタは sub-seed を保存**: `mixSeeds(seed>>>0, hashStringToSeed(id))` と数値的に同一導出。C2 blink sub-seed 不変→golden 不変。確認済み。
6. posture 既定 restlessness 0.4 で平均 reseat 間隔 ~107s(~1.8分)。設計§1.3「数分に一回オーダー」の頻度側寄りだがオーダー内。許容。
7. head follow の追従先は大サッカードの**絶対着地座標**で、gain≤0.6 により最大でも着地点の60%地点に頭が到達=「途中まで/全部向かない」。連続する大サッカード着地点間を smootherstep ランプ。設計§3-1 に忠実。

---

## 質問(Orch へ)
なし。Q1 は上記で見解表明済み。
