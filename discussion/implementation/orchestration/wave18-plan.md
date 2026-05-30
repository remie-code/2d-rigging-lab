# Wave 18 Plan: Split PNG Source Asset And Provenance Intake

> Wave 18 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Completed / implementation-proven
- Target wave: Wave 18
- Wave name: `split-png-source-asset-and-provenance-intake`
- Primary objective: generated fixture source だけに依存している editor authoring から一歩進め、split PNG fallback の source asset / layer metadata / rights / provenance を GUI から登録し、既存 createDrawable / generateMesh / preview / persistence / evidence workflow へ接続する。

## 2. 次Wave選定

Wave 17 までで、generated drawable、draw order / visibility、mesh vertex nudge の最小 authoring workflow は implementation-proven になった。

次に必要なのは、MVP中心問いの入口である「権利クリーンな layered character art を editor に取り込む」ことである。ただし、PSD binary parser、real texture atlas renderer、full image decoding pipeline を同時に入れると範囲が大きすぎる。

Wave 18 は `split-png-fallback-v1` に限定し、metadata-backed source asset intake を先に通す。

- split PNG manifest path / layer metadata / placement policy を package source manifest に残す。
- rights / provenance を package asset files と operation evidence に残す。
- imported source layer を既存 createDrawable flow の source として選べるようにする。
- Preview は現行 runtime-projected SVG / generated geometry のままよい。実PNG texture renderingは future scope。

## 3. 並列性を上げる方針

Wave 14-17 は多くの wave で「foundation -> B/C parallel -> UI -> e2e -> integration」だった。Wave 18 では、source intake が複数の独立境界を持つため、Batch 1 から3本、Batch 2 で2本の並列化を許可する。

ただし安全性を優先し、並列化は write scope が明確に分かれる範囲に限定する。

- Batch 1A: operation / authoring mutation。
- Batch 1B: validator / fixture / evidence hardening。
- Batch 1C: editor draft UI / state。operation commit には入らない。
- Batch 2D: editor session / workflow integration。
- Batch 2E: operation evidence / package persistence / runtime preview consistency。

Batch 1C は A の final handler を待たずに draft UI / view model を進められるが、operation payloadの意味論に衝突した場合は needs_fix としてA/Dへ戻す。Integrationで無理やり吸収しない。

## 4. Undine コンテキスト保護の復元規約

Wave 18 でも、Undine は詳細実装コンテキストを直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source実装は Gnome、レビューは別コンテキストの Review-Sylph に必ず分ける。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- Undine は completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 5. Repository Facts

- Wave 17 は `Completed / implementation-proven`。editor は generated drawable / mesh を作成し、layer controls と mesh vertex nudge を操作できる。
- `packages/operation-core/src/operation-type.ts` には `importPsdSourceAsset`、`importSplitPngSourceAsset`、`setRightsMetadata` が存在する。
- `packages/operation-core/src/operation-payload.ts` には import source operations と `setRightsMetadata` payload が存在する。
- `packages/operation-core/src/operation-registry.ts` は Wave 17 時点で create/generate/mesh/keyform/layer operations を登録しているが、source import / rights operations は未登録。
- `packages/package-format/src/source-manifest.ts` は `SourceAssetSchema` / `SourceLayerSchema` / `SourceManifestSchema` を持つ。
- `packages/package-format/src/asset-metadata.ts` は `ProvenanceRecordSchema` / `RightsRecordSchema` を持つ。
- `packages/authoring-core/src/package-document-assets.ts` は authoring session の `sourceAssets`、`provenanceRecords`、`rightsRecords` を package document assets へ反映する。
- `createDrawable` は既に `sourceAssetId` / optional `sourceLayerId` を受け取り、source asset の存在を precondition として見る。

## 6. Design Decisions

- Wave 18 は split PNG fallback intake に限定する。
- PSD parser / layered PSD byte interpretation は扱わない。`importPsdSourceAsset` は未実装または明示unsupportedのままでよい。
- 実PNG bytes の decode / texture atlas rendering / real image preview は扱わない。
- Source asset import は operation lifecycle を通す。UIが package document を直接破壊しない。
- Rights / provenance は source asset 作成時点で `cleared` / `needs_review` / `blocked` を明示し、Validator / AI-readable evidence で観測可能にする。
- Browser editor はまず manifest metadata を入力できればよい。file picker / OS filesystem / archive import は future scope。
- Existing generated drawable workflow、layer controls、mesh nudge、preview slider、save/load smoke を壊さない。
- Public `index.ts` は barrel-only を維持する。

