# Wave104 Final Clean Integration Review

Verdict: **pass**

- Reviewer: Review-Sylph（opus、独立コンテキスト。Wave104 Domain D 最終クリーンレビュー担当）
- Date: 2026-07-03
- Caller: Orch-Sylph（Wave104 Domain D）
- Scope: Wave104 全 3 ドメイン（A/B/C）完了後の最終クリーンレビュー。読み取り専任。個別レビューの結論に依存せず、ソース・差分・テスト再実行で独立に裏取り。
- Baseline: HEAD = `2f80ca0a [modify]wave103まで.`。Wave104 の実変更範囲 = working tree（`git status --short` の M + untracked、HEAD 比較）。スコープ判定は `git diff HEAD -- <path>` で実施（`master...HEAD` は不使用）。

---

## 0. 総括

計画 §9-§11 の検証項目を独立に裏取りした結果、blocking finding はゼロ。9 レビューレーンの最終 pass、3 報告書の主張は、いずれも私自身が確認したソース・差分・再実行テストと一致した（オウム返しではなく実体一致）。分類 1-5 の適用も妥当。Wave104 は技術 gate（Domain D）として clean に統合されており、pass と判定する。残るのは wave 外のユーザー目視 gate（ref-render-gate PNG の目視承認、§3.5）と、既知の非ブロッキング申し送りのみ。

---

## 1. 成果の完成（§11 Verification Matrix 各行の裏取り）

| Requirement | Minimum evidence | 独立確認結果 |
|---|---|---|
| session 直接評価で PNG（Export 非経由） | Domain A golden + import 検査 | `apps/authoring-host/src/perception/evaluation-adapter.ts` が `toRuntimeGraph`（authoring-core）→ `evaluateViewerRuntimeSnapshot` 経由。`texture-resolution.ts` の import は `authoring-core` / `render-core` のみで Runtime Export 系なし。authoring-host 51/51 pass 実測。 |
| サイドカーで画像↔モデル座標翻訳 | ビュー変換数値テスト | `ai-render-view-command.ts` の `RenderViewResolvedViewSchema`（stageViewport / outputWidth / outputHeight / pixelsPerStageX/Y = render-software `ResolvedSoftwareRenderView` 相当）を確認。 |
| コンタクトシートのセル↔パラメータ対応 | sweep テスト | `RenderViewSweepLayoutSchema.cells`（cellIndex/column/row/parameterId/parameterValue）で対応表を保持。Domain A sweep テスト pass。 |
| stale 画像防止（revision 紐付け） | サイドカースキーマテスト | サイドカーに `packageRevision`（必須）。ref e2e が `sidecar.packageRevision === packageRevision` を assert（ref-e2e.test.ts:209）。 |
| read 機構接続 + validatePackage 実働 | Domain B 統合テスト | `ai-command-executor.ts` の read ディスパッチ + `validate-package-document.ts` を確認。ai-interface 107/107 pass、authoring-host 51/51 pass 実測。 |
| 承認ライフサイクル非緩和 | 非退行テスト + レビュー | 下記 §4 で独立確認。 |
| 測量が正確な数値を返す | 合成フィクスチャ数値テスト | `measurement-command.test.ts` を精読（§8）。 |
| 実モデル（ref）で全経路が動く | ref e2e | `ref-e2e.test.ts` 4 tests（validate / derived-verified 126 / render x3 決定論 / 測量包含）を精読・pass 実測。 |
| ref/ 無変更・新規依存ゼロ | Domain D guard + diff | §5 で独立確認。 |

いずれも報告書の主張に対応する実ソース/テストで裏取り済み。知覚（renderView + サイドカー + コンタクトシート）・測量（inspectEvaluatedGeometry）・検証コマンド面（validatePackage + read 機構接続）は各行の minimum evidence を満たす。

---

## 2. executor 三者統合の整合（§3.1-3.3）

`packages/ai-interface/src/ai-command-executor.ts` を精読し、三者合流を確認:

