# C3 Domain A レビュー — レーン3: test adequacy

> レビュアー: Review-Sylph(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`、`cohost-c3-noise-and-config-seam`。
> basis: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §6 Domain A / §8、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §1.2、Gnome 報告 [domain-a-noise-and-config-seam.md](../../waves/c3/domain-a-noise-and-config-seam.md) §3。

## 判定: 合格（推奨改善1件つき）

必須テスト5項目はすべて存在し、意味あるアサーションを持ち、実際にパスする。報告の「8 files / 68 tests パス」を自分の実行で再現。golden 2本と fixture テストは git 無変更を確認。退行を将来にわたって固定する強度は十分。1点だけ「裁量選択(quintic 補間の C² 連続性)がテストで固定されていない」穴があるが、これは必須要件(§6=境界『連続』まで)の範囲外であり blocking ではない。将来退行検知のための追加アサーションを推奨として付す。

## 実行確認

```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/physiology src/main/role-composition
→ 8 files / 68 tests passed（deterministic-noise 12, physiology-config 4, autonomous-frame-heart 13,
  input-subsystem 9, blink-behavior-fixture 4, blink-behavior 15, physiology-generator 8, role-selection-stub 3）
```

git 無変更確認: `blink-default.golden.json` / `blink-alt-config.golden.json` / `blink-behavior-fixture.test.ts` は diff-stat 空・status 未表示（新規は deterministic-noise.{ts,test.ts} / physiology-config.{ts,test.ts}、変更は index.ts のみ）。

## 必須5項目の充足評価

1. **純関数性** — 合格。`smoothValueNoise` 同時刻不変(l.29-35)、seed/channel 決定論と decorrelated(l.37-46)、reproducible 再確認あり。`layeredValueNoise`/`homeSpringValue` も同時刻不変を各テストで押さえる。「異時刻→異値」は平滑性テストの `maxDiff > 0`(l.79)で間接カバー。純度(壁時計・非シード乱数ゼロ)は blink-behavior.test.ts の構造スキャンが新規2ファイルを含めて担保。

2. **平滑性 + 境界連続** — 合格(下記推奨1件)。隣接16msサンプル差 ≤ 解析境界 `NOISE_SPAN·SMOOTHERSTEP_MAX_SLOPE·(dt/cellMs)`(l.66-80)。境界の解析的妥当性を検算した: 1セル内の差は平均値の定理により `|b-a|·max|smootherstep'|·(dt/cellMs) ≤ 2·1.875·(dt/cellMs)`、dt=16<cellMs=900 で境界跨ぎは1セルまで、端点で smootherstep 導関数ゼロ(跨ぎでは差が縮む)ため上界として妥当。`maxDiff>0` で「平坦でない=実際に動く」も固定。セル境界の値連続(l.82-91、前後 1e-4 未満)あり。homePull下の平滑性は指数3の Lipschitz(`×3`)を織り込んだ bound で固定(l.173-197、解析的に正当)。

3. **config 差し替え** — 合格(深い)。参照変化→次tick再構築(createGenerator 2回目、autonomous-frame-heart.test.ts l.419-422)/ 安定→非再構築(l.411-416, 424-427)/ 同 seed 保持(built[0..1].seed===55, l.430-431)/ 再構築 behaviors が新 config の blink を反映(refA/refB 突合 l.432-445)を分けて押さえる。加えて heart レベルの退行ゲート「provider 無 fallback === 明示 default provider」を byte 列で固定(l.448-473)。role 差: autonomousHost のみ provider 前送(input-subsystem.test.ts l.241-255)、trackingHost は heart を作らず provider を読まない(l.257-269、`not.toHaveBeenCalled`)。実行時 role 分岐ゼロが合成テーブル1点であることを固定。

4. **golden 2本の完全一致** — 合格。既定 config 経路の出力が `blink-default.golden.json` と round6 量子化で deep-equal(physiology-config.test.ts l.92-108、GOLDEN_SEED/STEP_MS/FRAMES は fixture と同一)。golden 2本の不変性は blink-behavior-fixture.test.ts が default/alt 両方を committed golden と `toEqual` で検証(l.68-81)、4 tests 無変更パス。`physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG)` が C2 `DEFAULT_BLINK_CONFIG` と deep-equal(l.38-46)で載せ替えの退行ゼロを型レベルでも固定。注: alt-config golden は C3 の既定 config ではない(C2 の別 config の golden)ため config 経路で再現する要件はなく、fixture test 側での不変検証で十分。

5. **タイマーリークなし** — 合格(深い)。manual scheduler で start後start=clearInterval 1回/setInterval 2回(l.308-339、二重化なし)、stop 冪等・hasHandler false(l.341-365)。fake-timer で `getTimerCount()` 0→1→stop→0(l.481-506、残留を実タイマーで確実に落とす)。合成側 load→unload→disconnect で heart.stop 呼び出し(input-subsystem.test.ts l.203-239)、load→load で heart は単一・start 2回(l.271-288)。

## 周期非検出テスト(裁定5 機械側代理)の妥当性

deterministic-noise.test.ts l.118-134。30s lag 正規化自己相関 `Σa(t)a(t+30s)/Σa(t)²` < 0.5、窓 0..240s・dt=100。定常近似で分母 `Σa(t)²≈Σa(t+lag)²` のため標準正規化自己相関の妥当な近似。HEAD_LAYERS=[900, 6000, 45000]ms は 45s cell の遅い層を含むので 30s でループ相関が立たない構図が正しく効く。閾値 0.5 は「30s完全ループ→~1.0」に対し十分マージン。Domain A ヘルパ段(layeredValueNoise)での基盤担保として意味を持つ(本命は Domain B)。妥当。

## 穴 / 推奨改善

### 推奨1（非blocking）: quintic 補間の C¹/C² 連続性（速度キンク無し）を固定するアサーションが無い
Gnome は補間に quintic smootherstep(6t⁵−15t⁴+10t³)を選び、docstring でその売りを「ラティス点で1次導関数ゼロ→C² 連続、セル境界の速度キンク無し」としている(deterministic-noise.ts l.30-40)。しかし現行テストが固定するのは（a）隣接差の上界（値の Lipschitz 有界）と（b）セル境界の**値**連続(1e-4)のみ。**速度の連続性(C¹)は固定していない**。このため補間を cubic smoothstep(3t²−2t³)へ退行させても、cubic の max slope 1.5 < 1.875 で隣接差テストは通り、値連続テストも通るため、全テストが緑のまま quintic の売りが失われる。裁定は「境界連続」(値)までしか必須にしていないので acceptance は満たすが、「キンクのある実装を落とせるか」の観点では現状**落とせない**。
- 追加提案: セル境界前後の数値微分（例 `(f(b+h)-f(b))/h ≈ (f(b)-f(b-h))/h`）が近接、あるいはラティス点で数値速度が ≈0 であることを1本アサートすれば、quintic→cubic/linear への退行を検知できる。

### 軽微
- 純関数性の「異時刻→一般に異値」の**明示**テストは無く `maxDiff>0` の間接カバーに依存。実害は小さい。
- fixture の `loadOrCapture` は golden 欠損時に自己生成する(blink-behavior-fixture.test.ts l.53-65)ため、golden をうっかり削除すると silent に再生成される。ただしこれは C2 baseline の既存挙動で Domain A スコープ外、golden は現に commit 済み。

## Orch への質問

なし。判定は合格。推奨1は Domain B が同じ閉形式ヘルパを head/posture に消費する前に入れておくと補間退行の防波堤になるが、Domain A の acceptance を妨げるものではない（採否は Orch/Undine 判断）。
