# C2 Domain B 完了報告: 生理生成器骨格(まばたき)

> 実装: Gnome(opus)。委任元: Orch-Sylph。日付: 2026-07-10。ブランチ: feature/2d-rigging-eco-system。対象アプリ: apps/runtime-player。

## 判定

**completed**

Escalate 条件(決定論とリポジトリ流儀の乱数慣行の両立不能)には該当しなかった。hash-seed 流儀(`Math.imul`/xor/`>>> 0`)だけで、非等間隔ばらつき+不応期・二連まばたき確率・非対称イージング・保持・深さの全てを**壁時計/Math.random ゼロ**で決定論的に表現できた。分離規律も維持(実装のみ担当、レビューは別コンテキスト Review-Sylph へ)。

## 作成/変更ファイル(絶対パス)

すべて**新規追加**。既存ファイル(Domain A の live-mapping 成果、discussion 配下の M ファイル)には一切触れていない。

### source(physiology/ — Electron import ゼロの純関数群)

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\deterministic-hash.ts`
  - hash-seed プリミティブ。`hashUnit(seed,index,channel)→[0,1]`、`hashStringToSeed`、`mixSeeds`。mesh-outline 生成器の `hashUnit`/`hashString` 前例に倣った純関数(ステートフル PRNG なし)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\behavior-class.ts`
  - レパートリー拡張点。`PhysiologyBehavior` インターフェース(振る舞いクラスの登録口)。振る舞い知識A のみを持ち、意味スロット活性度の Record を出す契約。model parameterId を知らない。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\blink-behavior.ts`
  - まばたき振る舞いクラス本体。内部スキーマ6要素(baseline)+ modulation + 普遍既定値、芯の純関数(`sampleBlinkActivation` / `walkBlinkTo`)、エンベロープ、イベント列挙、`createBlinkBehavior()`(前方カーソル memo 付き)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\physiology-generator.ts`
  - 生成器本体。複数 behavior を合成し1つの `Record<slotId, number>` を出す。behavior 追加で本体不変(§4.2)。session seed → behavior 毎の decorrelated sub-seed 導出。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\index.ts`
  - Domain C 向け公開バレル。

### tests

- `...\physiology\blink-behavior.test.ts` — 決定論・分布性質・形状反映・スロット語彙・**physiology/ 純度の構造テスト**(15 件)。
- `...\physiology\physiology-generator.test.ts` — 合成・両目同値・sub-seed 導出・拡張点・前方カーソル等価性・意味スロット語彙同期(8 件)。
- `...\physiology\blink-behavior-fixture.test.ts` — golden fixture(default / alt-config、同種同列・異種異列・設定も入力)(4 件)。
- `...\physiology\blink-default.golden.json` / `blink-alt-config.golden.json` — 固定タイムステップ(16ms × 900frame)の活性度 golden 列。`UPDATE_BLINK_GOLDEN=1` で意図的再生成、既定は assert。

## 生成器の export シグネチャ(Domain C 結線契約)

### 生成器(Domain C が直接使う面)

```ts
// physiology-generator.ts
function createPhysiologyGenerator(config: {
  readonly seed: number;                         // session seed(ユーザー非露出、合成ルートで決定)
  readonly behaviors?: readonly PhysiologyBehavior[]; // 既定 = [createBlinkBehavior()]
}): {
  sample(logicalTimeMs: number): Record<string /*slotId*/, number>; // 論理時刻ms → 意味スロット活性度
  readonly behaviorIds: readonly string[];
};
```

- **出力 Record の形**: `{ "eye-blink-left": a, "eye-blink-right": a }`(a は同値, 裁定4)。極性 0=開/1=閉(裁定5)。値域 0..1 連続。
- Domain C はこの Record を Domain A リゾルバの `activations` に**そのまま**渡せる(slotId キー一致)。生成器は model parameterId を一切知らない。blink 以外の slotId は出さない → リゾルバ側で自動的に沈黙。
- **論理時刻の単位 = ミリ秒**(裁量判断参照)。Domain C の心臓が壁時計→論理時刻ms へ変換し `sample(logicalTimeMs)` を毎フレーム呼ぶ。生成器内で `Date.now()` を呼ばない。

### 芯の純関数(裁定3、fixture が突く契約)

```ts
// blink-behavior.ts
function sampleBlinkActivation(
  seed: number,
  config: BlinkConfig,
  logicalTimeMs: number
): number; // [0,1]。同じ(seed,config,time)→同じ活性度。epoch から walk する純関数。

