# Wave107 Implementation Map

> Lightweight map for Wave107 `vowel-lipsync-mapping` implementation artifacts.
> 設計オラクル: `discussion/design/vowel-lipsync-mapping.md`（§2〜§4）/ 計画: `discussion/implementation/orchestration/wave107-plan.md`

## Domain Reports

| Path | Domain | Status |
|---|---|---|
| [domain-a-gnome-report.md](domain-a-gnome-report.md) | A. 推定器コア + 5スロット + トグル（Gnome 実装報告） | complete |
| [domain-b-report.md](domain-b-report.md) | B. キャリブレーション統合（Orch 報告） | pass（review 1 lane, fix loop なし） |
| [domain-b-gnome-report.md](domain-b-gnome-report.md) | B. キャリブレーション統合（Gnome 実装報告） | complete |
| [wave107-final-integration-report.md](wave107-final-integration-report.md) | C. Final Integration / Clean Review / Map Closeout | **final complete / clean review pass**（実機ユーザー gate 待ち。pre-existing 台帳 §4 収録） |

## Reviews

| Path | 対象 | 判定 |
|---|---|---|
| [../../reviews/wave107/domain-a-vowel-core.md](../../reviews/wave107/domain-a-vowel-core.md) | Domain A（推定器コア） | 合格（ループ1） |
| [../../reviews/wave107/domain-b-vowel-calibration.md](../../reviews/wave107/domain-b-vowel-calibration.md) | Domain B（キャリブレーション） | 合格（ループ1） |
| [../../reviews/wave107/final-clean-review.md](../../reviews/wave107/final-clean-review.md) | Domain A+B 合算（統合後クリーンレビュー） | **合格**（要修正なし） |

## Notes

- 母音（あいうえお）リップシンク = 写像層の nearest-reference 推定スロット5本 + ON/OFF トグル + キャリブレーション統合。追加的変更のみ（既存 1スロット=1parameterId 機構・strength 機構・保存形式は不変）。
- 方式: 特徴8次元の中立差分 → 重み付きユークリッド距離の最近傍 argmax（cos 類似不可の実測根拠を距離ベースで解決）→ 強度 `w = d(Δ,中立)/(d(Δ,中立)+d(Δ,最近傍母音))` → ゲート（0.15）+ ヒステリシス（マージン0.05 + 連続3フレーム）。全定数は実測 JSON（`test_data/iFaceMocap/vowels/vowel-captures.json`、2026-07-06）由来の named constant。
- 相互排他は上流の共有推定器（`runtime-parameter-frame.ts` でフレーム1回メモ化）+ argmax で構造的に担保。5スロットは独立評価形式を保ったまま「単一 Vowel 非ゼロ」がリグ契約通り出る。
- Domain B シーム裁定（L0 確定・設計 §4 反映）: 永続形 = 生 blendshape 平均全次元 + 採取メタ / 消費型 `VowelReferenceVectors`（8次元縮約）不変 / 境界アダプタが推定器の `extractVowelFeatureVector` 再利用で縮約規則を機構的一致 / live-mapping 追随は import 1 + 参照解決1分岐。
- **Domain A の Orch 報告は不在**（Gnome 報告 `domain-a-gnome-report.md` + レビュー `domain-a-vowel-core.md` のみで A ドメインの成立を確認。final integration のクリーンレビューが A+B 合算で独立に合格を裏取りしたため、統合の合否には影響なし）。

## Pre-existing 台帳（wave 外 in-flight 由来・後続掃き出しリスト）

wave107 の全変更を clean HEAD（`ee038e84`）で stash した baseline で同一再現する既存失敗。wave107 起因の新規赤ゼロ。詳細は final integration report §4。

- **P4-cont（player 赤2）**: `browser-source-server.test.ts:150` / `browser-source-server-message.test.ts:216` の `effectiveDynamicsTuning: null` 期待値ずれ。根本原因 = commit `4627bbd3`（wave21 dynamics-tuning）でソースにフィールド追加、テスト期待値未更新。**テスト側 1行×2ファイルの更新で解消**（実装退行ではない）。wave106 台帳 P4 の継続。
- **P1-cont（packages 赤14）**: `operation-core`/`runtime-core`/`validator-core` の fixture/contract 系（tutorial-mini-model / warp-lattice / grid2d-keyform ほか）。`packages/**` 変更ゼロで wave107 無関与。wave106 台帳 P1 の継続。

いずれも修正 op 未発行（in-flight 作業との衝突回避）。L0 → ユーザーへエスカレーション済み。

## Final Gate

- Final clean review recorded `pass`（zero blocking findings, 要修正なし）。Wave107 is final complete / pass。
- 母音起因の新規失敗ゼロ・既存挙動無傷。typecheck green（root + runtime-player）・母音関連10スイート62テスト green。
- 実機ユーザー gate（player 起動→母音発話→ちらつき/ゲート→トグル→strength、任意で較正）は wave 外。手順は final integration report §5。
- 採取ツール `apps/runtime-player/tools/capture-vowel-frames.ts` + 実測データ `test_data/iFaceMocap/vowels/` は untracked のまま残存（設計 §5/§6 の一次データ源、コミット帰属はユーザーフロー裁量）。
