# Wave105 Domain A — Variant Visibility Gate ドメイン報告書（Orch-Sylph）

Verdict: **pass**

- Domain id: `wave105-variant-visibility-gate`
- 完遂役: Orch-Sylph（opus、Undine から委任）
- Source of truth: `discussion/implementation/orchestration/wave105-plan.md` §3.1 / §6 / §8 / §9；`discussion/model-authoring/research/variant-feature-survey.md`
- 成果物:
  - 実装 + Gnome 報告: `wave105-domain-a-gnome-report.md`
  - Gnome 修正報告（P5 gap 閉塞）: `wave105-domain-a-gnome-fix-report.md`
  - レビュー 3 レーン: `discussion/implementation/reviews/wave105/wave105-domain-a-{spec-compliance,design-development,test-adequacy}-review.md`

## 1. 前任喪失の経緯

Wave105 Domain A は前任 Orch-Sylph が Gnome 実装完了（`wave105-domain-a-gnome-report.md`）まで進めた後、**アプリ再起動で失われた**。ディスク上には Gnome 実装・報告・変更ファイル群が残存し、`reviews/wave105/` は空（レビュー未実施）だった。本 Orch-Sylph（Undine が再委任）が Gnome 報告と実装現状を確認した上でレビュー段階から引き継ぎ、ドメインループを完走した。

引き継ぎ時点の確認:
- 変更ファイル群（Gnome 報告 §2 の一覧）は全てディスク上に存在。
- focused テスト全緑を再実行で確認: `apps/authoring-host` 80 / `packages/ai-interface` 122 / `packages/render-software` 37 = 239 passed（ref e2e の 6/9 ゲート・Rodos override・reject 各テスト含む）。
- `reviews/wave105/` は空、Gnome 報告のみ存在。

## 2. レビュー判定一覧

Domain A に独立レビューレーン 3 本（すべて Review-Sylph, opus）を 1 メッセージで並列起動。

| レーン | 総合判定 | 要点 |
|---|---|---|
| Spec Compliance | **pass** | ゲート意味論（`base && predicate`）が Export 参照実装 / Editor 適用実態と同型。snapshot レベル適用・空ケースバイト同一・サイドカー/測量 selection 記録・ref 6/9 データ由来を実証。Gnome フラグ（modelEvaluatedBounds visible-only 化）は「維持すべき・revert 不要」と裁定。 |
| Design / Development | **pass** | authoring-core 純関数消費（再実装なし）、runtime-core / authoring-core 無変更、boundary 非緩和（ai-variant-selection.ts は package-format を import せず id パターンをインライン宣言、実定義と文字列一致）、write scope 厳守、決定論的シリアライズ。 |
| Test Adequacy | **needs_fix → 修正後 pass** | Required test は総じて強く非 vacuous（P1〜P4 mutation で対応テストが赤化、ref 6/9 はデータ由来）。**唯一のギャップ P5**: `modelEvaluatedBounds` の visible-only 化を守るテストが無い（union-all に戻しても全緑）→ Gnome へテストのみ追加を委任し閉塞。 |

### 2.1 needs_fix → 修正の顛末（ループ 1 回）

- **検出（Test Adequacy P5）**: `apps/authoring-host/src/perception/evaluated-bounds.ts` の `modelEvaluatedBounds` visible-only union 化（計画 §3.1「framing shares the visibility world」/ §9「目と巻尺が同じ可視性世界を見る」の要件）が、どのテストにもガードされていない。既存の合成フィクスチャは eye/eye-mask が同一領域に重なるため union が縮まらず捕まえられず、ref e2e は決定論のみ assert で golden 比較しないため framing 回帰が黙って通る。**意味論としては Spec Compliance が「妥当」と裁定した振る舞いが、テストで固定されていない**という指摘（両判定は矛盾せず両立）。
- **委任**: Gnome へ「テストのみ追加・本番コード変更禁止」の狭い follow-up を委任（成果物パス契約付き）。
- **修正（Gnome、案 A 採用）**: `apps/authoring-host/src/perception/evaluated-bounds.test.ts`（新規）に `modelEvaluatedBounds` 直接ユニットテストを追加。手組み最小 snapshot に `visible:false` drawable を可視 union の bbox 外（`[100,120]²`）に配置し、返る rect が可視分（`{x:0,y:0,width:10,height:10}`）に一致することを assert（union-all なら `width/height:120` に広がり赤化）。ペアで gate-free 全可視時の union 不変も固定。
- **修正の mutation 実証**: Gnome が filter 除去でテスト 1 の赤化を確認・即復元。Orch-Sylph が独立に再検証（下記 §3）。
- **ループ上限**: 5。実消費 1 回。

