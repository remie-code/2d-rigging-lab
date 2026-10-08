# C2 Domain B レビュー(Review-Sylph レーン① spec compliance)

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-10。レーン: **spec compliance**(wave plan + c2設計討議への突合)のみ。読み取り専任。
> 判定基準: `orchestration/c2-wave-plan.md`(§1裁定・§4.2・§7・§10・§11・§12)、`architecture/c2-blink-and-generator-skeleton.md`(§3.1・§5・§6)。
> 対象: `apps/runtime-player/src/main/physiology/`(全新規)+ Gnome完了報告 `waves/c2/domain-b-blink-generator.md`。

## 判定

**合格(spec compliance レーン)**。blocking差分なし。

自分で source 全ファイル・テスト全ファイル・golden・Domain A リゾルバ契約を読み、純度 grep と git status を独立に実行して確認済み。Gnome 報告の主張はいずれも実体と一致。

## spec 適合状況(裁定・§ごと)

### 裁定2(置き場・純度) — 適合

- 置き場: `apps/runtime-player/src/main/physiology/` に生成器一式(deterministic-hash.ts / behavior-class.ts / blink-behavior.ts / physiology-generator.ts / index.ts)。裁定どおり。
- 純度(独立検証): source(テスト除外)への grep で `from "electron" / electron-vite / Date.now / performance.now / new Date / Math.random / node:crypto / randomBytes / require(` のヒットは**全て ` * ` ドキュメントコメント行内の API 言及のみ**、コード実体ゼロ。source の import は `./behavior-class` / `./blink-behavior` / `./deterministic-hash` の physiology 内部相対のみ(型含む)。Electron・node built-in を一切 import しない。package-ready な純度を spec レベルで満たす。

### 裁定3(芯は純関数・論理時刻) — 適合

- 芯 `sampleBlinkActivation(seed, config, logicalTimeMs): number` は epoch から walk する純関数。壁時計非依存、時刻は引数で受ける。生成器内で時刻取得なし(`sample(logicalTimeMs)` / `behavior.sample({ seed, logicalTimeMs })` すべて引数注入)。
- 振る舞いクラス `createBlinkBehavior` は前方カーソルを memo として保持する closure(可変 state)だが、これは芯ではなく性能 memo。cursor-equivalence テストが from-epoch 評価との一致を機械担保しており、決定論は不変。「芯が純関数」の spec 要件は芯 `sampleBlinkActivation` が満たす(注記あり、非 blocking)。

### 裁定4(左右同値) — 適合

- `createBlinkBehavior().sample()` は `{ [eye-blink-left]: a, [eye-blink-right]: a }` を同一 `a` で返す(blink-behavior.ts:395-398)。片目差なし。テスト `emits both blink slots with the same value` / 生成器 `left === right` で assert。

### 裁定5(極性) — 適合

- 活性度 0=開(gap)/ depth=閉。既定 depth=1 で 0=開/1=閉。新極性の発明なし。エンベロープは gap で 0 を返し、close→hold で depth へ上がる。テスト(t=0→0、peak→depth、値域[0,1])で assert。生成器出力の意味論はスロット語彙(defaultInvert:true)の既存意味に相乗り。

### §4.2 / §6 内部スキーマ6要素 — 適合

6要素すべて config フィールドとして実装、普遍既定値は人間らしい:

| §6.1 要素 | 実装フィールド | 既定値 | 妥当性 |
|---|---|---|---|
| 平均頻度 | `meanBlinkIntervalMs` | 3529ms(≈17回/分) | 15〜20回/分帯域内 |
| ばらつき+不応期 | `intervalJitterRatio` + `minRefractoryMs` | 0.55 / 900ms | 等間隔回避・床あり |
| 二連確率 | `doubleBlinkProbability` | 0.12 | クラスタ表現 |
| 閉開非対称 | `closeDurationMs` + `openDurationMs` | 100 / 220ms | 素早く閉じ遅く開く |
| 保持 | `holdDurationMs` | 40ms | 一瞬止まる |
| 深さ | `closeDepth` | 1.0 | 全閉が基本 |

- §6.4 baseline×modulation: `BlinkConfig = { baseline, modulation }`、`resolveEffectiveBlink` が乗算で effective 算出。C2 は `IDENTITY_BLINK_MODULATION`(全乗算子=1)=恒等。恒等でも常に乗算経路を通る(C5 接ぎ木回避)。テスト `identity modulation is equivalent to baseline-only` / `modulation stays deterministic when non-identity` で assert。構造は spec どおり。
- §6.2 露出しないもの: 左右ずれ=固定同値(裁定4)、視線連動=blink のみで gaze スロット非関与、イージング形=`smoothstep` 普遍内部関数(相の時間長のみ露出、カーブ形は非露出)。intra-pair gap・shape jitter は非露出の内部定数。守られている。