- **renderView**（`#executeRenderView`, L150-169）: capability `render` gate のみ。gate 不足で `permission_denied` + transcript 記録、充足時は `#unsupportedReadCommand`（`not_implemented`）で host 正規経路へ委譲。ai-interface はレンダラ/FS 依存を持たない（§3.1-3 忠実）。
- **read 系**（`#executeReadCommand`, L128-139）: `readHost` 注入時は `executeAiReadCommand(request, readHost, transcript)` へディスパッチ、未注入時 legacy `not_implemented` fallback。transcript を渡すことで二重記録を回避（executor 側で再記録しない）。
- **inspectEvaluatedGeometry**: read 系 switch（L114）に正しく合流。`ai-read-command.ts` L181-201 で host メソッド未実装時 `not_implemented`、実装時 `ok`。
- **capability チェック**: `ai-read-command.ts` `hasRequiredReadCapability`（validatePackage=`validate`、他 read=`read`）健全。
- **PSD import plan 4 コマンド**: read host を通さず `#unsupportedReadCommand`（`not_implemented`）に固定（L120-124）。

三者合流は計画 §3.1-3.3 の意図どおり。

---

## 3. boundary 非緩和（L0裁定3）

- `packages/ai-interface/package.json`: **無 diff**（`git diff HEAD` 空）。dependencies は contracts / operation-core / runtime-core / validator-core / zod の 5 本のみ。render-core / render-software 依存なし。
- `packages/ai-interface/src/**` に render-core / render-software の `import` 文なし（コメント内言及のみ）。
- boundary allowlist は package.json 依存グラフに対する `scripts/check-dependencies.mjs` の検査で担保。ai-interface package.json 無変更ゆえ boundary 非緩和は構造的に確定。
- ai-interface 既存テストファイルの変更ゼロ（`git status` 上 M なし、追加は新規 3 本のみ）→ boundary テスト無変更・非緩和。

---

## 4. 承認ライフサイクル非緩和（Domain B non-regression）

- `ai-command-executor.ts` の `#executeDryRun`（L171-197）/ `#executeCommit`（L199-241）は capability チェック（dryRunEdit / commitWithApproval）・approval policy 記録・commit approval チェックを全て保持。read 統合は別経路（`#executeReadCommand`）で、承認系に触れていない。
- `TranscriptingAiApprovalPolicy`（L409-448）健在 = 承認・dry-run が transcript に記録され続ける。
- 承認関連ファイル（`ai-approval-policy.ts` / `ai-command-transcript.ts` / `ai-operation-command.test.ts`）は **無 diff**（`git diff HEAD --stat` 空）→ 承認ライフサイクルの非退行を diff で実証。
- `validate-package-document.ts` は read 経路で副作用なし（dry-run/commit/save をしない）。

read 統合後も transcript 記録・capability チェック・dry-run/commit 強制は活きている。

---

## 5. Forbidden scope 侵犯ゼロ

- `git diff HEAD --stat -- apps/editor apps/runtime-player packages/render-webgl2 packages/operation-core packages/validator-core/src packages/package-format/src` → **空**（挙動変更ゼロ）。
- `git status --porcelain -- ref/` → **空**（ref/ 無変更）。ref-e2e.test.ts の stateDirectory は tmpdir 配下で ref 外。
- 新規外部依存ゼロ: `git diff HEAD -- pnpm-lock.yaml` に `resolution:` / `registry` / `integrity` / `https://` 行なし。+12 行は全て `@private-2d-rigging-lab/*`（workspace importer）登録のみ。
- ルート `package.json` +1 行（scripts 追加のみ）。

---

## 6. §3.4 改訂の忠実性

`apps/authoring-host/src/perception/texture-resolution.ts` を精読:

- **declared 経路**（rung 1, L179-205）: `assertExactByteLength`（L364-378）で `byteLength === width*height*4` 厳密検証、不一致で `byteLengthMismatch` reject。
- **derived-verified 経路**（rung 2, L207-262）: 候補は `deriveDimensionCandidates`（L277-304）で参照 drawable の **rest mesh bounds（整数・正のみ）** から導出。`candidate.width*candidate.height*4 === bytes.byteLength` 厳密一致した候補のみ採用（L227）。一致ゼロ → `byteLengthMismatch` reject、複数一致 → ambiguous `missingDimensions` reject。
- **無検証採用経路は存在しない**: 候補が定まらない/検証不成立は全て決定論的 reject。editor 式 bounds 推定 fallback なし。
- **源種別記録**: `resolveTextureDimensionSources`（L100-117）が `declared` / `derived-verified` を返し、サイドカー `textureDimensionSources[]` に記録。

