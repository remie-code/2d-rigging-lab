# C3 Domain A 実装報告: `cohost-c3-noise-and-config-seam`

> 実装: Gnome(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> source of truth: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §4.1/§6/§9、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §1.2/§2、[c3-planning-inventory.md](../../orchestration/c3-planning-inventory.md) §2.1/§2.5。
> Status: 実装完了・対象テスト/typecheck パス。escalate なし。

---

## 1. 要約(柱1/2/3)

Domain A の3本柱を実装した。behaviors 自体(gaze/head/posture)は Domain B のスコープなので実装していない。基盤ヘルパ + config seam + blink 載せ替え + それぞれのテストまで。

### 柱1: 閉形式の決定論ノイズ/バネ ヘルパ

新規 `physiology/deterministic-noise.ts`。時刻の純関数として振る舞う3素子:

- **`smoothValueNoise(seed, channel, timeMs, cellMs)`**: 整数時刻ラティス(セル幅 `cellMs`)で `hashUnit` を2点引き、補間する value-noise。返り値は home=0 中心の [-1,1]。value-noise は本質的に**有界かつ平均回帰**であり、これが「dt積分なしの閉形式の減衰バネ」の観測的シグネチャそのもの(裁定1: 積分状態を持たない)。
- **`layeredValueNoise(seed, channel, timeMs, layers)`**: 時間軸(cellMs)の異なるオクターブを振幅比で重ね、重み和で正規化([-1,1]維持)。各層は distinct channel で decorrelated。設計§1.2「時間軸の違う層の重ね」= 合成周期を30秒窓の外に出す。
- **`homeSpringValue(seed, channel, timeMs, params)`**: `home + amplitude · shape(layeredValueNoise)`。`homePull∈[0,1]` は偏差を符号付きベキ(≥1)に整形し、mid-range を home へ寄せる(全点で `|shaped|≤|dev|`、増幅しない)。設計§4-5「静止に句読点」(アンチパターン5)への直接の対処。稀な全振れは amplitude に到達、通常はhomeに寄る。

**設計判断(裁量、docstring に選択理由を記載)**:
- **ラティス粒度**: セル幅 `cellMs`(ms)で層ごとに timescale を表現。既存 `hashUnit` の seeded-noise flavor を再利用(新規乱数なし)。
- **補間関数**: value-noise には **quintic smootherstep(6t⁵−15t⁴+10t³)** を採用(blink エンベロープの cubic 3t²−2t³ ではなく)。quintic はラティス点で1次導関数がゼロ→C²連続で、セル境界の速度キンクが出ない(連続「生きた」ノイズでは単一周波数的な機械読みを避けるためこの追加連続性が効く)。境界での不連続無しをテストで固定。
- **層数**: ヘルパは層数非依存(`NoiseLayer[]` を受ける)。普遍既定の3層比(fast/mid/slow)は Domain B が behaviors 側で与える設計(設計§6「3層比は普遍既定」)。
- **バネの表現**: OU過程の dt積分ではなく「積分済みの減衰乱歩」= value-noise の有界・平均回帰性で表現(inventory §2.1 の推奨、C2純関数fixture規律と整合)。

### 柱2: ツマミ即時反映 config seam(裁定3)

新規 `physiology/physiology-config.ts` + heart/subsystem 配線:

- **config 型 `PhysiologyConfig`**: `{ schemaVersion, blink: BlinkBaselineConfig }`。Domain A 時点では **blink baseline のみ**(C3 modulation=恒等なので effective=baseline)。将来の behavior に開いた形(Domain B が `gaze?`/`head?`/`posture?` を optional 追加、`createPhysiologyBehaviorsFromConfig` が現れた順に fan-out)。schemaVersion は Domain C の stale拒否用。
- **config provider `PhysiologyConfigProvider = () => PhysiologyConfig`**: 合成deps `RuntimePlayerInputSubsystemDependencies` に `physiologyConfigProvider?` を追加。**autonomousHost composer(`composeStaticInputSubsystem`)だけが heart に配線**、trackingHost composer は無視(role差は合成テーブルのこの1点のみ、実行時 `if(role===)` 分岐なし)。未注入時は heart 側で universal-default に fallback = C2挙動。
- **heart の口**: `autonomous-frame-heart.ts` に `getPhysiologyConfig?` seam を追加。**tick 毎に provider を読み、参照が変わったら(ツマミが動いたら)同一 seed で generator を再構築**(参照安定なら再構築なし=毎tickコストなし)。位相不連続は許容(rebuild で活性度が跳んでよい)。config は `Heartbeat` に保持し参照比較。
- **持ち主**: config の持ち主は「Physiology state(main、両ロール共通)」の設計。Domain A では default provider を注入 seam として作り、Domain C がその供給源を実 Physiology state に差し替える。default注入 seam の流儀は既存 `createAutonomousFrameHeart?` に倣った。
- **publish 経路への影響**: なし。seam は heart 内部(config読み+再構築)+ 合成depsの1 provider に閉じた。`liveParameters.publishFrame` / sanitization境界 / frame stamping は無改修。→ **escalate 不要**(§6 Domain A の escalate 条件に該当せず)。

### 柱3: Blink baseline を config 経路へ載せ替え(退行ゲート)

- heart は `createGenerator({ seed })`(behaviors 無し=既定blinkハードコード)から、`createGenerator({ seed, behaviors: createPhysiologyBehaviorsFromConfig(config) })` に変更。blink baseline は config から来る。
- **退行ゲート**: `DEFAULT_PHYSIOLOGY_CONFIG.blink = DEFAULT_BLINK_BASELINE` かつ modulation=identity なので、`physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG)` は C2 `DEFAULT_BLINK_CONFIG` と deep-equal。→ 既定 config 経路の出力が C2 blink と byte-identical。
- **golden 2本は不変**(ファイル・テスト共に無変更)。新規テストで「既定 config 経路の出力 = committed golden JSON」を byte-for-byte 固定(golden 自体は読むだけ)。

---

## 2. 作成/変更ファイル(絶対パス)

### 新規作成
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\deterministic-noise.ts`(柱1 ヘルパ)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\deterministic-noise.test.ts`(柱1 純関数性/平滑性テスト)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\physiology-config.ts`(柱2/3 config型・mapping)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\physiology-config.test.ts`(柱3 mapping/golden不変)

### 変更
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\index.ts`(新規 export 追加)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(config provider seam + tick再構築 + start を config経路化)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.test.ts`(config seam テスト2本追加)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(`physiologyConfigProvider?` dep + autonomous composer 配線)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.test.ts`(provider forwarding/無視テスト2本追加、既存 heart-args 期待更新)

**触れていない**(スコープ厳守): golden JSON 2本、`headless-slot-resolver.ts`、`body-follow-state.ts`(裁定2: config seam は body-follow-state を経由しない)、Editor / package-format / Runtime Export schema / lockfile。`pnpm install` 未実行、新規依存なし。

---

## 3. テスト結果

コマンド:
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/physiology src/main/role-composition
```
結果: **8 files / 68 tests すべてパス**。内訳の要点:

- 柱1 純関数性: 同time同値・seed/channel決定論・decorrelated(`deterministic-noise.test.ts`)。
- 柱1 平滑性: 隣接16msサンプル差が解析的 value-noise 境界 `NOISE_SPAN·SMOOTHERSTEP_MAX_SLOPE·(dt/cellMs)` 以下・セル境界連続・homePull下でも有界。加えて30秒窓での合成周期非検出(自己相関 <0.5、裁定5 の機械側代理)。
- 柱2 config差し替え: provider参照変化で次tick再構築・安定時は再構築なし・同seed維持・再構築behaviorsが新configのblinkを反映(`autonomous-frame-heart.test.ts`)。provider forwarding は autonomousHost のみ・trackingHost は provider を読まない(`input-subsystem.test.ts`)。
- 柱3 golden不変: 既定config経路の出力が `blink-default.golden.json` と byte-identical(`physiology-config.test.ts`)。既存 golden 2本(`blink-behavior-fixture.test.ts` 4 tests)も無変更でパス。
- タイマーリーク: 既存 `autonomous-frame-heart.test.ts` の load→load / stop冪等 / fake-timer lifecycle が退行なくパス(13 tests、うち config seam 2本追加)。
- physiology/ 純度構造テスト(`blink-behavior.test.ts` 内)が新規2ファイルを含めスキャンしパス(Electron/壁時計/非シード乱数ゼロ)。

golden ファイルの git diff-stat: **空**(無変更を確認)。

## 4. typecheck 結果

コマンド:
```
pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck   # tsc --noEmit -p tsconfig.json
```
結果: **パス(エラーなし)**。途中 `exactOptionalPropertyTypes: true` で config provider の undefined 明示渡しが弾かれたため、composer 側で「provider があるときだけプロパティを含める」条件スプレッドに修正して解消。

既知 baseline fail(browser-source-server系2件、Wave21由来)は対象範囲外のため未実行・未変更。

---

## 5. 裁量判断(設計未定義を合理的に実装した箇所)

1. **補間関数に quintic smootherstep を採用**(blinkのcubicではなく)。連続ノイズのC²連続性のため。docstring に理由を明記。
2. **`homePull` の実装 = 符号付きベキ整形**。設計は「ホームバネ」の意味論のみ規定。dt積分を避けつつ「静止に句読点」を出す手段として、全点で非増幅(`|shaped|≤|dev|`)・符号保存・端点保存(dev=±1→±amplitude, 0→home)・C¹ を満たすベキ整形を選択。amplitude と別軸の質感語(restlessness等)に写せる形。
3. **config 型に `schemaVersion` を含めた**。Domain A では未使用だが、Domain C の stale拒否(schemaVersion不一致reject、裁定4)に前もって開いておくため。値は `"runtime-player-physiology-config-v1"`。
4. **層数はヘルパで固定せず `NoiseLayer[]` 受け**。普遍既定の3層比は Domain B が behaviors 側で持つ設計(設計§6)。Domain A は基盤のみ。
5. **config 変更検知は参照比較**。provider は「変化時のみ新オブジェクト」を返す契約(docstringに明記)。default provider は定数を返す=再構築なし。Domain C の immutable state は revision毎に新オブジェクトを返すので自然に噛む。
6. **heart への seam 名は `getPhysiologyConfig`、deps 側は `physiologyConfigProvider`**。deps は「config provider」の設計語彙、heart は「毎tick読むgetter」の役割を表す命名。両者とも `() => PhysiologyConfig`。

---

## 6. 質問(Orch/ユーザー判断が要る点)

なし(裁定1〜3で Domain A の設計論点は解消済み)。以下は Domain B/C への申し送りのみ:

- **Domain B**: `homeSpringValue`/`layeredValueNoise`/`smoothValueNoise` を head/posture behaviors の基盤として消費する想定。3層比・目頭協調の遅延分布・sway/drift の質感語→(amplitude, homePull, layers)写像は Domain B で決める(設計§6)。`PhysiologyConfig` に `gaze?`/`head?`/`posture?` を optional 追加し、`createPhysiologyBehaviorsFromConfig` に fan-out を足す(既存 blink 経路は不変のまま)。
- **Domain C**: `physiologyConfigProvider` の供給源を実 Physiology state(revision追跡・override map・profile永続化)に差し替える。provider は「変化時のみ新参照」を返すこと(heart の参照比較再構築の前提)。runtime-player-main の `composeRuntimePlayerInputSubsystem(launch.role, {...})` 呼び出しに `physiologyConfigProvider` を1行足す(autonomousHost のみ効く、trackingHost は無視で role分岐不要)。

## 7. escalate / blocked

なし。config seam は heart内部 + 合成deps 1 provider に閉じ、publish経路/sanitization境界/frame stamping の広い改修は不要だった(§6 Domain A の escalate 条件に非該当)。
