# C2 Domain B レビュー(Review-Sylph): レーン③ test adequacy

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-10。ブランチ: feature/2d-rigging-eco-system。
> レーン: test adequacy(fixture の機械ゲートが本物か・分布性質テストの実効性・決定論の網羅)。他2レーン(spec compliance / design-development)は別担当。
> 判定基準: `c2-wave-plan.md` §7/§10/§12、`c2-blink-and-generator-skeleton.md` §5/§6.1/§6.2/§6.4。

## 判定

**合格(pass)**

test adequacy レーンに blocking なし。golden は実効的な機械ゲート(トートロジーでない)、§7 が要求する分布性質は決定論固定の期待値で検証済み、決定論の網羅(同種同列・異種異列・異設定異列・恒等/非恒等 modulation)も揃っている。レパートリー拡張点も stub 合成で実証。自分で実行したテストは全件パス。裁量注記4点(いずれも非 blocking)。

## 自分で実行したテスト結果

app ディレクトリ `apps/runtime-player` で実行:

- `npx vitest run src/main/physiology/` → **27/27 pass**(3 ファイル: fixture 4 / behavior 15 / generator 8)。
- `npx tsc --noEmit -p tsconfig.json` → **exit 0**。
- 既知 baseline fail(browser-source-server 系 2 件 = Wave21 由来)は本レーンの実行範囲外。physiology/ は新規追加のみで既存に不接触のため、当該2件と本ドメインは無関係(Gnome 報告と整合、本レーンで再確認は不要と判断)。

## golden の実効性判定(トートロジーでない根拠)

`blink-behavior-fixture.test.ts` の golden ゲートは**本物**。根拠:

1. **committed golden が assert 対象**: `loadOrCapture` は `UPDATE_BLINK_GOLDEN=1` かつ/または golden 不在時のみ再生成し、通常経路(flag なし・ファイル存在)では disk の committed golden を読んで返す。`expect(series).toEqual(golden)` は「毎フレーム epoch から新規計算した series」対「committed golden」の突合であり、自己再生成して自分と比較するトートロジーではない。
2. **corruption で落ちることを実測確認**: committed `blink-default.golden.json` の非ゼロ1フレーム(frame 316)を -0.01 摂動すると `default config series matches the committed golden` が **FAIL**(他3件は pass)。摂動を戻すとグリーン復帰。→ golden は実際に固定値列を機械固定している(git 上は未コミット新規ファイル `??` のため、bash 側 `/tmp` バックアップとの `diff` 一致でも復元を確認済み)。
3. **golden が空/自明でない**: default = 900 フレーム(16ms×900 ≈ 14.4s)、distinct 63 値、min 0 / max 1.0(全閉到達かつ開へ復帰)、>0.95 が 16 フレーム。まばたきの起伏を実際に含み、frame 567–569 と 596–598 のピーク対(≈464ms 間隔 < 不応期 900ms)は**二連まばたき(ぱちぱち)を捕獲している**——起伏だけでなくクラスタ構造まで golden に固定されている。
4. **設定も入力の別 golden**: alt-config(meanInterval 1800 / hold 120 / closeDepth 0.85)は独立 committed golden。distinct 124 値、max 0.85(浅い深さ反映)、>0.5 が 96 フレーム(高頻度反映)。テストは max ≤ 0.85+1e-6 も assert。
5. **同種同列・異種異列・異設定異列**を fixture 内で明示検証(`same===golden`、`other!==golden`、`alt!==def`)。

## 分布性質テストの評価(§7 の性質ごと)

`enumerateBlinkEvents`(sampleBlinkActivation と同一の `makeEvent`/scheduling を共有する純関数)上で、決定論固定シードの population に対して検証。**別コードパスでなく実サンプリングと同じ scheduling を突いている**点も適切。