### §4.2 レパートリー拡張点 — 適合

- `PhysiologyBehavior` インターフェース(behaviorId / slotIds / sample)が共通口。`createPhysiologyGenerator({ behaviors })` は配列を合成するのみ。将来の振る舞い追加は interface 実装+配列追加で足り、生成器本体(合成ループ・sub-seed 導出)不変。テスト `composes an additional behavior without touching the generator body`(stub behavior 合成)で spec レベルの拡張口の存在を実証。

### §5 決定論と種 — 適合

- シード付き決定論。session seed → `mixSeeds(seed, hashStringToSeed(behaviorId))` で behavior 毎 decorrelated sub-seed。ステートフル PRNG・非シード乱数なし。設定値も fixture 入力(ALT_CONFIG)。同種同列・異種異列・異設定異列をテストで固定。

### §10 Acceptance Criteria(Domain B 該当) — 適合

- 固定シード fixture が機械ゲートとして存在: `blink-default.golden.json`(902行/900frame)・`blink-alt-config.golden.json`(902行)+ `blink-behavior-fixture.test.ts`。既定は assert、`UPDATE_BLINK_GOLDEN=1` で意図的再生成。golden 実在・非自明(全閉到達 max>0.95、開 min=0 を assert)を独立確認。
- physiology/ 純度(Electron/壁時計/非シード乱数の不在): 独立 grep + 自動構造テストで確認。

### §11 Subagent Contract — 適合

- git status 独立確認: Domain B の変更は `apps/runtime-player/src/main/physiology/`(全新規10ファイル)のみ。M `runtime-parameter-frame.ts` と `headless-slot-resolver.*` 等は **Domain A の成果**であり Domain B 不接触(報告と一致)。
- lockfile / `pnpm-workspace.yaml` / package-format / Runtime Export schema / Editor ソース: いずれも変更なし。`pnpm install` 痕跡なし。
- 新規依存なし(import は physiology 内部相対のみ)。実行時 role 分岐なし(Domain B は合成非関与)。無関係 revert なし。
- Domain A リゾルバ契約への嵌合(spec観点): 生成器出力 `{ eye-blink-left, eye-blink-right }` のキーは `semantic-slot-definitions.ts` の slotId(sourceKind blink-left/blink-right)と一致。リゾルバ `resolveSemanticSlotParameterValues` は `input.activations[slot.slotId]` を読むため、生成器 Record をそのまま `activations` に渡せる。テスト `blink slot ids stay in sync` が語彙同期を assert。契約嵌合は spec レベルで成立。

## blocking 差分

なし。

## 裁量注記(非 blocking)

1. **芯 vs 振る舞いクラス state**: 裁定3「芯は純関数」は `sampleBlinkActivation` が満たす。`createBlinkBehavior` の前方カーソル memo は可変 closure だが、equivalence テストで from-epoch 一致を担保しており spec 違反ではない。Domain C はこの stateful behavior を毎フレーム駆動する(ライフサイクルは Domain C の領分)。
2. **minRefractoryMs の非変調**: `BlinkModulation` に不応期の乗算子フィールドがない(`resolveEffectiveBlink` は床のみ)。C2 は恒等 modulation のため影響ゼロ。C5 で不応期を変調したくなった場合はスキーマ拡張が要る点を申し送り(C2 spec 適合には無関係)。
3. **常時出力**: gap 中も両 blink スロットに 0 を毎フレーム書く(常時駆動の意図どおり)。リゾルバ側で開き目パラメータへ解決される。spec 上問題なし。
4. **論理時刻 = ミリ秒**の裁量は下流 dynamics(`sourceFrameTimestampMs` 差分 ms)・config(ms)と整合し合理的。Domain C 心臓の壁時計→ms 変換前提。

## 質問(Orch-Sylph 経由で L0 へ)

- なし。spec compliance レーンでは blocking・要確認事項なし。
- 参考申し送り(他レーン/Domain C 向け、本レーン判定に非影響): 上記注記2(不応期変調フィールドの将来拡張)は C5 設計時に c2設計討議 §6.4 の modulation 語彙へ追記が要るかもしれない。C2 では対応不要。
