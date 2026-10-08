# C3 Domain B 実装報告: `cohost-c3-gaze-head-posture-behaviors`

> 実装: Gnome(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> source of truth: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §4.2/§6/§9、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §1-§4/§6、[domain-a-noise-and-config-seam.md](domain-a-noise-and-config-seam.md) §6 申し送り、[c3-planning-inventory.md](../../orchestration/c3-planning-inventory.md) §2.1/§2.2。
> Status: 実装完了・対象テスト117件パス・typecheck パス・blink golden 2本不変・Domain A テスト不変。escalate なし。質問1件(Domain C への確認、下記§8)。

---

## 1. 要約

Domain B のスコープ全体を実装した: 振る舞いクラス3種(gaze / head / posture)+ 結合3つ + config 拡張(gaze/head/posture の内部素子フィールド)+ fixture 拡張 + Domain A 申し送りの quintic C² 連続テスト。Domain A の閉形式ヘルパ(`smoothValueNoise`/`layeredValueNoise`/`homeSpringValue`)と event-walk + forward-only cursor パターンの上に乗っている。既存 blink 経路・Domain A の config seam・blink golden 2本は完全に不変。

---

## 2. 結合3つの実装機構と選択理由(**設計判断の核**)

### 選んだ機構: 「couplingSeed 共有 seam + 純関数スケジュール共有」(planning の選択肢(b)を清潔化したもの)

現 `physiology-generator.ts` は各 behavior を独立 seed で sample して merge する。behavior の sub-seed は `mixSeeds(sessionSeed, hashStringToSeed(behaviorId))` で導出され、**ある behavior は兄弟の sub-seed を復元できない**(seed を逆算できない)。これが結合の本質的障壁だった。3つの選択肢((a) generator が仲介 / (b) 兄弟スケジュール再計算 / (c) 合成 behavior)を評価し、**(b) を選んだ**。理由:

- **有効化の一手**: `BehaviorSampleInput` に `couplingSeed?`(= session seed)を追加。generator は各 sample に session seed を渡す(`deriveBehaviorSeed(couplingSeed, siblingId)` で generator と**同一の**導出により兄弟の sub-seed を厳密に復元できる)。結合する behavior は兄弟の純粋スケジュールを**再計算**して参照する — 状態共有ゼロ、seed と兄弟 config のみ。
- **決定論と純度を保つ**: 全て (seed, couplingSeed, config, time) の純関数。`couplingSeed` は main プロセス内に留まりフレームに書かれない(sanitization 境界不変)。cursor/ring は forward-only の性能メモに過ぎず、from-epoch 評価と一致(cursor 等価テストで固定)。
- **(a) を却下**: generator を結合認識にすると「dumb merge / レパートリー拡張点は generator body 不変」という C2 契約を汚す。
- **(c) を却下**: gaze+head+posture を1つの合成 behavior にすると単一責務・独立テスト性を失う。分離した behavior + 共有純粋スケジュールモジュールで同じ結合を達成でき、そちらが清潔。

共有スケジュールは独立モジュールに切り出した: `gaze-saccade.ts`(gaze / head follow / saccade-blink が消費)、`posture-reseat.ts`(posture / head parent が消費)。`deriveBehaviorSeed` は `deterministic-hash.ts` に抽出し、generator と結合の双方が同一導出を使う(構成的に一致)。

### 結合1「目が先、頭が後」(§3-1)
head が couplingSeed→gazeSeed で gaze サッカードスケジュールを再計算し、**大サッカード**のみを 300〜700ms 遅れ(サッカード毎に普遍抽選、露出しない)で**途中まで**追従(followGain < 1「全部は向かない」)。追従ターゲットは直近の活性化した大サッカード2つを smootherstep でランプ。目は瞬時着地、頭は遅れて部分的 — テスト `head coupling 1` が「Ts+300 未満で follow ゼロ / delay+ramp 窓内で発火 / gaze 着地と同符号 / |follow| < |gaze|(全部向かない)」を固定。

### 結合2「大サッカードに瞬きが乗る」(§3-2、C2 §6.2 予約)
**blink コアは無改変**(golden 保全の最安全策)。独立 behavior `saccade-blink-coupling.ts` が gaze スケジュールを再計算し、各大サッカードで**確率的**(普遍 p=0.3、露出しない)に同期 blink を eye スロットへ emit。generator の**衝突時 max-abs マージ**により、同期 blink は自然 blink を**深めることはあっても切り詰めない**(union 意味論)。centered スロットは単一所有なので衝突は eye スロットのみ。テスト: 全フレームで full ≥ natural(自然 blink 不減)+ 注入 blink が実在 + 注入 blink は必ず大サッカード上に乗る。
- **裁量**: (A) blink 内に coupling を内包する案は、blink の緻密な forward-walk に外部イベント列をマージする必要があり golden リスク大。(B) 独立 behavior + max マージは blink コア無変更で層分離も良く、generator 変更は2行(衝突時のみ大きい方を採る)で証明可能に安全。**(B) を選択**。

### 結合3「体は頭の親」(§3-3)
head が couplingSeed→postureSeed で posture の**reseat 基線**(ドリフト除く、smootherstep ランプ付き閉形式)を再計算し、head のホームに `0.4·bodyX`(horizontal)/ `0.5·bodyZ`(tilt)を加算。姿勢の組み替えが頭の基線ごと動く階層。テスト `head coupling 3` が「head_with − head_without == 0.4·reseat.x(厳密)」を複数時刻で固定。

---

## 3. 3 behavior の設計判断

### gaze(`gaze-saccade.ts` + `gaze-behavior.ts`)
- **離散列**: blink の event-walk + forward-only cursor を流用。固視 → 瞬時ジャンプ → 固視。
- **固視時間分布**: dwell 中心(config)× 対称ジッタ 0.6、**最短不応期 200ms** で floor(等間隔=即機械回避)。restlessness が dwell を短縮。テストは分散 > 100ms、floor 不可侵、短 dwell config で floor が実際に binding することを固定。
- **着地点分布**: **意味を持たない重み付き空間バケツ抽選**(魂不在)。カメラ/ホーム(0,0)支配 + 相方側/斜め上下/さまよう。cameraFocus がホーム重みを増、restlessness が脇バケツ重み+空間広がりを増。実測: ホーム近傍 76%、大サッカード 34%。
- **瞬時遷移(lerp 禁止=§4-1)**: サッカードは1フレームで着地距離ぶん跳ぶステップ。固視中は着地点に留まり微小揺らぎ(振幅 0.015)のみ。テストが「1フレームジャンプ ≈ 着地距離 / 固視中フレーム差 < 0.02 かつ < ジャンプ/5」で lerp 不在を固定。

### head(`head-behavior.ts`)
- **3層ノイズ**: fast(900ms)/ mid(6000ms)/ slow(45000ms)、振幅比 0.25/0.6/1.0 = 普遍既定(露出しない)。`homeSpringValue` 経由で消費。単一正弦回避。
- **ホーム自体が slow 層で揺れる**(§4-4 完全中心回帰回避): slow 層が spring 内にあり中心が漂う。加えて結合3で posture 基線に乗る。
- **homePull=0.5**(§4-5 静止の句読点): 実測ホーム近傍 82%。
- tilt は 2層・小振幅(0.32)。Sway が全体振幅、Follow が結合1深さ(§6)。
- **周期非検出**: 平均除去自己相関(slow ドリフトが有限窓に微小 DC を与えるため平均除去が標準)で 30s ラグ 0.30 < 0.5、20〜90s 帯で 0.5 未満(ループ不在=リバウンドしない)。

### posture(`posture-reseat.ts` + `posture-behavior.ts`)
- **常時ドリフト**: 遅い2層(22000/47000ms)`layeredValueNoise`、振幅小(0.35·drift)。単一周波数回避のため drift も2層。
- **稀な組み替え**: event-walk。平均間隔 150000ms/(1+restlessness)、**最短不応期 40000ms**、smootherstep ランプ 1600ms で基線が別位置へ移り**留まる**。実測: 1h で ~33回、平均 ~108s(数分オーダー)。
- **body 平滑は生成器内部の閉形式で完結(裁定2)**: reseat 遷移は smootherstep ランプ(time の純関数)。**`body-follow-state` を一切 import しない**(構造テストで固定)。body-z は下流減衰(rot 0.25/pos 0.4)ゆえ full ±1 でも最終変位小。実測 body 値域 ~±0.34。

---

## 4. config 拡張の形(§6 対応表)

`PhysiologyConfig` に **optional** `gaze?`/`head?`/`posture?` を追加(baseline のみ、C3 modulation=恒等)。内部素子フィールド:

| behavior | フィールド | §6 質感語 |
|---|---|---|
| gaze | `cameraFocus` | Camera Focus(着地点ホーム重み) |
| gaze | `restlessness` | Restlessness(サッカード頻度+空間広がり) |
| gaze | `dwellMs` | Dwell(固視時間分布中心) |
| head | `sway` | Sway(層状ノイズ振幅、3層比は普遍既定) |
| head | `follow` | Follow(目頭協調追従深さ) |
| posture | `drift` | Drift(常時ドリフト振幅) |
| posture | `restlessness` | Restlessness(組み替え頻度) |

イージング・3層比・追従遅延分布・バケツ幾何・不応期・同期確率は**普遍既定で露出しない**(§6)。UI は Domain C スコープ外。

`createPhysiologyBehaviorsFromConfig` が config にある behavior を fan-out: blink(常時)→ gaze → head(gaze/posture を結合 config として受ける)→ posture → saccade-blink(gaze present 時のみ)。**`DEFAULT_PHYSIOLOGY_CONFIG` は意図的に blink-only のまま**(Domain A の config seam テスト = default → [blink] を不変に保つ)。フル4系統の既定は新規 export **`DEFAULT_FULL_PHYSIOLOGY_CONFIG`**(→ Domain C 申し送り §8)。

---

## 5. 作成/変更ファイル(絶対パス)

### 新規作成(source)
- `...\apps\runtime-player\src\main\physiology\gaze-saccade.ts`(共有サッカードスケジュール: 結合の背骨)
- `...\apps\runtime-player\src\main\physiology\gaze-behavior.ts`(gaze 振る舞いクラス)
- `...\apps\runtime-player\src\main\physiology\head-behavior.ts`(head 振る舞いクラス + 結合1/結合3)
- `...\apps\runtime-player\src\main\physiology\posture-reseat.ts`(共有 reseat スケジュール)
- `...\apps\runtime-player\src\main\physiology\posture-behavior.ts`(posture 振る舞いクラス)
- `...\apps\runtime-player\src\main\physiology\saccade-blink-coupling.ts`(結合2)

### 新規作成(test / golden)
- `...\physiology\gaze-behavior.test.ts`(15 tests)
- `...\physiology\head-behavior.test.ts`(11 tests)
- `...\physiology\posture-behavior.test.ts`(11 tests)
- `...\physiology\physiology-coupling.test.ts`(10 tests: fan-out / 結合2 / フル generator / 代表時刻スナップショット / posture 周期非検出)
- `...\physiology\full-generator-snapshot.golden.json`(代表時刻スナップショット、25時刻×8スロット。900frame 肥大回避)

### 変更(既存)
- `...\physiology\deterministic-hash.ts`(`deriveBehaviorSeed` 抽出・export。既存 `hashUnit`/`mixSeeds`/`hashStringToSeed` 不変)
- `...\physiology\behavior-class.ts`(`BehaviorSampleInput.couplingSeed?` 追加。optional なので既存呼び出し不変)
- `...\physiology\physiology-generator.ts`(`deriveBehaviorSeed` 使用へ refactor(sub-seed 同一)・`couplingSeed` 転送・衝突時 max-abs マージ)
- `...\physiology\physiology-config.ts`(gaze/head/posture optional 追加・fan-out 拡張・`DEFAULT_FULL_PHYSIOLOGY_CONFIG` 追加。`DEFAULT_PHYSIOLOGY_CONFIG` 不変)
- `...\physiology\index.ts`(新規 export 追加)
- `...\physiology\deterministic-noise.test.ts`(**quintic C¹/C² 連続テスト 2本追加** = Domain A 申し送り。既存 12 tests 不変)

**触れていない**(スコープ厳守): blink golden 2本(`blink-default.golden.json`/`blink-alt-config.golden.json`)、`blink-behavior.ts`(コア無変更)、`blink-behavior-fixture.test.ts`、`physiology-config.test.ts`(Domain A)、role-composition の heart/subsystem(Domain A/C 領域)、`headless-slot-resolver.ts`、`body-follow-state.ts`、`semantic-slot-definitions.ts`、Editor / package-format / Runtime Export schema / lockfile。`pnpm install` 未実行、新規依存なし。

---

## 6. テスト結果

コマンド:
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/physiology src/main/role-composition
```
結果: **12 files / 117 tests すべてパス**。要点:
- **blink golden 2本不変**: `git diff --stat` が空(byte 変化ゼロ)。`blink-behavior-fixture.test.ts`(4)・`physiology-config.test.ts`(4、Domain A 退行ゲート含む)がパス。
- **Domain A 不変**: `deterministic-noise.test.ts` 既存12・`autonomous-frame-heart.test.ts`(13)・`input-subsystem.test.ts`(9)・`physiology-generator.test.ts`(8、couplingSeed/merge 変更後もパス)。
- **quintic C¹/C² 連続テスト追加(申し送り対応)**: `deterministic-noise.test.ts` に2本追加。ラティス点で数値速度 ≈0(linear 退行を検知)+ 数値加速度 ≈0(cubic 退行を検知、quintic S''(0)=S''(1)=0 を固定)。→ quintic→cubic/linear の補間退行を検知可能に。
- **分布属性**: gaze 固視時間分散+不応期 floor(binding 確認)・着地点ホーム重み 50%超・大サッカード population。posture reseat 頻度(数分オーダー)+不応期 floor。head follow 遅延 300〜700ms 窓。
- **周期非検出(裁定5)**: head(平均除去自己相関、30s=0.30<0.5、20-90s 帯ループ不在)・posture body-x(30-90s 帯<0.6)。
- **決定論の芯**: 同 seed/config/time→同値、同種同列・異種異列、cursor 等価性(gaze/head/posture 各離散 behavior で forward-walk=from-epoch)。
- **アンチパターン機械代理**: サッカード瞬時ステップ(lerp 不在)・head 静止の句読点(ホーム近傍 82%)。
- **physiology/ 純度**: 既存構造スキャン(`blink-behavior.test.ts`)が新規6ソースを含めパス(Electron/壁時計/Math.random ゼロ)。posture が `body-follow-state` を import しない構造テスト追加。

## 7. typecheck 結果
コマンド: `pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck`(tsc --noEmit)。**パス(エラーなし)**。`exactOptionalPropertyTypes: true` 対応で HeadCouplingConfig / PhysiologyConfig の optional は条件スプレッド/既定定数で構築。

既知 baseline fail(browser-source-server 系2件、Wave21由来)は対象範囲外・未実行・未変更。

---

## 8. 裁量判断 / 質問 / escalate

### 裁量判断(設計未定義を合理的に実装)
1. **`couplingSeed` seam** を BehaviorSampleInput に追加(結合の有効化手段)。optional=既存呼び出し不変・isolated テストでは結合が独立動作に degrade。docstring に純度/sanitization 根拠を明記。
2. **結合2を独立 behavior + max-abs 衝突マージ**で実装(blink コア無変更を優先)。§2 に選択理由。
3. **普遍内部定数**(3層比・遅延 300-700ms・不応期・バケツ幾何・同期確率 0.3・reseat 遷移 1600ms 等)は露出せず module 内定数(§6「露出しない」)。
4. **`DEFAULT_PHYSIOLOGY_CONFIG` を blink-only 維持**+ 別途 `DEFAULT_FULL_PHYSIOLOGY_CONFIG` を新設(Domain A テスト不変とフル既定の両立)。
5. **代表時刻スナップショット golden**(25時刻×8スロット)を採用(900frame 肥大回避、裁定5/§7 配分)。

### 質問(Orch/Domain C 判断が要る点)
- **Q1(Domain C 向け・blocking ではない)**: 自律ホストを「視線・頭・姿勢が生きる」状態にするには、config provider の**既定を `DEFAULT_FULL_PHYSIOLOGY_CONFIG`(または profile 上書きクローン)に差し替える**必要がある。Domain B は heart の既定 provider(`DEFAULT_PHYSIOLOGY_CONFIG` = blink-only)を**意図的に変更していない**(Domain A の heart/subsystem テストと blink golden 退行ゲートを不変に保つため)。したがって**現時点の実行時挙動は blink のみ**で、gaze/head/posture は config に載って初めて発火する。Domain C が Physiology state の既定を組み立てる際に `DEFAULT_FULL_PHYSIOLOGY_CONFIG` を土台にすること(この判断が Domain B の想定どおりか、あるいは Domain B 側で heart 既定を差し替えるべきだったかは Orch/Undine 確認)。

### escalate / blocked
- なし。リゾルバ変更不要(§3.2 の想定どおり、gaze/head/body は既存リゾルバの -1..1 centered 契約をそのまま通る)。`body-follow-state` 非経由(裁定2)を構造テストで担保。共有ファイル(behavior-class / deterministic-hash / physiology-generator / physiology-config / index)への変更は全て purely additive で既存契約・テスト・golden を退行させていない。