// 前方カーソル reducer(振る舞いクラスが memo として使う。純粋)
function walkBlinkTo(
  seed: number, config: BlinkConfig, cursor: BlinkWalkCursor, logicalTimeMs: number
): { activation: number; cursor: BlinkWalkCursor };
```

### 振る舞いクラス構築 API

```ts
function createBlinkBehavior(config?: BlinkConfig /* 既定 = DEFAULT_BLINK_CONFIG */): PhysiologyBehavior;

interface PhysiologyBehavior {
  readonly behaviorId: string;               // "blink"
  readonly slotIds: readonly string[];       // ["eye-blink-left","eye-blink-right"]
  sample(input: { seed: number; logicalTimeMs: number }): Record<string, number>;
}
```

## 内部スキーマ6要素の実装マッピングと baseline×modulation

`BlinkBaselineConfig`(全て基準値。§6.4)。普遍既定値 = `DEFAULT_BLINK_BASELINE`:

| §6.1 6要素 | config フィールド | 既定値 | 根拠 |
|---|---|---|---|
| 平均頻度 | `meanBlinkIntervalMs` | 3529ms | ≈ 17回/分(15〜20) |
| ばらつき+最短不応期 | `intervalJitterRatio` + `minRefractoryMs` | 0.55 / 900ms | 等間隔=即死体を回避、不応期の床 |
| 二連瞬き確率 | `doubleBlinkProbability` | 0.12 | ぱちぱちのクラスタ |
| 閉/開 非対称 | `closeDurationMs` + `openDurationMs` | 100 / 220ms | 素早く閉じゆっくり開く |
| 閉じ切り保持 | `holdDurationMs` | 40ms | 一瞬止まる |
| 閉じの深さ | `closeDepth` | 1.0 | 全閉が基本 |

- 「6要素」= 概念ツマミ。②ばらつき+不応期 と ④閉/開非対称 はそれぞれ2フィールドに分解(床+広がり / 閉+開ペア)。報告本表がその写像。
- **baseline×modulation(§6.4)**: `BlinkModulation` が各量の**乗算子**。`BlinkConfig = { baseline, modulation }`。`resolveEffectiveBlink` が effective = baseline に乗算子を掛けて算出。**C2 は `IDENTITY_BLINK_MODULATION`(全乗算子=1)= 恒等**。従って C2 の effective は baseline に一致(テストで assert 済み)。C5 は非恒等 modulation を渡すだけ(例 `rateMultiplier:1.5`=緊張→頻度×1.5)で接ぎ木にならない。恒等でも常に乗算経路を通る(接ぎ木回避)。
  - refractory floor は C2 では非変調(高頻度時は `Math.max(refractory, ...)` 床が守る)。この扱いは実装コメントに明記。

## レパートリー拡張点の設計(§4.2)

- `PhysiologyBehavior` インターフェース = 振る舞いクラスの共通口(`behaviorId` / `slotIds` / `sample`)。まばたきは `createBlinkBehavior` がこれを実装。
- `createPhysiologyGenerator({ seed, behaviors })` は `behaviors` 配列を合成するだけ。**将来の呼吸等は `PhysiologyBehavior` を1つ実装して `behaviors` に足すのみで、生成器本体(合成ループ・seed 導出)は不変**。テストで stub behavior を足して合成・merge を実証(生成器コード無変更)。
- seed 分離: 各 behavior は `mixSeeds(sessionSeed, hashStringToSeed(behaviorId))` の decorrelated sub-seed を受ける → 振る舞い間の相関を排除。
- 重複 behaviorId は構築時に throw(合成の健全性)。

## 決定論の実装(採用方式と参照前例)

- **採用**: hash ベース seeded 関数。`hashUnit(seed,index,channel)` を `Math.imul`/xor/`>>> 0` で整数 seed+座標→[0,1] に写す純写像。ステートフル PRNG・`Math.random`・`crypto` を使わない。
- **参照前例**: `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:964-989`(`hashString` / `hashUnit`)。棚卸し観点5 が挙げた `static-stage-canvas-renderer.ts` の `hashUnit`/`deterministicJitter` と同一流儀(当該ファイルの該当関数は authoring-core の mesh-outline 系に集約されて存在)。
- **決定論の担保**: イベント列は seed+イベント index から `hashUnit`(channel 別: 間隔/二連/intra-gap/閉/開)で導出。時刻 t の活性度は epoch から `walkBlinkTo` で決定的に算出。fixture が「同種同列・異種異列」を機械固定。前方カーソルは epoch walk の忠実な memo(等価性テストで担保)。

## fixture・分布性質テストの一覧と実行結果

コマンド(app ディレクトリ `apps/runtime-player`):

- `npx vitest run src/main/physiology/` → **27/27 pass**(3 ファイル)。
  - `blink-behavior-fixture.test.ts`(4): default golden 一致 / alt-config golden 一致(設定も入力・深さ0.85反映) / 同種同列・異種異列 / 異設定→異列。
  - `blink-behavior.test.ts`(15): 決定論(同種同列・異種異列)/ 恒等 modulation=baseline 等価 / 非恒等 modulation 決定論+頻度増 / 不応期を破らない / 二連は不応期未満 / 二連率が確率追従 / 非対称(閉<開) / 深さ・保持反映 / 深さ modulation 反映 / 値域[0,1]・gap で開 / 閉相単調増・開相単調減 / 両目同値 / **physiology 純度構造テスト**。
  - `physiology-generator.test.ts`(8): 合成両目同値 / sub-seed 導出 / 二インスタンス決定論 / 重複id拒否 / 拡張点(stub合成) / 前方カーソル等価 / 逆行 rewind / 意味スロット語彙同期。
- typecheck: `npx tsc --noEmit -p tsconfig.json` → **exit 0**。
- 全体回帰: `npx vitest run` → **592 pass / 2 fail**。fail 2 件は既知 baseline の `browser-source-server.test.ts` / `browser-source-server-message.test.ts`(`effectiveDynamicsTuning` = Wave21)。physiology とは無関係・不接触。Domain A 報告の既知2件と一致。

## physiology/ 純度確認結果(最重要 blocking 観点)

3通りで確認、いずれも Electron import ゼロ・壁時計非依存・Math.random ゼロ:

1. **自動構造テスト**(`blink-behavior.test.ts` の "physiology/ purity"): physiology/ 配下の `*.ts`(テスト除く)全ソースを読み、**ブロック/行コメントを除去した上で** 禁止パターン(`from "electron"` / `electron-vite` / `Date.now` / `performance.now` / `new Date` / `Math.random` / `node:crypto`・`randomBytes` / )の不在を assert。→ pass。
2. **手動 grep**(source のみ): `from "electron"|electron-vite|Date\.now|performance\.now|new Date|Math\.random|randomBytes|node:crypto|require\(` を physiology/(テスト除外)で検索 → ヒットは全て**ドキュメントコメント(` * ` 行)内の禁止 API 言及のみ**、コード実体ゼロ。
3. **import 構成**: source の import は `./deterministic-hash` / `./behavior-class` / `./blink-behavior` / `./physiology-generator` の physiology 内相対のみ(型のみ含む)。Electron・node built-in(時計/乱数)を一切 import しない。論理時刻は `sample(logicalTimeMs)` の引数で受ける。

注: golden fixture テストは `node:fs`/`process.env` を使うが、これは**テストハーネス**であり physiology/ の source モジュールではない(純度制約は source に対する制約)。Domain A の等価性テストと同じ流儀。

## 裁量判断

- **論理時刻の単位 = ミリ秒**(tick でなく ms)。理由: 下流 dynamics の delta は `sourceFrameTimestampMs` 差分(棚卸し観点3)で ms 基準、config も ms(平均間隔・閉開時間)で ms が最も自然。Domain C の心臓が壁時計→論理時刻ms を単調供給する想定。tick 換算が必要なら心臓側で吸収可。
- **二連まばたきの活性度表現**: 二連 = 独立イベント2つ。1つ目(primary)が確率 `doubleBlinkProbability` で「次イベントを second-of-pair 化」し、second は不応期でなく短い intra-pair gap(60〜130ms、非露出内部定数 §6.2)で並ぶ。各イベントは通常のエンベロープ。よって活性度スカラー1本で「ぱちぱち」が自然に表現される(棚卸しリスク末尾の懸念=表現力は足りるを実証)。
- **非対称イージングの活性度表現**: エンベロープを close(smoothstep 立上り)→hold(depth 保持)→open(smoothstep 立下り)の3相に分割、非対称は**相の時間長**(closeDurationMs < openDurationMs)で表現しカーブ形は普遍 smoothstep(§6.2「イージングカーブの形は露出しない」)。毎フレーム連続活性度に落ちる。
- **前方カーソル memo**: 芯 `sampleBlinkActivation` は epoch から walk する純関数(O(t までのイベント数))。60Hz 心臓の毎フレーム epoch walk コストを避けるため、振る舞いクラスは単調前進カーソルを memo として保持(逆行時は rewind)。カーソルは pure walk の忠実 memo であることを等価性テストで機械担保 → 決定論は不変。
- **slotId の持ち方**: `eye-blink-left`/`eye-blink-right` を physiology 内ローカル定数化(live-mapping を import せず physiology を疎結合に保つ)。`semantic-slot-definitions.ts` との同期はテストで assert。
- **golden 粒度**: 16ms × 900frame(≈14.4s、複数まばたき含む)、活性度を 6 桁丸めで固定(可読性・クロス実行安定)。default と alt-config の2本(設定も fixture 入力)。

## 質問

- なし(ブロッカーなし)。Domain C への申し送り3点:
  1. **リゾルバ結線**: `generator.sample(logicalTimeMs)` の返す Record を Domain A の `resolveSemanticSlotParameterValues({ slots, activations })` の `activations` にそのまま渡す。`slots` は auto-mapping の結果。`bodyFollowState` は blink では不要(未指定でよい)。
  2. **seed の出所**: session seed はユーザー非露出(C2 §5)。合成ルート/自律ホスト composer で決めて `createPhysiologyGenerator({ seed })` に注入。fixture 決定論は生成器の意味スロット列で担保済み、送信タイムスタンプ(`producedAtIso`/`sourceFrameTimestampMs`)の採番は決定性境界外(心臓の領分)。
  3. **論理時刻**: ロード完了=epoch(t=0)想定で `sample` に単調増加 ms を渡す。t=0 は初回まばたき前=開(活性度0)。アンロード/quit で心臓停止(カーソル state はインスタンス破棄で消える)。

## Subagent Contract 遵守確認

- **`pnpm install` 未実施**。回避工作なし。lockfile・`pnpm-workspace.yaml`・新規依存いずれも無変更。
- **Editor ソース / package-format / Runtime Export schema 無変更**。変更は `apps/runtime-player/src/main/physiology/`(新規)のみ + 本完了報告。
- **実行時 `if (role===...)` 分岐なし**(Domain B は合成に非関与)。
- 既存成果を退行させない: 新規ファイル追加のみ、既存 source(Domain A の live-mapping 含む)不接触。全体回帰の pass 数が Domain A 時点(565)から physiology 27件分増(592)、既知 fail は同一2件のまま。C1/Wave10-23 退行なし。
- **無関係変更の revert なし**。作業ツリーの既存 M ファイル(discussion 配下、Domain A の runtime-parameter-frame.ts)に不接触。
- **ドメイン想定外の共有ファイルに触れていない**(physiology/ 新規のみ)。physiology/ 純度(Electron ゼロ・論理時刻・シード乱数のみ)を厳守。