| §7 要求性質 | テスト | 期待値の実効性 | 評価 |
|---|---|---|---|
| 不応期を破らない | `never breaks the minimum refractory period` | 500+ 件の非 second-of-pair で `gap ≥ eff.minRefractoryMs(=900) − 1e-6` | 固定期待値。可 |
| 二連が設定確率で出る | `double-blink rate tracks the configured probability` / `second-of-pair sit closer than refractory` | 5,000,000ms の固定シード population で perPrimaryRate ∈ (0.06, 0.2)、configured 0.12。pair は不応期未満 | 決定論(seed 固定→率は固定値)。band はやや広いが実効。可 |
| 閉/開 非対称(閉<開) | `envelope is asymmetric` / `close phase rises, open phase falls` | 先頭 400 件で `closeDurationMs < openDurationMs`(jitter±15%込みでも成立)+ サンプリング列の単調性 | 固定・網羅的。可 |
| 両目同値 | behavior `emits both blink slots with the same value` / generator `left === right` | 複数時刻で `out[left] === out[right]` | 可 |
| 深さ・保持の反映 | `reaches full close depth and holds it` / `reflects a shallower depth via modulation` | close 終端の peak ≈ depth(=1)、hold 中央 ≈ depth、depthMultiplier 0.5 → peak ≈ 0.5 | 固定期待値。可 |
| 設定も入力(設定変えても決定論・別 golden) | fixture alt-config + `different config → different series` | 別 golden 一致 + 異列 | 可 |

## 決定論の網羅

- **同種同列**: `same seed → same series`(behavior/fixture 双方)。可。
- **異種異列**: `different seed → different series`(+両列とも実際に blink を含む non-trivial assert)。可。
- **異設定異列**: `different config → different series`。可。
- **恒等 modulation = baseline**: `identity modulation is equivalent to baseline-only` が `resolveEffectiveBlink(identity)` の各量 = baseline を assert。接ぎ木回避(乗算子 1 = passthrough)の担保として妥当(注記1参照)。
- **非恒等 modulation の決定論**: `modulation stays deterministic when non-identity` が rateMultiplier 1.5 → interval 短縮 + `first === second`(2 回サンプル一致)+ 固定窓でイベント数増を assert。可。
- **時刻/乱数依存の混入**: テストは全て固定 seed と論理時刻引数のみ。source 側は `physiology/ purity` 構造テスト(コメント除去後に electron/Date.now/performance.now/new Date/Math.random/node:crypto/randomBytes の不在を assert)で機械保証。fixture の `node:fs`/`process.env` は harness であり source 純度制約の対象外(妥当)。

## レパートリー拡張点のテスト

- `composes an additional behavior without touching the generator body`: breathingStub(`body-breath` を決定論出力)を `behaviors` に足すだけで merge され、`behaviorIds` に両者、`body-breath` 値も決定論(3650ms→0.65)。**生成器本体コード無変更で合成が成立**することを実証。可。
- `forward cursor equivalence` / `rewinds correctly`: 前方カーソル memo が epoch walk と全フレーム一致・逆行時 rewind で一致 → memo の忠実性 = 決定論不変を機械担保。可。

## blocking 差分

なし。

## 裁量注記(非 blocking)

1. **恒等=baseline テストの粒度**: `resolveEffectiveBlink(identity)` の数値一致で検証しており、「別の baseline-only 経路が生む全 series と一致」ではない。ただし実装上 modulation は常に乗算経路を通り「baseline-only 経路」は独立に存在しない(恒等が唯一の C2 経路)ため、乗算子1=passthrough の担保として現行テストで十分。指摘のみ。
2. **golden の self-heal(missing 時サイレント再生成)**: `loadOrCapture` は golden 不在時に fail-loud せず自己生成する。committed 済み・実測で corruption 検出も確認したため現状のゲートは実効。ただし CI で golden を誤削除した場合トートロジー化しうるので、より厳格には「不在=テスト失敗」が望ましい。将来の堅牢化候補(本 wave では非 blocking)。
3. **二連率の許容 band(0.06–0.2 / configured 0.12)**: 固定シードのため実率は固定値であり band は許容幅の記録に過ぎない。やや広めだが実効性に問題なし。
4. **不応期テストが構築由来を一部ミラー**: `gap ≥ refractory` は `Math.max(minRefractoryMs, raw)` の構築の帰結だが、決定論 population 全体で固定床(900)に照らして検証しており、構築の回帰検出として妥当。

## 質問

- なし。本レーン(test adequacy)の観点で追加確認が必要な未決事項は発生しなかった。他レーン(spec compliance / design-development)の判定は別 Review-Sylph に委ねる。
