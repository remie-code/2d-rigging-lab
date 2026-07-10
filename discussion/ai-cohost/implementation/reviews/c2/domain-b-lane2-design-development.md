# C2 Domain B レビュー(Review-Sylph): レーン② design/development compliance

> レビュー担当: Review-Sylph(design/development compliance レーン)。委任元: Orch-Sylph。日付: 2026-07-10。対象ブランチ: feature/2d-rigging-eco-system。
> レーン責務: コード品質・純度の実体・決定論流儀・拡張点設計の健全性。spec compliance と test adequacy は別 Review-Sylph 担当のため本レポートでは扱わない。読み取り専任(修正なし)。

## 判定

**合格(要修正なし / blocking なし)**

physiology/ 純度(§12 blocking = package-ready)、決定論の参照透過、baseline×modulation の接ぎ木回避構造、レパートリー拡張点の配列駆動、身体知識B非混入、Subagent Contract、いずれもコード実体で確認。裁量注記は非 blocking。

---

## 1. physiology/ 純度の自己 grep 裏取り(最重要 blocking)

完了報告の主張(Electron import ゼロ・壁時計非依存・Math.random ゼロ)を**自分で grep して裏取り**した。

対象: `apps/runtime-player/src/main/physiology/` 配下の `*.ts`(テスト `*.test.ts` を glob 除外)。
検索パターン: `from "electron"|electron-vite|Date\.now|performance\.now|new Date|Math\.random|randomBytes|node:crypto|require\(|process\.|node:fs|import\(`

ヒット5件、**全て doc コメント(` * ` 行)内の禁止 API 言及**でコード実体ゼロ:

| ファイル:行 | 内容 | 判定 |
|---|---|---|
| physiology-generator.ts:11 | `* ... Math.random, and it never knows ...` | コメント。可 |
| index.ts:3 | `* Math.random-free pure generator.` | コメント。可 |
| blink-behavior.ts:11 | `* ... No wall clock, no Math.random —` | コメント。可 |
| deterministic-hash.ts:11 | `* - No wall clock (Date.now/performance.now/new Date).` | コメント。可 |
| deterministic-hash.ts:12 | `* - No non-seeded randomness (Math.random, crypto).` | コメント。可 |

**import 文の推移的追跡**(source 全4ファイル):
- `deterministic-hash.ts`: import 一切なし(自己完結の純関数)。
- `behavior-class.ts`: import なし(型定義のみ)。
- `blink-behavior.ts`: `import type { ... } from "./behavior-class"` + `import { hashUnit } from "./deterministic-hash"` のみ。
- `physiology-generator.ts`: `import type { PhysiologyBehavior } from "./behavior-class"` + `./blink-behavior` + `./deterministic-hash` のみ。
- `index.ts`: physiology 内の re-export のみ。

→ physiology 内相対 import に閉じており、Electron・node built-in(時計/乱数/fs/crypto)への直接・推移的依存はゼロ。論理時刻は `sample(input.logicalTimeMs)` の引数で外部注入。**純度は package-ready。blocking 違反なし。**

注(非 blocking): golden fixture テスト(`blink-behavior-fixture.test.ts`)は `node:fs`/`process.env` を使うが、これはテストハーネスであり source モジュールの制約外。純度制約は source に対するもので、Domain A の等価性テストと同流儀。妥当。

---

## 2. 決定論の実装健全性

### 2.1 hash-seed 方式の既存流儀忠実度

`deterministic-hash.ts` の `hashUnit(seed,index,channel)` を前例 `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:974-989` と照合:

- 前例と同一構成: `seed ^ Math.imul(coord + 定数, 定数)` を各座標につき xor 合成 → murmur3 finalizer(`hash ^= hash>>>16; hash = Math.imul(...); ...`)→ `(hash>>>0)/0xffffffff` で [0,1]。
- 差異は座標数のみ(前例4引数 `seed,row,column,channel` vs physiology 3引数 `seed,index,channel`)。mix 定数(`0xc2b2ae35`/`0x27d4eb2d`)は流儀内の追加チャンネルとして妥当。
- `hashStringToSeed` は前例 `hashString` と**バイト一致**(FNV-1a: `2166136261` / `16777619` / `Math.imul` / `>>> 0`)。
- `mixSeeds` は murmur3 系 avalanche finalizer。決定論・順序依存で sub-seed 導出に適切。

→ ステートフル PRNG・`Math.random`・`crypto` は不在。**全て整数座標→[0,1] の純写像**。流儀に忠実。

### 2.2 参照透過(同入力→同出力)

