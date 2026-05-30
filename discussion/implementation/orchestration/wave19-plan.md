# Wave 19 Plan: Texture-Backed Preview And Part Mapping Foundation

> Wave 19 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 19
- Wave name: `texture-backed-preview-and-part-mapping-foundation`
- Primary objective: Wave 18 の metadata-backed split PNG source intake を、最小の texture-backed preview と source layer -> drawable part / texture mapping へ進める。

## 2. 次Wave選定

Wave 18 で、split PNG fallback の source asset / layer metadata / rights / provenance は GUI から登録できるようになった。ただし、現状は metadata-only であり、actual bitmap rendering はしていない。

次に必要なのは、MVP 中心問いである `rights-clean layered character art -> editor -> runtime preview` の視覚的な証拠である。

Wave 19 は、実素材 pipeline を一気に完成させるのではなく、次の最小 slice に限定する。

- split PNG source layer に texture preview reference を持たせる。
- texture atlas / preview asset metadata を package file set / browser-local save-load で保持する。
- imported source layer から createDrawable へ進む際に、partId と textureId が明示的に決まる。
- runtime/editor preview DTO に texture reference を通し、editor preview が texture-backed drawable を実際に視覚化する。
- PNG decode / OS file picker / archive binary IO / full atlas packer は扱わない。

この wave の狙いは「画像処理エンジン完成」ではない。画像由来 source layer が editor 内で単なる文字列ではなく、texture reference と preview に接続された drawable として扱えることを証明する。

## 3. Undine コンテキスト保護の復元規約

Wave 19 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source実装は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Orch-Sylph 自身が直接書いてよいのは orchestration report / completion report / review request などの `discussion/implementation/**` のみである。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- Undine は completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 18 は `Completed / implementation-proven`。
- `packages/package-format/src/texture-atlas.ts` は optional `texture-atlas-v1` を持つが、texture bytes / preview payload はまだ package document の一級 asset ではない。
- `packages/package-format/src/package-file-set.ts` は現在 text file entries を serialize / parse する。binary archive IO はない。
- `packages/package-format/src/model-files.ts` の `DrawableSchema` は `partId` と `textureId` を既に持つ。
- `packages/package-format/src/model-files.ts` の `MeshSchema` は `uvs` を既に持つ。
- `packages/runtime-core/src/normalized-runtime-graph.ts` / `snapshot.ts` の evaluated drawable は textureId / source refs / uvs を preview へ渡していない。
- `apps/editor/src/ui/preview-panel/preview-visual.ts` は現状 SVG polygon / rect の solid fill preview であり、texture-backed rendering はしていない。
- `createDrawable` payload は optional `textureId` を受け取れる。
- Source intake UI は source asset / layer metadata / rights / provenance / default part を扱うが、layer texture preview と per-layer part mapping はまだ製品 workflow として固まっていない。

## 5. Design Decisions

- Wave 19 は texture-backed preview foundation に限定する。
- Texture preview payload は browser/editor で扱える安全な package-local reference または deterministic data URL / generated artifact として扱う。外部 URL や権利不明素材を要求しない。
- Preview rendering は bounds-fit / SVG pattern level の最小投影でよい。UV editor、triangulated mesh texture renderer、WebGL renderer は扱わない。
- Source layer -> drawable part mapping は、まず createDrawable workflow の明示 part selection と textureId selection として実装する。full part tree editor は扱わない。
- Texture atlas entry / preview asset / provenance / rights の関係は validator と operation evidence で観測可能にする。
- Existing generated drawable、layer controls、mesh vertex nudge、source intake、save/load smoke を壊さない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- PSD binary parser、PSD layer extraction、PSD feature compatibility。
- OS filesystem picker、package archive import/export、binary ZIP writer。
- PNG decoder implementation、image processing library integration、full texture atlas packing。
- UV editing、triangulated texture sampling、WebGL/canvas renderer rewrite。
- Full part tree editor、drag-and-drop layer tree、mask/clipping、opacity editor。
- Rig control、dynamics、standalone viewer、demo capture。
- LLM provider integration、external HTTP / WebSocket / MCP transport。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Wave 19 は、shared contract / package shape があるため最初の batch は慎重に分ける。ただし、editor draft UI と runtime preview DTO は package foundation と並列に進められる。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. texture asset package / authoring foundation | Parallel with B/C | Wave 18 complete | texture atlas / preview asset metadata と package file set / authoring asset projectionを固める |
| 1 | B. runtime / editor preview texture projection | Parallel with A/C | Wave 18 complete | runtime snapshot / editor preview DTO に texture refs と preview projection情報を通す |
| 1 | C. editor source layer part / texture draft UI | Parallel with A/B | Wave 18 complete | source layerごとの texture preview input と part / texture選択状態をUI/stateに追加する |
| 2 | D. source import / createDrawable texture materialization workflow | Parallel with E | A + C | importSplitPngSourceAsset / createDrawable workflow が source layer textureId / partId を保持する |
| 2 | E. texture / provenance validator and evidence oracle | Parallel with D | A + B | texture atlas / preview asset / source provenance / missing texture のvalidatorとfixture evidenceを固める |
| 3 | F. editor texture-backed preview visual integration | Solo | B + D | SVG preview が texture-backed drawable を表示し、fallback時は偽装せず診断を出す |
| 4 | G. texture preview e2e / persistence smoke | Solo | E + F | GUIでsource intake -> texture-backed drawable -> save/load をdesktop/mobileで検証する |
| 5 | H. integration review and final report | Solo | G | clean integration review、map更新、final report を完了する |

