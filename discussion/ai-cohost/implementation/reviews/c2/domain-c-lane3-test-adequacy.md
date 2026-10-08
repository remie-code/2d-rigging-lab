# C2 Domain C レビュー(Review-Sylph レーン③ test adequacy)

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-11。対象アプリ: apps/runtime-player。
> レーン: **test adequacy**(タイマー/ライフサイクル/単調性/sanitization/沈黙/role分岐不在テストの実効性・網羅性)。
> 他2レーン(spec compliance、design/development)は別 Review-Sylph 担当。本レポートは本レーンのみを扱う。

## 判定

**合格(blocking なし)**

タスクの全 blocking 観点(タイマーリーク検出、多重タイマー検証、停止後 publish のテスト、seed 流出の sanitization テスト、沈黙、role 分岐不在の固定、心臓テストの安定性)がテストで実効的に押さえられている。裁量注記が数点あるが、いずれもライフサイクル/sanitization の実効性を損なわず非 blocking。

## 対象ファイル

- 実装: `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts`、`input-subsystem.ts`
- テスト: `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.test.ts`(11件)、`input-subsystem.test.ts`(7件)

## 自分で複数回実行したテスト結果

app ディレクトリ `apps/runtime-player` にて実行。

- **focused(心臓+合成)**: `npx vitest run src/main/role-composition/autonomous-frame-heart.test.ts src/main/role-composition/input-subsystem.test.ts`
  - **3回連続実行、すべて 18/18 pass**(autonomous-frame-heart 11 + input-subsystem 7)。フレーク無し。
- **typecheck**: `npx tsc --noEmit -p tsconfig.json` → **exit 0(エラーゼロ)**。
- **app 全体回帰**: `npx vitest run`
  - **2回連続実行、いずれも 606 pass / 2 fail(608 中)**。
  - fail 2 件は既知 baseline のみ: `src/main/broadcast-source/browser-source-server.test.ts`("serves current Runtime Export payload...")、`src/stage/browser-source/browser-source-server-message.test.ts`("accepts the not-loaded response shape")。いずれも Wave21 Dynamics Tune 由来のフィクスチャドリフト(role-composition/ の当ドメイン変更とは無関係)。
  - **Gnome 報告の「最初の1回だけ 3 fail(3件目 timing 依存フレーク)」は、当方の focused 3回+全体回帰2回の計5ランで一切再現しなかった。** 当ドメインの心臓テスト・合成テストは全ランで pass。fail は常に上記の既知2件に収束。→ 心臓テストの不安定 fail は無し(blocking 該当なし)。

## 観点別の実効性評価

### 1. 60Hz タイマー・単調性 — 実効

- **論理時刻変換**(test 1): 注入クロックで epoch=start 時刻を捕捉し、`sample` に渡る値が `[16,32,48]`(= wall − epoch)で raw wall clock でないことを固定。心臓が壁時計→論理時刻を担い生成器は触らない、という設計が実効的に検証されている。
- **単調 sequence + 単調 timestamp**(test 2): sequence `[1,2,3,4,5]`、`sourceFrameTimestampMs` `[516,...,580]`、`producedAtIso`=壁時計を固定。
- **多重ロード跨ぎの sequence 単調性**(test 3): ロード→ロードで sequence が `1,2 → 3` と never-reset・逆行しないことを固定(下流が sequence 逆行を見ない保証)。**タスクの「多重ロード跨ぎで sequence がリセット/逆行しない」要件を直接満たす。**
- **実 60Hz 周期**(test 11, fake timer): `advanceTimersByTime(100)` で ≥5 frame。周期 ≈16.67ms の下限を実タイマーで確認。

### 2. ライフサイクル・リークなし(最重要 blocking)— 実効

- **実タイマーリーク検出**(test 11, `vi.useFakeTimers`+`vi.getTimerCount`): start で `getTimerCount()===1`、stop で `===0`。**リーク検出が実効。** 加えて stop 後 `advanceTimersByTime(200)` で publish 件数が増えないことを確認(停止後に beat しない)。
- **多重ロードで二重タイマー化しない**(test 8): `start` 2回で `clearInterval` 丁度1回・`setInterval` 2回、かつ2つ目の generator 出力のみ反映。旧タイマー clear→新規起動が実効。
- **stop の冪等性**(test 9): 2度目 stop で再 clear せず throw せず、`isRunning()` 遷移も固定。
- **合成レベルのライフサイクル結線**(input-subsystem test): ロード→`heart.start` 1回、アンロード(`clearRuntimeExport`)→`heart.stop`、quit(`disconnect`)→`heart.stop`(累計2回)。多重ロードで心臓インスタンスは1つのまま `start` 2回。**quit 経路が heart.stop に到達しタイマーを dispose する = quit 阻害なしが固定されている。**

