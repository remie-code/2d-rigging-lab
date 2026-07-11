# C3 Domain A レビュー — レーン1: spec compliance

> Reviewer: Review-Sylph (opus)、2026-07-11。委任元: Orch-Sylph。対象: `cohost-c3-noise-and-config-seam` / `apps/runtime-player`。
> basis: c3-wave-plan.md §3/§4.1/§6/§8/§9/§10、c3-gaze-head-posture.md §1.2/§2/§4、c3-planning-inventory.md §2.1/§2.5、Gnome報告 domain-a-noise-and-config-seam.md。

## 判定: **合格**

wave plan / 設計討議 / 棚卸し の Domain A 仕様に忠実。blocking差分なし。全68テストパス、golden 2本およびスコープ外資産すべて無変更を自分で確認した。

---

## spec適合(観点ごと)

### 1. 柱の完全性 — 適合
- **柱1(閉形式ノイズ/バネヘルパ)**: `deterministic-noise.ts` に `smoothValueNoise` / `layeredValueNoise` / `homeSpringValue` + `NoiseLayer`/`HomeSpringParams`。設計§1.2「ホームへのバネ付き滑らかな乱歩の層重ね」・§2文法(ホーム+層状ノイズ)に対応。
- **柱2(config即時反映seam)**: `physiology-config.ts` の `PhysiologyConfig`/`PhysiologyConfigProvider` + heart の `getPhysiologyConfig` seam + 合成deps の `physiologyConfigProvider`。
- **柱3(Blink載せ替え)**: heart が `createGenerator({seed})` → `buildGenerator(seed, config)`(config baseline 由来 blink)へ。
- **behaviors 先食いなし(Domain B スコープ厳守)**: `createPhysiologyBehaviorsFromConfig` は blink 1本のみ返す。`PhysiologyConfig` は `blink` のみ(gaze/head/posture は未実装、optional 追加余地のみコメント)。ヘルパは素子のみで behavior クラス化していない。§4.1/§6 の Domain A 要求に一致。

### 2. 閉形式(裁定1)/ physiology純度 — 適合
- dt積分による非純関数化なし。`smoothValueNoise` は整数時刻ラティス上の `hashUnit` 2点を quintic 補間する logicalTime の純関数。`homeSpringValue`/`layeredValueNoise` も積分状態を持たない。frame cadence 非依存。
- `deterministic-noise.ts` は `hashUnit` のみ import。`physiology-config.ts` は `behavior-class`/`blink-behavior` のみ import。両新規ファイルとも Electron import・壁時計(`Date.now`/`performance.now`)・非シード乱数(`Math.random`/`crypto`)ゼロ。使用は `Math.floor/abs/pow/sign/min/max` の純演算のみ。

### 3. C2 blink golden 2本の既定設定完全不変 — 適合
- `git diff --stat -- '*golden*'` 空、golden 行の diff 空 = golden JSON 無変更。`blink-behavior-fixture.test.ts`(既存 4 tests)無変更でパス。
- 退行ゲートが固定されている: `physiology-config.test.ts` の "retirement gate" が、既定 config 経路の 900 フレーム出力を committed `blink-default.golden.json` と byte-for-byte 一致で pin。加えて `physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG)` が C2 `DEFAULT_BLINK_CONFIG` と deep-equal を pin。§4.1 柱3 / §8 の要求どおり。

### 4. body-follow-state 非経由(裁定2) — 適合
- config seam の経路は Physiology config → provider → heart → `createPhysiologyBehaviorsFromConfig` → generator。`body-follow-state`(EMA)を一切通らない。`physiology-config.ts`・`autonomous-frame-heart.ts` の diff に body-follow-state 参照の追加なし。

### 5. 実行時 role 分岐の不在 — 適合
- physiology/ と role-composition/ の実装コードに `if (role === autonomous/tracking)` なし。role差は合成テーブル `runtimePlayerInputSubsystemComposers`(data lookup)+ `composeStaticInputSubsystem` のみが provider を heart へ配線、の一点に留まる。`composeTrackingHostInputSubsystem` は provider を読まない(grep 上、`physiologyConfigProvider` の参照は dep 型定義と autonomous composer のみ)。
- 注記: `role-selection-stub.ts:43` の `if (role === null)` は既存の null ガードで本 diff 対象外。裁定違反ではない。

### 6. seam の位置(裁定3) — 適合
- 形が「Physiology config → 合成deps の config provider → autonomousHost のみ heart 配線」に一致。config 変更検知は heart tick 毎の参照比較 `config !== heartbeat.config`、変化時に**同一 seed で generator 再構築**(位相不連続許容、コメント明記)。参照安定時は再構築なし(毎tickコストなし)。§4.1「変更時に生成器を再構築(位相不連続許容)」に忠実。
- 未注入時は heart 内で `DEFAULT_PHYSIOLOGY_CONFIG` に fallback = C2 挙動。持ち主は main の Physiology state という設計に沿い、Domain A は default provider seam のみ提供(Domain C が供給源差し替え)。

### 7. 責務境界(§3.2 Out of Scope)/ sanitization / 無退行 — 適合
- 変更は physiology/ と role-composition/ のみ(`git status`: 変更5 + 新規4、全て対象内)。`headless-slot-resolver.ts` / `package.json` / `pnpm-lock.yaml` の diff 空を確認。Editor / package-format / Runtime Export schema 無変更。新規依存・`pnpm install` なし。
- publish 経路・sanitization 境界・frame stamping 無改修(seam は heart 内部 + 合成deps 1 provider に閉域)。renderer へシード・raw スロット流出なし。
- 対象スイート 8 files / 68 tests パス(既存 blink/generator/role-selection 含む退行なし)を自分で実行し確認。

---

## blocking差分
なし。

## 裁量注記(設計未定義の合理的実装。差分ではない)
1. **ヘルパの配置**: wave plan §3.1 は「`deterministic-hash.ts` の拡張」と表現するが、Gnome は sibling 新規ファイル `physiology/deterministic-noise.ts` を作り `hashUnit` を再利用した。意図(physiology/ 内・シード hash 再利用・新規乱数なし)は満たされており、単一ファイル肥大回避として妥当。spec 違反ではないが、basis の文言と配置が形式上ズレる点を記録。
2. **補間関数に quintic smootherstep 採用**(blink の cubic ではなく): C² 連続でセル境界の速度キンク=単一周波数的機械読み(アンチパターン2)を回避。docstring に理由記載。設計語彙に反せず。
3. **`homePull` = 符号付きベキ整形**: 「静止に句読点」(設計§4-5 / アンチパターン5)を dt積分なしで実現する手段。非増幅・符号/端点保存・C¹。設計は意味論のみ規定のため合理的具体化。
4. **`schemaVersion` を config 型に先出し**: Domain A 未使用だが裁定4(Domain C stale拒否)へ開くため。妥当。
5. **層数をヘルパで固定せず `NoiseLayer[]` 受け**: 3層比は Domain B(設計§6「3層比は普遍既定」)へ委譲。基盤のみ提供する Domain A スコープに整合。

## 質問
なし。Domain A の spec 論点は裁定1〜3および basis で解消済み。裁量注記1(ヘルパ配置の文言ズレ)は Orch 判断に委ねるが、レーン1としては blocking にあたらないと評価する。
