# Wave106 Implementation Map

> Lightweight map for Wave106 `dynamics-world-frame-chain` implementation artifacts.

## Domain Reports

| Path | Domain | Status |
|---|---|---|
| [wave106-domain-a-core-replacement-report.md](wave106-domain-a-core-replacement-report.md) | A. Core Replacement (packages 全層 + fixtures) | pass (3 review lanes; 1 fix loop = Gnome-4 catalog/旧名 穴A/B) |
| [wave106-domain-a-gnome1-report.md](wave106-domain-a-gnome1-report.md) | A. Gnome-1 (スキーマ/状態/ソルバ/evidence) | complete |
| [wave106-domain-a-gnome2-report.md](wave106-domain-a-gnome2-report.md) | A. Gnome-2/3 (下流層 + fixtures + テスト green 化) | complete |
| [wave106-domain-a-gnome4-fix-report.md](wave106-domain-a-gnome4-fix-report.md) | A. Gnome-4 fix (check-catalog §7 改廃 + evaluatorVersions 旧名撤去) | complete |
| [wave106-domain-b-editor-dynamics-tool-report.md](wave106-domain-b-editor-dynamics-tool-report.md) | B. Editor Dynamics Tool 対応 | pass (2 review lanes, fix loop なし) |
| [wave106-domain-b-gnome-report.md](wave106-domain-b-gnome-report.md) | B. Gnome implementation report | complete |
| [wave106-domain-c-player-tuning-v2-report.md](wave106-domain-c-player-tuning-v2-report.md) | C. runtime-player Tuning Profile v2 | pass (2 review lanes; 1 fix loop = Test Adequacy D-1 無効値テスト15件新設) |
| [wave106-domain-c-gnome-report.md](wave106-domain-c-gnome-report.md) | C. Gnome implementation report (修正ループ節含む) | complete |
| [wave106-domain-d-gnome-ref-v3-report.md](wave106-domain-d-gnome-ref-v3-report.md) | D. Gnome ref/ dynamics v2→v3 再生成 (ユーザー裁定によるスコープ解除、翻訳規則明文記録) | complete (AC 1-4 達成) |
| [wave106-final-integration-report.md](wave106-final-integration-report.md) | D. Final Integration / Clean Review / Map Closeout | final complete / pass after final clean review (pre-existing 台帳 P1-P5 収録) |

## Notes

- dynamics v0（`additivePendulumV0`、入力値を平衡点とするバネ系）→ 世界系 Verlet 質点チェーン（`worldFrameChainV1` / `dynamics-file-v3`）への破壊的置換。設計オラクル: `discussion/design/dynamics-world-frame-chain.md`（§3 の式が一字一句仕様）。
- 平衡点の物理的正しさ（角度→θ_local=−φ / 並進→0 / 複合→−φ）を数値テストで固定。周期√則は Physics レーンが独立再現（ratio 1.0000）。マイグレーションなし（裁定#1: v2 は schemaVersion 厳密一致で hard reject、player profile v1 は自動破棄）。
- Domain D で新規発見・解消: v3 hard reject が `ref/model/dynamics.json`（v2）と衝突し authoring-host `ref-e2e.test.ts` が 6/7 赤化（clean HEAD `dc9fae9c` stash 実測で wave106 起因を確定）。ユーザー裁定（ref/ はユーザー所有物）で `ref/model/dynamics.json` + `ref/manifest.json`（schemaVersions.dynamics 1行）の2ファイル限定スコープ解除 → 決定論的近似翻訳規則（chain: segmentLengths=[length_v2×16]cm / damping=convergenceSpeed_v2×0.6 / gravityScale=1.0 / rootOffset={0,0}、input: scale=(invert?−1:+1)×influencePercent/100×(angle:1.0/position:3.0)、output: segmentIndex=1 / scale=strength_v2/30 / limit 維持）で v3 再生成。ref-e2e 7/7 green・render-gate artifacts バイト不変で解消。
- **教訓**: 「無傷」の判定はコードだけでなく、そのコードが読むデータにも及ぶ。blast-radius inventory は authoring-host を「dynamics 専用コードなし＝無傷」と分類したが、汎用ロード経路（`parsePackageDocumentFromFileSet`）× ref の v2 データという組で破損した。
- Pre-existing 台帳（wave 外 in-flight 由来、後続掃き出しリスト）: P1 packages 赤14（tutorial/variants/keyform 系、stash 実測で HEAD 同一）/ P2 editor tsc 22（variant/mesh/exactOptional、dynamics 起因ゼロ）/ P3 editor 赤4（diagnostics-jump entry リネーム）/ P4 player 赤2（browser-source `effectiveDynamicsTuning` shape）/ P5 check-deps cmo3 lockfile 既知 finding。詳細は final integration report §7。
- Forbidden-scope: render-software / render-webgl2 / lockfile / npm manifest 無変更。authoring-host **ソース**無変更。fixtures 差分は dynamics 局在。

## Final Gate

- Final clean integration review recorded `pass`（zero blocking findings）。Wave106 is final complete / pass。
- ゲートは L0 裁定によりベースライン比較型（wave106 起因・dynamics 起因の新規赤/エラーゼロ）。literal な apps tsc exit 0 は P2 の掃き出し後に回復する。
- Hair Sway パラメータの実 rigging（ref の較正を含む）は model-authoring 側の次の閉問題（計画 §14 Out of Scope）。ref の翻訳値は較正前提の近似（設計 §8/§10 の運用導線）。