### 3. trackingHost に心臓・生成器不在(role 分岐不在の実効確認)— 実効

- input-subsystem test "Tracking Host has no frame heart / generator": `createAutonomousFrameHeart` が**一度も呼ばれない**、かつ load/clear/disconnect しても `heart.start` が呼ばれないことを固定。
- 合成テーブル test で composer が role ごと丁度1つ、autonomousHost 側で `createAutonomousFrameHeart` が丁度1回であることを固定。role 差がテーブル一点に留まり実行時分岐が無いことが実効的に押さえられている。

### 4. sanitization 境界 — 実効

- test 6: frame のキー集合が許可6種(`schemaVersion`/`runtimeExport`/`sequence`/`producedAtIso`/`sourceFrameTimestampMs`/`parameterValues`)のみ、`parameterValues` が parameterId キー(slotId でない=raw活性度語彙が漏れない)、`JSON.stringify(frame)` に seed(99)が出現しないことを固定。**seed 流出の sanitization テストが存在し実効。**

### 5. 失敗も沈黙 — 実効

- test 7: 未写像(slots 空)で `parameterValues={}`、`fire()` が throw しない、publish 継続を固定。心臓はエラーを投げず静止フレームを publish し続ける契約が実効。

### 6. 決定論 — 実効

- 全テストが注入クロック/手動スケジューラ/fake timer で決定論。乱数は seed 由来(Math.random 非使用、test 10 で seed 導出の決定論・payload identity 依存を固定)。
- test 5: **実生成器**で t=0 が目開き(invert:true, activation 0 → target.max=1、default-pose 等価)を固定。「読み込まれた身体が瞬きを開始しても初回は目開きから」という視覚的不連続回避が実生成器経路で押さえられている。

## 裁量注記(すべて非 blocking)

1. **test 9 の「停止後は emit しない」manual-scheduler 検証はやや弱い**: 手動スケジューラの `clearIntervalFn` が `handler=null` にするため、stop 後の `scheduler.fire()` は no-op となり、心臓 `tick()` 内の `if (heartbeat===null) return` ガード自体は直接は駆動しない。ただし「停止後に beat しない」プロパティ本体は test 11(fake timer で stop 後 `advanceTimersByTime(200)` → publish 増分ゼロ)で実タイマー経路として十分カバーされている。ガードは二重の安全策として実装にも存在。実効性に欠落なし。
2. **`sourceFrameTimestampMs` の多重ロード跨ぎ単調性は明示アサート無し**: test 3 はロード跨ぎで sequence のみアサートし timestamp はアサートしない。ただし `sourceFrameTimestampMs = now()`(壁時計)であり、単調な壁時計を前提とすればロード跨ぎでも本質的に単調。リスク低。追加するなら test 3 に timestamp 単調アサートを1行足すと網羅が締まる(任意)。
3. **seed 非流出チェックが値依存**: `JSON.stringify(frame).not.toContain("99")` は seed 値 99 に依存(timestamps 16 / sequence 1 と衝突しない値として適切に選ばれている)。将来 frame に数値フィールドが増えた際に false-pass の余地があるが、現状は妥当。
4. **60Hz 周期は下限のみ**: test 11 は `advanceTimersByTime(100)` で ≥5 frame(下限)を確認するのみで正確な周期・上限は固定しない。ただし interval 値は定数 `1000/60` を直接使用しており、周期そのものは自明。非 blocking。

## 質問

- なし。本レーンの blocking 観点はすべて実効的にテストされており、修正要求は無い。
- 参考申し送り(Orch-Sylph 判断用): Gnome 報告の「初回ランのみ 3 fail(3件目フレーク)」は当方5ランで再現せず。心臓テスト自体の不安定性ではなく、リポジトリ全体の別テスト(当ドメイン外)の一過性挙動と見られる。本レーンの判定には影響しない(心臓/合成テストは常時安定 pass)。