§3.4 の「byteLength 厳密一致時のみ採用」「無検証採用禁止」「源種別記録」を全て満たす。ref e2e が 126/126 全件 derived-verified を `toHaveLength(126)` で vacuous-pass 排除して実証。

---

## 7. 決定論

- **renderView**: ref-e2e.test.ts L221-230 が「別ディレクトリへ同一リクエスト再 render → `rerunBytes.equals(firstBytes)`」でバイト同一を構造的に検証。
- **測量**: L286-296 が「同一リクエスト 2 回 → `secondResult.results.toEqual(result.results)`」で数値同一を検証。
- **サイドカー**: `render-view-sidecar.ts` はタイムスタンプ非含有（報告書記載、決定論の設計根拠）。
- **ref-render-gate 成果物**: git status 上 ref-render-gate/ は untracked（初回生成）。既に生成済みの gate PNG に対し e2e 再実行後も M が出ない（本レビューの authoring-host 再実行 51/51 pass 後、`git status` に ref-render-gate/ の M 変化なし = 決定論の実地証拠）。

2 回実行バイト/数値一致の実テストが存在し、決定論は構造的に検証されている。

---

## 8. 測量の非オウム返し

`measurement-command.test.ts` を精読:

- drawable bounds/vertices は shared perception snapshot と `.toEqual` 照合（L100-103）= command が独立に再計算せず同一評価値を報告することの確認（ハードコード期待値ではない）。
- warp rest points は「domain rect の四隅が rest node 集合に含まれる」独立幾何条件で検証（L162-169）+ snapshot 直公開値と照合（L176）。
- 非 rest 回帰（L179-215）: `driven[i] = rest[i] + WARP_KEYFORM_OFFSET{5,-3}` の独立計算で検証。フィクスチャ keyform の定数を期待側に据え、command 内部計算をオウム返ししていない。加えて `drivenPoints !== restPoints` を assert（恒等退行の防止）。

数値テストは独立計算/既知座標に基づき、オウム返しではない。

---

## 9. runtime-core export 追加の非破壊性（§8 conditional）

`git diff HEAD -- packages/runtime-core/src/rig-control-evaluation.ts` を精読:

- `EvaluatedRigControlSchema` に optional `evaluatedControlPoints`（warp のみ）を additive 追加。既存フィールド（worldMatrix/localState/bounds 等）は無変更。
- 新規計算は純関数 `computeEvaluatedWarpControlPoints`（rest + offset の要素和、長さ不一致で undefined を返す防御的実装）。評価挙動の変更ゼロ。
- runtime-core は分類2 の既知先行 2 failed のみ（本レビューでは runtime-core 全体は再実行せず、Orch-Sylph 実測 126pass+2既知fail + clean HEAD stash 二重確認の報告に依拠。additive optional export ゆえ論理的に既存 failing test と独立）。

計画 §8 conditional（狭い export 追加のみ）を忠実に遵守。

---

## 10. 分類 1-5 の適用妥当性（独立判断）