## 3. Orch-Sylph 独立再検証（修正後）

信頼するが検証する:
- `git diff apps/authoring-host/src/perception/evaluated-bounds.ts` は Wave105 元実装（visible-only filter + JSDoc）のみ、PROBE 痕跡なし。
- `grep -rl "PROBE" apps/authoring-host/src packages/ai-interface/src` → 残渣ゼロ。
- 新規テスト単体 2 passed、`npx tsc --noEmit -p apps/authoring-host/tsconfig.json` exit 0。
- Gnome 報告: `npx vitest run apps/authoring-host`（ref e2e 含む）82 passed（元 80 + 新 2）。
- Forbidden スコープ（runtime-core / authoring-core / render-* / operation-core / validator-core / package-format / apps/editor / apps/runtime-player / `ref/`）git status 空。
- boundary 非緩和: `packages/ai-interface/package.json` / `pnpm-lock.yaml` / root `package.json` 無変更。

## 4. 再生成 PNG の変化（Gnome 報告 §5 要約）

wave104 の PNG 3 枚はゲート無しで撮られ、Ware グループの 3 衣装（Default / Rodos / Endoministorator）が重畳した約 9 drawable の余分描画を含む既知の不完全版だった。ゲートが defaultActive（Default 衣装）に解決した結果:

- `ref-rest-full.png` — バイナリ変化。model-bounds framing が 392×1024 → 389×1024 に締まった（除かれた衣装 drawable が union を広げなくなったため。これが §2.1 で守られていなかった振る舞い）。
- `ref-face-focus.png` — バイナリ変化（重畳衣装レイヤーがフレームから除去）。
- `ref-eyes-viewport.png` — バイトは**不変**。その stage viewport は目の領域を覆い衣装 drawable を含まないため。サイドカーに `variantSelections` 記録が追加されただけ（consistency signal、miss ではない）。
- 3 サイドカー + `ref-measurement-gate.json` は全て `variantSelections: [{kind:"singleSelect", variantGroupId:"vgrp_expression", variantId:"var_expression_default"}]` を記録。
- 決定論維持: fresh dir への再レンダリングは 2 回バイト一致。

## 5. Artifact-Wait プロトコル観測記録（§3.2 実験・実戦初データ）

本ドメインは待機プロトコル（SKILL.md 規則 1-3 最新版）で運用した。観測結果:

| 段階 | 子 | 待機ループ回数 | 結果 |
|---|---|---|---|
| レビュー 3 レーン並列 | Spec / Design / Test Adequacy | 2 回（1 回目で 2/3、張り直し 1 回で 3/3） | 全レポートを契約パスへ回収、同一ターン内で判定 |
| 修正 | Gnome（P5 テスト追加） | 1 回で 1/1 | 修正報告を契約パスへ回収、同一ターン内で再検証 |

- **L0（Undine）中継は 0 回**。ドメインループ全体（引き継ぎ → レビュー → 判定 → 修正委任 → 再検証 → 報告）を L0 中継なしで単一の在席継続で完走できた。プロトコルの設計目標（ターンを終えずにドメインループを完走）を達成。
- **二重チャネル確認**: PowerShell フォアグラウンド待機ループでのファイル出現検知と、子の完了 task-notification のターン内配達が**両方**機能。待機ループが `found: 2/3` で返った直後に Spec/Design の completion notification が同一応答内で届き、Test Adequacy は張り直したループで検知＋その後 notification 到達、という二重チャネルの重なりを実観測。どちらか一方が欠けてもデッドロックしない構成が実証された。
- **想定外挙動**: Test Adequacy レーンはプローブ（P1〜P5 の mutation 注入）を実施したため他 2 レーンより所要時間が長かった（約 550 秒 vs 260 秒前後）。1 回目のループ（8 分デッドライン）内では 2/3 で返り、2 回目のループで揃った。**死亡推定は一切行わず、沈黙・遅延を理由とする再起動・代替作業もしていない**（規則遵守）。プロトコルは想定通り「揃わなければ張り直す」で吸収した。
- **張り直しコスト**: PowerShell の Start-Sleep（20 秒間隔ポーリング）で在席、フォアグラウンド待機は正常機能。Bash sleep はブロックされるが PowerShell Start-Sleep は使用可を再確認。