- `sampleBlinkActivation(seed, config, logicalTimeMs)` は `INITIAL_BLINK_CURSOR` から epoch walk する純関数。呼び出し間に状態を持たない。
- `walkBlinkTo(seed, config, cursor, logicalTimeMs)` は純 reducer。`makeEvent` / `intervalBeforeEvent` / `blinkShape` / `whetherDouble` / `blinkEnvelope` / `resolveEffectiveBlink` は全て引数のみに依存する純関数。イベント列は `(seed, eventIndex, channel)` の hashUnit から導出。
- `config.seed >>> 0` で unsigned 正規化。境界も決定的。

→ 参照透過を満たす。

### 2.3 前方カーソル memo の忠実性(決定論を壊さないか)

`BlinkWalkCursor` = `{ nextEventIndex, freeTimeMs, nextIsSecondOfPair }`。

- カーソルは「`nextEventIndex` より前の全イベントが完了した後の状態」。`walkBlinkTo` はこのカーソルから `makeEvent(seed, index, isSecondOfPair, freeTimeMs, eff)` を再導出する。`makeEvent` は引数の純関数で、カーソルが `(index, freeTimeMs, isSecondOfPair)` を忠実に運ぶため、**epoch からの walk と同一のイベント列**を再現する。
- 前進条件は `logicalTimeMs >= event.endMs`(イベント完全完了時のみ index+1、freeTimeMs=event.endMs、isSecondOfPair=spawnsDouble)。in-progress / gap では index を進めず返す → 同時刻再クエリで同結果。
- `spawnsDouble = !isSecondOfPair && whetherDouble(seed, index, eff)` はカーソルに保存された isSecondOfPair から毎回決定的に再計算。状態欠落なし。
- **rewind の扱い**: `createBlinkBehavior` の `sample` は `input.logicalTimeMs < lastTimeMs` で `cursor = INITIAL_BLINK_CURSOR` に戻す。逆行時も epoch から再 walk → from-epoch と一致。

→ カーソルは pure walk の忠実な memo。決定論を壊さない。`enumerateBlinkEvents` の前進遷移とも同一ロジックで整合。

**決定論健全性: blocking なし。**

---

## 3. baseline×modulation 構造(§6.4)の検証

- `BlinkConfig = { baseline: BlinkBaselineConfig, modulation: BlinkModulation }`。modulation の各フィールドは**乗算子**。
- `resolveEffectiveBlink(config)` が effective を **無条件に** baseline×multiplier で算出(`blink-behavior.ts:131-144`)。`if (modulation)` 等の分岐スキップは存在せず、恒等でも常に乗算経路を通る。
  - 例: `depth = clamp01(b.closeDepth * m.depthMultiplier)`、`meanIntervalMs = Math.max(1, b.meanBlinkIntervalMs / rate)`、`jitterRatio = Math.max(0, b.intervalJitterRatio * m.jitterMultiplier)` …
- C2 は `IDENTITY_BLINK_MODULATION`(全乗算子=1)。従って effective = baseline に**厳密一致**(乗算/除算の単位元)。
- `walkBlinkTo` / `enumerateBlinkEvents` は共に冒頭で `resolveEffectiveBlink(config)` を呼び、生の baseline を直接参照しない → 変調経路が唯一の経路。C5 は非恒等 multiplier を渡すだけで接ぎ木不要(構造分岐が増えない)。

→ **§6.4 の「恒等でも常に乗算経路を通る(接ぎ木回避)」を構造として満たす。blocking なし。**

注(非 blocking): `const rate = m.rateMultiplier > 0 ? m.rateMultiplier : 1;`(:133)は非正の rateMultiplier に対する除算保護。`Math.max(1, ...)` / `Math.max(0, ...)` / `clamp01` の防御的下限も同様。恒等では発火せず effective=baseline は保たれるため、C2 恒等等価性を損なわない合理的ガード。C5 で 0 以下の rate を「変調停止」ではなく「等倍」に丸める意味論になる点だけ、将来 C5 設計時に意図確認する価値あり(現時点は妥当)。

---

## 4. レパートリー拡張点の健全性(§4.2)

- `PhysiologyBehavior`(`behavior-class.ts`)= `{ behaviorId, slotIds, sample(input) }` の共通口。blink は `createBlinkBehavior` が実装。
- `createPhysiologyGenerator({ seed, behaviors })`(`physiology-generator.ts:45-82`):
  - `behaviors` 配列を `.map` で `seededBehaviors` に変換し、`sample` は `for (const { behavior, seed } of seededBehaviors)` の**配列駆動ループ**。behavior 種別のハードコード分岐なし。
  - behavior 追加 = 配列に1要素足すのみ。生成器本体(合成ループ・sub-seed 導出)は不変。§4.2 を実際に達成。