1. **cmo3 finding（既知偽陽性）**: `node scripts/check-dependencies.mjs` を実行 → finding は cmo3（pnpm-lock forbidden dependency class）1 件のみ。lockfile diff に cmo3 を含む行なし（新規 finding ゼロ）。**適用妥当**。
2. **test:unit 18 failed / runtime-core 2 failed（先行既知）**: Wave104 の runtime-core 変更は §9 の additive optional export のみで論理的に独立。本レビューでは runtime-core 全体は再実行していないが、変更の性質（additive）から分類は妥当と判断。**適用妥当**（下記 Q1 参照）。
3. **pnpm-lock +12 行 = workspace importer のみ**: §5 で外部 resolution 行ゼロを独立確認。**適用妥当**。
4. **package.json = scripts 追加のみ**: +1 行を確認。**適用妥当**。
5. **discussion/model-authoring/** / .claude/skills/** = L0 運用文書**: wave スコープ外・非ブロッキング。**適用妥当**。

---

## 11. 必須チェック（§9）の実地確認結果

| チェック | 結果 |
|---|---|
| authoring-host focused（`npx vitest run --root apps/authoring-host`） | **12 files / 51 passed**（実測、ref e2e 含む） |
| ai-interface focused（`npx vitest run packages/ai-interface`） | **17 files / 107 passed**（実測） |
| `npx tsc --noEmit`（root） | **exit 0**（実測） |
| `npx tsc --noEmit -p apps/authoring-host/tsconfig.json`（§9 昇格） | **exit 0**（実測） |
| `node scripts/check-source-organization.mjs` | **pass**（実測） |
| `node scripts/check-dependencies.mjs` | cmo3 偽陽性のみ、Wave104 新規 finding ゼロ（実測） |
| `git diff --check HEAD` | **clean**（whitespace エラーなし、実測） |
| render-software focused / runtime-core focused | 本レビューでは再実行せず（Orch-Sylph 実測 37 / 126pass+2既知fail に依拠。render-software は forbidden-scope diff 空 + B-1 テスト追加のみ、runtime-core は §9 additive のみで裏取り済み） |

---

## 12. Blocking findings

**なし。**

---

## 13. Non-blocking findings / 残リスク・申し送り

いずれも判定非影響。多くは Domain A-C 報告書で既出、独立確認で妥当と判断:

1. **ユーザー目視 gate 未実施（wave 外, §3.5）**: `discussion/model-authoring/experiments/ref-render-gate/` の PNG 3 枚（rest-full / face-focus / eyes-viewport）は生成済みだが、描画正しさの人間判定は wave の技術 gate と独立。wave 完了後にユーザーへ目視承認を依頼する必要がある（Domain C §6-4 の申し送りを継承）。
2. **サイドカー絶対パス（C-DEV-N-01）**: `render-view-sidecar.ts` が `packagePath` / `pngPath` にマシン絶対パスを記録。PNG バイト決定論（§3.2）には非抵触だが、別マシン再生成でサイドカー JSON は変わる。ref-render-gate/ 成果物のマシン間ポータビリティに関わる記録事項。
3. **ref validatePackage strict = error 97 件（C-NB-1）**: 実運用モデルと validator の乖離データ。fail 条件外（§3.5）。内訳分類（validator 偽陽性か ref 実欠陥か）は将来の model-authoring トピック。
4. **derived-verified の整数 mesh bounds 前提（C-NB-2）**: 非整数 mesh bounds のモデルは `missingDimensions` reject で顕在化（黙って推定しない正しい挙動、§3.4 不変量保存）。将来モデルで reject が頻発する場合は梯子拡張の再検討余地。
5. **Domain A non-blocking 6 件（sweep 二重計算 / not_implemented プレースホルダ / スキーマ命名 / margin 式構造同一 / sweep テスト steps=4 単一 等）**: いずれも将来の堅牢化候補で判定非影響。
6. **プロセス所見（Domain B §5）**: Gnome が workspace 依存追加で install 必要時に escalate せず代替配線で凌ぎ、blocking 2 件と再検証コストが発生。今後の Gnome 委任文で「依存追加で install 必要時は代替配線せず escalate」を明示すると再発防止（wave 成果物への影響なし）。

---

## 14. 質問（Orch-Sylph へ）

- **Q1（分類2 の裏取り粒度）**: 本レビューでは runtime-core / render-software / ref-render-gate の決定論再現を含む重い全再実行は行わず、authoring-host（51、ref e2e 含む）と ai-interface（107）の focused 再実行 + 全 diff 精読で裏取りした。runtime-core の「先行既知 2 failed が clean HEAD 起因」は Orch-Sylph の stash 二重確認報告に依拠している。additive optional export の性質から論理的に独立と判断し pass としたが、最終統合報告書で runtime-core 2 failed の clean HEAD 起因を明記しておくことを推奨（監査証跡として）。この判断粒度で問題なければ verdict 確定。

---

## 15. Verdict 確定

Wave104 は技術 gate（Domain D）として **pass**。blocking finding ゼロ。§9-§11 の各項目を独立に裏取りし、報告書・レビューの主張と実体が一致。分類 1-5 の適用も妥当。残るのは wave 外のユーザー目視 gate と非ブロッキング申し送りのみ。