## 6. Gnome 報告の要約と裁量判断

- Gnome は snapshot レベルで `base && variantVisibilityPredicate(activeSelections)` を合成する新 snapshot を返す実装を行い、render / 測量 / framing が単一の gated snapshot を消費する構成にした。authoring-core の純関数（`createVariantVisibilityPredicate` / `resolveDefaultVariantActiveSelections`）を消費、再実装なし。
- **Gnome がレビュー向けにフラグした 1 点**（`modelEvaluatedBounds` を可視 drawable のみの union に拡張、ゲート無しパッケージでは no-op）について:
  - **Spec Compliance の裁定**: 妥当・維持すべき（revert 不要）。全 drawable union に戻すと、目も巻尺も見ていない隠れ衣装が modelBounds 枠だけを広げる不整合が構造化され、計画 §3.1 に反する。ゲート無しでは全 drawable visible のため filter は恒等で旧挙動と一致。
  - **Test Adequacy の裁定**: 意味論は正しいが**テストで固定されていない**（P5）→ 修正で閉塞。
  - **Orch-Sylph の裁量結論**: フラグされた振る舞いは維持（本番コード変更なし）、テストで固定（新規ユニットテスト追加）。両レビューの結論を統合し、意味論の妥当性とテスト実効性の両方を満たした。

## 7. 質問（Undine への確認事項）

Domain A の pass 判定自体には影響しないが、Undine / L0 の帰属確認が必要な事項:

1. **【スコープ外 2 ファイルの帰属】** Design/Development レビューが指摘。working tree に Domain A 実装スコープ外の 2 ファイル変更がある:
   - `.claude/skills/implementation-orchestration/SKILL.md`（規則 1-3 の artifact-wait プロトコル改訂）
   - `discussion/model-authoring/research/delegation-calibration-log.md`（Round 4 実験記録追記）

   内容は §3.2 の artifact-wait 実験の統制記録であり、variant ゲート実装とは無関係。Gnome 報告 §2 はこの 2 ファイルに言及していない。**Orch-Sylph / L0 が実験統制の一環で編集したものと推定**されるが（Domain A 実装 pass 判定には影響なし。実装/テスト/成果物はすべて Allowed scope 内）、正式な帰属を Undine に確認したい。もし将来のコミット分割時にこの 2 ファイルを Domain A のコミットに含めない意図があるなら、Domain B（Final Integration）で扱う必要がある。

## 8. 残リスク

- なし（ブロッカー）。Domain A の全 Required 実装・Required test・Verification Matrix 項目を満たし、P5 gap も閉塞済み。
- 非ブロッキング note（Test Adequacy §Secondary）: 合成フィクスチャが `base.session.graph.variantGroups` を直接代入で組む（operation-core commit 経由でない）が、`VariantGroupSchema` で parse 済み・test-support 限定・variant 編集操作が明示的に out of scope（計画 §12）のため許容。ref sidecar の `packagePath`/`pngPath` は machine-absolute（wave104 由来の既知 non-blocking note C-DEV-N-01、継続）。

## 9. 次段（Domain B への申し送り）

- Domain B（Final Integration / Clean Review / Map Closeout）は本報告 + 3 レビュー + Gnome fix report の存在・pass を確認し、focused テスト / root+app tsc / check-source-organization / check-dependencies / git diff --check / forbidden-scope diff / final clean integration review / `_map.md` 更新を行う。
- §7 の質問 1（スコープ外 2 ファイルの帰属）は Domain B のコミット分割・integration review の観点で扱うべき事項として申し送る。