安全上の制約:

- Batch 1A/B/C は write scope を必ず分ける。
- Domain D と E は operation/editor workflow と validator/fixture に分ける。
- Preview visual と E2E は直列にする。
- texture payload の保存方式が package format の大きな再設計を要求する場合は `escalate` する。
- Runtime / preview DTO 変更が external transport や viewer app redesign を要求する場合は `escalate` する。

## 9. Domain Assignments

### A. `wave19-texture-asset-package-authoring-foundation`

Purpose:

- Texture atlas entry と preview asset metadata の保存単位を固める。
- Package document / file set / browser-local save-load で texture preview reference を失わないようにする。
- Authoring session から package assets へ source layer derived texture metadata を反映できる helper を追加する。

Write scope:

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-document.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/authoring-core/src/package-document-assets.ts`
- 必要な named source files under `packages/authoring-core/src/**`
- focused package-format / authoring-core tests
- discussion completion / review reports

Forbidden:

- `apps/editor/**`
- `packages/runtime-core/**`
- `packages/operation-core/**` except test-discovered type alignment only after escalation
- `index.ts` implementation logic

Pass evidence:

- Texture atlas / preview asset metadata が package document schema で parse / roundtrip できる。
- Package file set serialize / parse が texture reference を保持する。
- Source asset / layer / provenance / rights と texture reference の紐付けが失われない。
- `index.ts` は re-export だけ、または最小 entrypoint wiring に留まる。

Early escape:

- Binary asset IO を package format に入れないと pass できない。
- Existing package file set が text-only であることと要求が衝突する。
- Texture preview payload の安全な保存単位を user decision なしに決められない。

### B. `wave19-runtime-editor-preview-texture-projection`

Purpose:

- Runtime snapshot / editor preview projection に textureId、sourceAssetId、sourceLayerId、UVまたはbounds-fit projection hint を通す。
- Textureが未解決のときに preview が solid fill を texture rendering と誤認しない DTO を用意する。

Write scope:

- `packages/runtime-core/src/**`
- `apps/editor/src/editor-preview/**`
- focused runtime / editor-preview tests
- discussion completion / review reports

Forbidden:

- `apps/editor/src/ui/**`
- `packages/package-format/**` except type-import alignment after Domain A completion
- `packages/operation-core/**`
- `index.ts` implementation logic

Pass evidence:

- Evaluated drawable / editor preview drawable が texture reference を持てる。
- Existing generated drawable preview は後方互換で動く。
- Texture missing / not materialized state が DTO 上で明示される。
- Runtime snapshot full detail で mesh vertices と texture projection information が整合する。

Early escape:

- Runtime core が package texture atlas を直接読む必要が出る。
- Full renderer / WebGL / actual image decode が必要になる。
- DTO変更が AI / external transport redesign を要求する。

### C. `wave19-editor-source-layer-part-texture-draft-ui`

Purpose:

- Source intake draft UI / state に layer texture preview reference と layer-to-part selection を追加する。
- ここでは operation commit までは行わず、ユーザー入力と view model の意味を固める。

Write scope:

- `apps/editor/src/editor-state/source-intake-*.ts`
- `apps/editor/src/ui/source-assets/**`
- `apps/editor/src/editor-test-ids.ts`
- `apps/editor/src/styles/**`
- focused state / UI tests
- discussion completion / review reports

Forbidden:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `packages/**`
- E2E files

Pass evidence:

- Source layerごとに texture preview reference / textureId / target part を入力または確認できる。
- Draft view model が invalid texture reference / missing part を表示できる。
- Operation payload を UI が直接 commit しない。
- Existing source intake / drawable authoring UI の layout と accessible name を壊さない。

Early escape:

- Per-layer part mapping が full part tree editor を要求する。
- Source intake panel が広範な app shell redesign を要求する。
- Data URL / generated artifact policy が未決で UI項目を決められない。

### D. `wave19-source-import-create-drawable-texture-workflow`

Purpose:

- `importSplitPngSourceAsset` と createDrawable workflow が source layer texture reference と target part を保持する。
- Imported source layer 選択時に、既存 createDrawable form へ textureId / partId を安全に引き継ぐ。
- Operation result / operation log / package file set に texture materialization evidence を残す。

Write scope:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset*.ts`
- `packages/operation-core/src/operations/create-drawable*.ts`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- Domain C 接続に必要な `apps/editor/src/editor-state/**` の最小差分
- focused operation / workflow tests
- discussion completion / review reports

Forbidden:

- Preview visual rendering
- Validator oracle implementation
- Broad source intake UI redesign
- `index.ts` implementation logic

Pass evidence:

- Source import commit 後に texture atlas / preview asset metadata が package assets に残る。
- Imported source layer から createDrawable へ進むと textureId と partId が明示される。
- Missing texture preview は commit失敗または structured diagnostic として扱われる。
- Browser-local save/load 後も source layer / textureId / partId relation が復元される。

Early escape:

- `importSplitPngSourceAsset` payload 拡張が operation contract の大幅再設計を要求する。
- Texture materialization を import時に行うか後続 operation に分けるかで安全な判断ができない。
- Existing createDrawable semantics と textureId自動補完が衝突する。

### E. `wave19-texture-provenance-validator-evidence`

Purpose:

- texture atlas / preview asset / source provenance / drawable texture reference の validator oracle を固める。
- Compact fixture で valid texture-backed source、missing texture payload、source-layer mismatch、rights/provenance mismatch を確認する。

Write scope:

- `packages/validator-core/src/**`
- `fixtures/contracts/**`
- `packages/operation-core/src/*evidence*.test.ts` の focused evidence regression
- `packages/package-format/src/**` は test-discovered schema bug fix の最小差分のみ可
- discussion completion / review reports

Forbidden:

- Editor UI implementation
- Operation handler broad redesign
- Runtime renderer implementation
- `index.ts` implementation logic

Pass evidence:

- Valid texture-backed source package は validation pass できる。
- Visible drawable の missing texture preview / missing atlas entry は structured diagnostic になる。
- Texture provenance / source layer mismatch が AI-readable validation report で観測できる。
- Wave 18 の metadata-only missing texture diagnostics と矛盾しない。

Early escape:

- Missing texture severity を product policy として user decision なしに決められない。
- Existing validator contract と package schema が矛盾する。
- Fixtureが実素材binaryを必要とする。

### F. `wave19-editor-texture-backed-preview-visual`

Purpose:

- Editor preview visual が texture-backed drawable を表示できるようにする。
- Textureが未解決のときは solid fill fallback を使ってもよいが、summary / diagnostic で texture rendering 済みと誤認させない。

Write scope:

- `apps/editor/src/ui/preview-panel/**`
- `apps/editor/src/editor-preview/**` の Domain B 接続に必要な最小差分
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/src/styles/**`
- focused preview UI tests
- discussion completion / review reports

Forbidden:

- Package schema redesign
- Operation handler implementation
- OS file picker / PNG decoder
- `index.ts` implementation logic

Pass evidence:

- Texture preview reference がある drawable は SVG preview 上で image / pattern として表示される。
- Polygon / rect preview の既存 geometry semantics を保つ。
- Texture unresolved fallback が accessible summary と diagnostic で分かる。
- Generated drawable、layer controls、mesh vertex nudge の preview smoke が壊れない。

Early escape:

- SVG pattern では現在の geometry / bounds-fit preview が安全に表現できない。
- Texture preview data が browser security policy / CSP 的に扱えない。
- Canvas/WebGL renderer rewrite が必要になる。

### G. `wave19-texture-preview-e2e-and-persistence-smoke`

Purpose:

- Browser-level smoke で source intake -> texture-backed drawable -> generate mesh -> preview -> save/load を固定する。
- Desktop / mobile viewport と basic a11y を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `fixtures/e2e/**`
- narrow test id / aria tweaks in UI files only if needed for smoke
- discussion completion / review reports

Pass evidence:

- Source intake form から texture preview reference 付き split PNG layer を登録できる。
- Imported source layer を使って createDrawable / generateMesh に進める。
- Preview が texture-backed drawable を観測できる。
- Save/load 後も source layer / textureId / partId / preview relation が残る。
- Desktop / mobile の両方で basic layout と accessible names を確認する。

Early escape:

- Current e2e harness が deterministic texture preview reference を安定入力できない。
- Browser storage が texture preview metadata を保存できない。
- Preview rendered 判定が flaky になる。

### H. `wave19-integration-review-and-final-report`

Purpose:

- Domain A-G の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 19 final report、capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave19/**`
- `discussion/implementation/reviews/wave19/**`
- `discussion/implementation/current-capability-map.md`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- Integration review が Texture Asset Integrity、Source Layer Mapping、Preview Truthfulness、Package Persistence、Validator Evidence、UI / Accessibility、Source Organization、Test Adequacy、Orchestration Compliance を含む。
- Final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 19 gate が pass / needs_fix / blocked のいずれかで明確に記録される。
- Final report に各 Orch-Sylph の delegated Gnome / Review-Sylph context id が記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 19 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A / B / C の Orch-Sylph を並列投入し、completion reports を待つ。
2. Domain A / B / C が `pass` したら、Undine は Domain D / E の Orch-Sylph を並列投入する。
3. Domain D / E がどちらも `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
4. Domain F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
5. Domain G が `pass` したら、Undine は Domain H を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は自分でsource実装せず、domain内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

各 Orch-Sylph assignment には、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Texture Asset Integrity: texture atlas / preview asset / package file set / browser-local save-load が coherent か。
- Source Layer Mapping: source layer -> textureId -> partId -> drawable の関係が追跡可能か。
- Preview Truthfulness: texture rendering が実際に行われた場合と fallback の場合を区別しているか。
- Operation Integrity: dry-run / commit / operation log / model diff / precondition diagnostics が coherent か。
- Rights / Provenance: texture preview asset が source asset rights / provenance と矛盾しないか。
- Validator Evidence: missing texture / missing provenance / mismatch が AI-readable diagnostics として観測できるか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / validator / workflow / UI / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: package-format / authoring-core focused tests、typecheck
- Domain B: runtime-core / editor-preview focused tests、typecheck
- Domain C: editor state / source-assets UI focused tests、editor typecheck
- Domain D: operation-core / editor-session / editor-workflow focused tests、typecheck
- Domain E: validator / package-format / evidence focused tests
- Domain F: preview UI focused tests、editor typecheck
- Domain G: editor e2e smoke、a11y smoke
- Domain H: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- <Wave19 scope>`
- untracked file whitespace check if new fixtures/reports are untracked

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Texture preview payload を package file set にどう保存するかで既存設計が矛盾する。
- Text-only package file set では安全に texture preview evidence を保持できない。
- Texture materialization を import時に行うか後続 operation に分けるかで安全な判断ができない。
- Missing texture severity を final product acceptance として決める必要がある。
- SVG preview では texture-backed geometry を truthful に表示できず、renderer rewrite が必要になる。
- Per-layer part mapping が full part tree editor を要求する。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、deterministic texture preview reference / generated artifact に限定するなら、ユーザー判断は不要。real file picker、binary archive、full texture atlas packer、UV editor、standalone viewer を同時に求める場合は別wave判断が必要。

## 14. Pass Criteria

Wave 19 は次を満たしたとき pass とする。

- GUI から texture preview reference 付き split PNG source layer を登録できる。
- 登録結果が package texture atlas / preview asset metadata / provenance / rights / operation log / package file set に残る。
- Imported source layer を使って createDrawable へ進むと、partId と textureId が明示的に決まる。
- Runtime/editor preview DTO が texture reference と unresolved texture state を区別して持てる。
- Editor preview が texture-backed drawable を実際に視覚化し、fallback時はそのことを明示する。
- Save/load 後も source layer / textureId / partId / preview relation が復元される。
- Validator / operation evidence が texture asset / source provenance / missing texture を観測できる。
- Desktop / mobile e2e smoke で texture-backed source workflow が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。