## 7. Non-Goals

- PSD binary parser、PSD layer extraction、PSD feature compatibility は扱わない。
- PNG decode、texture atlas generation、actual texture rendering は扱わない。
- OS filesystem picker、package archive import/export は扱わない。
- Full part tree editor、full layer tree、drag-and-drop layer import mapping は扱わない。
- Mask / clipping、opacity editor、rig control、dynamics、standalone viewer は扱わない。
- LLM provider integration、external HTTP / WebSocket / MCP transport は扱わない。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading は扱わない。

## 8. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全設計規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 9. Dependency / Parallel Design

Wave 18 は、Batch 1 と Batch 2 の並列性を Wave 17 より上げる。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. split PNG import operation foundation | Parallel with B/C | Wave 17 complete | `importSplitPngSourceAsset` / `setRightsMetadata` handler と source asset mutations を作る |
| 1 | B. asset rights / provenance validator evidence | Parallel with A/C | Wave 17 complete | source / rights / provenance / missing texture reference の validator and fixture oracle を固める |
| 1 | C. editor source intake draft UI / state | Parallel with A/B | Wave 17 complete | commit前のmanifest/rights入力UIとdraft view modelを作る |
| 2 | D. editor source import workflow integration | Parallel with E | A + C | editor session / workflow から import operation をcommitし、source asset listへ反映する |
| 2 | E. imported source package / evidence / preview consistency | Parallel with D | A + B | imported source-backed drawable が package file set / operation evidence / preview consistencyで観測できることを固める |
| 3 | F. source intake UI / e2e persistence smoke | Solo | D + E | GUIからsource import -> create drawable -> save/load をdesktop/mobileで検証する |
| 4 | G. integration review and final report | Solo | F | clean integration review、map更新、final report を完了する |

安全上の制約:

- Batch 1A/B/C は write scope を必ず分ける。
- Batch 2D/E は apps/editor workflow と packages/fixture/evidence に分ける。
- UI最終配線とE2Eは直列にする。
- Contract redesign が必要になったら並列継続せず `escalate` する。

## 10. Domain Assignments

### A. `wave18-split-png-import-operation-foundation`

Purpose:

- `importSplitPngSourceAsset` operation handler を実装し、operation registry に登録する。
- split PNG manifest metadata から `SourceAsset` / `SourceLayer` / rights / provenance records を authoring session に追加する mutation helper を作る。
- `setRightsMetadata` handler が未実装なら、source asset rights update に必要な最小 handler を実装する。
- Missing manifest path、invalid import profile、duplicate source asset id、blocked rights、missing rights/provenance、unsupported PSD operation などを deterministic diagnostic にする。