- sub-seed decorrelation: `mixSeeds(config.seed >>> 0, hashStringToSeed(behavior.behaviorId))`(:63)。behaviorId 文字列を FNV-1a で seed 空間へ折り込み、session seed と avalanche mix。振る舞い間ストリームの相関を排除。妥当。
- 重複 behaviorId は構築時に `throw`(:52-56)。合成健全性を守る。

→ **拡張点は本体変更を要さず配列駆動。blocking なし。**

注(非 blocking): 合成 merge は後勝ち上書き(`activations[slotId] = value`)。C2 は blink 単独で衝突しないが、将来複数 behavior が同一 slotId を書く場合の合成則(加算/max/上書き)は未定義。§4.2 の現スコープでは問題なし。将来レパートリー拡張時に合成則を設計文書化する申し送りとして記録。

---

## 5. 生成器が身体知識Bを持たないこと

- physiology/ source は live-mapping / semantic-slot-definitions / parameterId を**一切 import しない**(§1 の import 追跡で確認)。
- slotId は `BLINK_LEFT_SLOT_ID = "eye-blink-left"` / `BLINK_RIGHT_SLOT_ID = "eye-blink-right"` のローカル定数化(`blink-behavior.ts:24-25`)。理由コメントで「live-mapping module graph からの疎結合維持、同期はテストで assert」と明示。
- 値の照合: `live-mapping/semantic-slot-definitions.ts:76,86` に `slotId: "eye-blink-left"` / `"eye-blink-right"` が実在。ローカル定数と一致。極性 0=開/1=閉 のコメントも semantic-slot-definitions の `defaultInvert:true` 前提と整合。
- 生成器の出力は `Record<slotId, number>` で parameterId を知らず、身体知識B(どの parameterId/向き/範囲)は下流 headless resolver の領分に留まる。

→ **身体知識Bの混入なし。疎結合維持は妥当。blocking なし。**

---

## 6. リポジトリ流儀適合

- 命名: camelCase 関数、`SCREAMING_SNAKE` 定数、`readonly` フィールドの type alias。既存流儀に沿う。
- ファイル分割: hash プリミティブ / interface / behavior 本体 / generator / barrel の関心分離。健全。
- 純関数スタイル: 副作用は `createBlinkBehavior` のカーソル memo のみ(明示的にクロージャ内 local、外部可視状態なし)。
- 型定義: `import type` を型のみ import に使用、`Readonly<Record<...>>` 等。TypeScript strict 流儀に沿う。
- doc コメント: 設計節参照(§6.1/§6.2/§6.4/§4.2)と裁定番号を明記。追跡性良好。

→ 流儀適合。指摘なし。

---

## 7. Subagent Contract 遵守

`git status` / `git diff --stat HEAD` で確認:
- physiology/ ディレクトリは**全て untracked(新規)**。既存 tracked ファイルの変更は `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts` のみだが、これは **Domain A の作業(headless-slot-resolver 系の untracked 群と同一ドメイン)**で、Domain B の physiology/ とは別。Domain B は physiology/ 新規追加に閉じる。
- lockfile / `pnpm-workspace.yaml` / schema / package-format / Runtime Export schema いずれも無変更(diff に現れず)。
- 実行時 `if (role===...)` 分岐なし(生成器は合成非関与)。

→ **契約遵守。blocking なし。**

質問(Orch-Sylph へ): git 作業ツリーに Domain A 由来の live-mapping 変更(`runtime-parameter-frame.ts` M + headless-slot-resolver 系 untracked)が同居している。本レビューは physiology/ に集中し Domain A 成果は未検証。Domain B が Domain A ファイルに touch していないことは確認済みだが、両ドメインの作業ツリー同居が意図通りか(commit 分割方針)は Orch-Sylph 側で確認されたい。

---

## blocking 差分

なし。

## 裁量注記(非 blocking)まとめ

1. `resolveEffectiveBlink` の非正 rateMultiplier → 1 丸め(§3 注)。C2 恒等等価性は不変。C5 設計時に意味論確認の価値。
2. 合成 merge の後勝ち上書き(§4 注)。C2 単独 behavior では非問題。将来の同一 slotId 衝突時の合成則は未定義。
3. `PhysiologyBehavior.sample` は seed を毎回 input で受けるが、`createBlinkBehavior` のカーソル memo は seed 一定を暗黙前提とする。generator が behavior インスタンス毎に固定 sub-seed を渡すため実害なし。契約として「同一 behavior インスタンスへの seed は不変」が前提である点を interface doc に一行足すと将来の誤用防止になる(任意)。

## 質問

- 上記 §7 の作業ツリー同居(Domain A/B commit 分割方針)。
- 裁量注記3の seed 不変前提を明文化するか(任意、非 blocking)。
