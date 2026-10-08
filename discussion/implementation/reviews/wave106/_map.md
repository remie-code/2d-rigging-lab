# Wave106 Review Map

> Lightweight map for Wave106 Review-Sylph artifacts.

## Entries

| Path | Lane | Verdict | Notes |
|---|---|---|---|
| [wave106-domain-a-physics-spec-compliance-review.md](wave106-domain-a-physics-spec-compliance-review.md) | Domain A Physics / Spec Compliance | pass | 設計 §3.1-§3.7 の全式を行番号まで照合（積分順序・射影の子のみ移動・atan2(d.x,d.y)・θ_local=θ_world−φ）。独立検算7項全通過: 周期を Python で独立再現し解析値と ratio 1.0000、√則実検証、平衡点誤差 <0.005°。裁量#1（parameter-resolution のアンカー認識ルーティング、加算合成算術は diff ゼロ）追認。 |
| [wave106-domain-a-design-development-review.md](wave106-domain-a-design-development-review.md) | Domain A Design / Development | pass (初回 要修正2 → Gnome-4 fix loop → 解消) | 命名 §5 完全適用・廃止フィールド本体 src 残置ゼロ・§7 validator 改廃・加算合成/固定ステップ枠組み不変・境界非緩和は合格。穴A = check-catalog.ts の §7 未反映（削除3/改名2/新設2/維持7）、穴B = テスト4ファイルの evaluatorVersions 旧名。いずれも Gnome-4 で解消、Orch が grep で独立確認（final clean review も裏取り）。 |
| [wave106-domain-a-test-adequacy-review.md](wave106-domain-a-test-adequacy-review.md) | Domain A Test Adequacy | pass (初回 要修正2 = 穴A/B 同上 → 解消) | 物理妥当性テストの実効性・周期テストの式検証性（オウム返しでないことを独立検算）・golden の式再現性・fixtures 差分の dynamics 局在・`.skip`/空実装ゼロを確認。 |
| [wave106-domain-b-spec-compliance-review.md](wave106-domain-b-spec-compliance-review.md) | Domain B Spec Compliance (design/dev 含む) | pass | UI×§4 厳密一致、プリセット §8 一致、settled×§3.7 照合。anchor 経路を runtime-core まで追跡し θ_local=θ_world−φ 厳守＝症状再発温床なしを確認。廃止識別子 grep ゼロ、Domain A 引き継ぎ旧診断2件の置換確認、Quick Tune §9 語彙一致、packages 無変更。 |
| [wave106-domain-b-test-adequacy-review.md](wave106-domain-b-test-adequacy-review.md) | Domain B Test Adequacy | pass | 新診断の正/負アサーション実効、stepDynamics 整合の `toEqual` 厳密固定、anchor 経由出力の手計算独立固定、settled/idle テストが独立構成した物理状態と観測可能な RAF 挙動を固定していることを検算確認。被覆ギャップ3件（多段 N≥2 / 複数 output / settled B項単独）は非 blocking の次 wave 申し送り。 |
| [wave106-domain-c-spec-compliance-review.md](wave106-domain-c-spec-compliance-review.md) | Domain C Spec Compliance (design/dev 含む) | pass | override 語彙 §9 完全一致・乗数意味論忠実・移行コードなし（裁定#2）・旧語彙残置ゼロ・packages 無変更・signature 更新・境界バリデーション整合。 |
| [wave106-domain-c-test-adequacy-review.md](wave106-domain-c-test-adequacy-review.md) | Domain C Test Adequacy | pass (初回 要修正 D-1 → fix loop → 解消) | v1 破棄・override 数値・v2 語彙化は合格水準。D-1 = 無効値 reject/sanitize テストが validation/sanitize/parser 3層で不在 → 修正ループで15テスト新設（+ D-2 end-to-end 連結追記）。レポートは判定時点の記録として保存、解消は Domain C 報告 §修正ループに記録。 |
| [wave106-final-clean-integration-review.md](wave106-final-clean-integration-review.md) | Final Clean Integration Review | pass | 全6観点を独立再実行: ref-e2e 7/7、dynamics focused 44 tests green、root tsc exit 0、ref v3 翻訳規則の全数値再計算検算一致、廃止フィールドゼロ、render-gate バイト不変（HEAD `1f072704` 一致）、旧識別子 production 残置ゼロ、forbidden-scope 無変更、pre-existing 台帳 P1/P4 抽出検証、7レビューの修正ループ解消裏取り。ユーザー/L0 裁定3件（ベースライン比較型ゲート / ref 2ファイルスコープ解除 / 翻訳規則）を certify 対象として明記。 |

## Final Gate

- Final clean integration review is recorded as `pass`; no Wave106 review artifacts remain pending.
- ユーザー/L0 裁定3件（ベースライン比較型ゲート・ref/ 2ファイルスコープ解除・決定論的近似翻訳規則）はレビューの certify 対象として final clean review に明記済み。
- 注記: `ref/` は `.gitignore` 対象のため、ref 2ファイルの変更は git diff で直接追跡不可（find/mtime + ref-e2e green + Gnome 報告の対照表が検証根拠）。将来 ref/ を追跡化する場合は検証手段の明示が必要（final clean review 質問1）。