Write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/operations/import-split-png-source-asset*.ts`
- `packages/operation-core/src/operations/set-rights-metadata*.ts`
- `packages/operation-core/src/payloads/import-source.ts` の最小 schema adjustment
- `packages/operation-core/src/operation-registry.ts`
- focused authoring / operation tests
- discussion completion / review reports

Pass evidence:

- `importSplitPngSourceAsset` dry-run / commit が model diff と precondition diagnostics を返す。
- Commit 後に source manifest、provenance、rights records が更新される。
- Duplicate source asset / blocked rights / unsupported PSD が deterministic に扱われる。
- `createDrawable` が imported source asset / layer を参照できる。
- `index.ts` は barrel-only のまま。

Early escape:

- Current operation handler interface では source manifest content を安全に渡せない。
- Rights / provenance を import payload に含めるか `setRightsMetadata` に分けるかで設計判断が必要になる。
- Real file IO / PNG decode が operation foundation に必須になる。

### B. `wave18-asset-rights-provenance-validator-evidence`

Purpose:

- source asset / provenance / rights / drawable texture reference の validator oracle を固める。
- Compact fixture で cleared / needs_review / blocked / missing provenance / missing texture を確認する。

Write scope:

- `packages/validator-core/src/**`
- `packages/package-format/src/**` は test-discovered schema bug fix の最小差分のみ可
- `fixtures/contracts/**` の compact fixture
- focused validator / package-format tests
- discussion completion / review reports

Pass evidence:

- Cleared source asset は validation pass できる。
- Missing provenance / blocked rights は structured diagnostic になる。
- Visible drawable の missing texture reference は MVP上の問題として検出される。
- AI-readable validation report で source asset / rights / provenance を追跡できる。

Early escape:

- Missing texture severity を user decision なしに決められない。
- Existing validator contract と package schema が矛盾する。

### C. `wave18-editor-source-intake-draft-ui-state`

Purpose:

- Editor に split PNG source intake draft state / view model / minimal UI を追加する。
- ここでは operation commit まで行わず、manifest path、layer rows、rights metadata、placement policy を入力・確認できる状態にする。

Write scope:

- `apps/editor/src/editor-state/**` の source intake draft files
- `apps/editor/src/ui/source-assets/**`
- `apps/editor/src/ui/app-shell/app-shell.ts` の表示接続最小差分
- `apps/editor/src/app/editor-app.ts` のdraft callback接続最小差分
- `apps/editor/src/styles/**`
- focused state / UI tests
- discussion completion / review reports

Forbidden:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- packages/**
- E2E files

Pass evidence:

- Split PNG source intake form / panel が表示される。
- Rights / provenance fields と source layer metadata が view model に投影される。
- UIはoperation payloadを直接commitしない。
- Existing drawable / layer / mesh UI layout を壊さない。

Early escape:

- Source intake draft が existing app shell に収まらず broad redesign が必要になる。
- Operation payload meaning が Domain A と衝突し、UI入力項目が確定できない。

### D. `wave18-editor-source-import-workflow-integration`

Purpose:

- Editor session / workflow から `importSplitPngSourceAsset` と必要な rights metadata update を commit できるようにする。
- Imported source asset list を createDrawable form / drawable authoring workflow に接続する。

Write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- Domain C UIとの接続に必要な `apps/editor/src/ui/source-assets/**` の最小修正
- focused editor session / workflow / view model tests
- discussion completion / review reports

Pass evidence:

- Editor session から source import operation を commit できる。
- Operation log と package file set に import / rights evidence が残る。
- Imported source layer を選んで existing createDrawable flow に進める。
- Save/load 後に source manifest / provenance / rights が復元される。

Early escape:

- Browser-local package file set が source asset metadata を保持できない。
- Source import と createDrawable の選択状態が current editor state に安全に統合できない。

### E. `wave18-imported-source-package-evidence-preview-consistency`

Purpose:

- Imported source-backed drawable が package file set、operation result evidence、operation log evidence、runtime preview consistency で観測できることを固める。
- Real PNG rendering は扱わず、source/texture references と current SVG preview semantics の整合を確認する。

Write scope:

- `packages/operation-core/src/*source*evidence*.test.ts`
- `packages/operation-core/src/*drawable*evidence*.test.ts` の最小共通helper利用
- `fixtures/contracts/**` の compact fixture
- `packages/runtime-core/src/**` / `packages/validator-core/src/**` は test-discovered bug fix の最小差分のみ可
- discussion completion / review reports

Pass evidence:

- Import -> createDrawable -> generateMesh の operation result evidence が source asset / layer / provenance を失わない。
- Package file set に source manifest / provenance / rights が materialize される。
- Runtime snapshot / preview summary が imported source-backed drawable と矛盾しない。

Early escape:

- Preview consistency に actual PNG texture rendering が必須になる。
- Operation evidence が import source operation の artifact refs を表現できない。

### F. `wave18-source-intake-e2e-and-persistence-smoke`

Purpose:

- Browser-level smoke で source intake -> create drawable -> generate mesh -> preview -> save/load を固定する。
- Desktop / mobile viewport と basic a11y を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `fixtures/e2e/**`
- narrow test id / aria tweaks in UI files only if needed for smoke
- discussion completion / review reports

Pass evidence:

- Source intake form から split PNG manifest metadata / rights を登録できる。
- Imported source layer を使って createDrawable / generateMesh に進める。
- Save/load 後も source manifest / provenance / rights / drawable relation が残る。
- Existing generated drawable、layer controls、mesh vertex smoke が壊れない。
- Desktop / mobile の両方で basic layout と accessible names を確認する。

Early escape:

- Current e2e harness が source intake metadata を安定入力できない。
- Browser storage が source asset metadata を保存できない。

### G. `wave18-integration-review-and-final-report`

Purpose:

- Domain A-F の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 18 final report、capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave18/**`
- `discussion/implementation/reviews/wave18/**`
- `discussion/implementation/current-capability-map.md`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- Integration review が Source Intake、Rights / Provenance、Operation Integrity、Persistence、Preview Truthfulness、UI / Accessibility、Source Organization、Test Adequacy、Orchestration Compliance を含む。
- Final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 18 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 11. Subagent / Orch-Sylph Execution Policy

Wave 18 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A / B / C の Orch-Sylph を並列投入し、completion reports を待つ。
2. Domain A / B / C が `pass` したら、Undine は Domain D / E の Orch-Sylph を並列投入する。
3. Domain D / E がどちらも `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
4. Domain F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
5. 各 Orch-Sylph は自分でsource実装せず、domain内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
6. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
7. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
8. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
9. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

## 12. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Source Intake: split PNG source asset / layer metadata が package source manifest に入るか。
- Rights / Provenance: source asset rights / provenance が package / validation / evidence で追跡できるか。
- Operation Integrity: dry-run / commit / operation log / model diff / precondition diagnostics が coherent か。
- Persistence: package file set / save-load が source manifest / rights / provenance / drawable relation を失わないか。
- Preview Truthfulness: preview が imported source-backed drawable と矛盾せず、actual PNG renderingを偽装しないか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / validator / workflow / UI / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 13. Verification Plan

Domain ごとの最小 verification:

- Domain A: authoring-core / operation-core focused tests、typecheck
- Domain B: validator / package-format focused tests
- Domain C: editor state / UI focused tests、editor typecheck
- Domain D: editor session / workflow / view model focused tests、editor typecheck
- Domain E: operation evidence / package file set / runtime preview consistency focused tests
- Domain F: editor e2e smoke、a11y smoke
- Domain G: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- <Wave18 scope>`
- untracked file whitespace check if new fixtures/reports are untracked

## 14. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- split PNG manifest content を operation payload / provider / editor draft のどこに置くかで既存設計が矛盾する。
- Rights / provenance を import時に必須化するか、`setRightsMetadata` 後追いにするかで安全な判断ができない。
- Missing texture severity を final product acceptance として決める必要がある。
- Actual PNG rendering / texture atlas generation が Wave 18 pass に必須になる。
- Editor source intake UI が app shell broad redesign を要求する。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、metadata-backed split PNG intake に限定するなら、ユーザー判断は不要。real PNG rendering、PSD parser、OS filesystem/archive import/export を同時に求める場合は別wave判断が必要。

## 15. Pass Criteria

Wave 18 は次を満たしたとき pass とする。

- GUI から split PNG source asset metadata、layer metadata、rights / provenance を登録できる。
- 登録結果が package source manifest、provenance、rights records、operation log、package file set に残る。
- Imported source layer を使って existing createDrawable / generateMesh workflow に進める。
- Save/load 後も source asset / layer / rights / provenance / drawable relation が復元される。
- Validator / operation evidence が source asset / rights / provenance を観測できる。
- Desktop / mobile e2e smoke で source intake workflow が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。

## 16. 残Wave数の所見

Wave 18後にMVPの「制作からviewer確認まで一周」へ到達するには、最短でもあと 7-9 wave 程度は必要と見積もる。

想定候補:

1. Wave 19: real texture / part mapping / preview rendering foundation。
2. Wave 20: mask / clipping minimal workflow。
3. Wave 21: opacity / full layer tree / lock-select authoring hardening。
4. Wave 22: rig control foundation and GUI slice。
5. Wave 23: Minimum Open Dynamics v1 GUI / runtime / validator slice。
6. Wave 24: standalone private viewer surface。
7. Wave 25: project import/export or archive/filesystem durability。
8. Wave 26: AI repair suggestion / diff workflow expansion。
9. Wave 27: demo-safe capture and MVP closure validation。

これは「MVP proof」までの概算であり、商用品質のUI polish、PSD parser completeness、full texture atlas、full canvas mesh editor、advanced rig/dynamics、public distribution は含めていない。各waveでscopeを広げると 10-12 wave 以上になる。
