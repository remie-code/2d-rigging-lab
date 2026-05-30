# Wave 15 Plan: Editor Drawable / Mesh Authoring Vertical Slice

> Wave 15 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 15
- Wave name: `editor-drawable-mesh-authoring-vertical-slice`
- Primary objective: Wave 14 の embedded preview を、GUI から作成した最小 drawable / mesh に接続し、ユーザーが editor 上で可視要素を増やして preview / persistence / evidence で確認できる状態にする。

## 2. Wave 15 の主目的

Wave 14 で editor は runtime snapshot 由来の embedded preview、preview slider、desktop/mobile smoke を持った。一方で、ユーザーが GUI 操作で新しい visible drawable / mesh を作り、preview 上で確認する authoring workflow はまだない。

Wave 15 はこの穴を埋める。PSD import、texture pipeline、canvas direct editing、full mesh editor へ広げず、権利クリーンな generated fixture/preset drawable を作る最小 vertical slice に限定する。

この wave の pass 後、ユーザーは browser editor 上で次を行える。

- generated shape drawable を作成する。
- deterministic mesh を生成または初期化する。
- operation log / package file set / generated evidence に残す。
- embedded preview で追加 drawable を確認する。
- save/load 後も作成済み drawable / mesh が維持されることを e2e で確認する。

## 3. Undine コンテキスト保護の復元規約

Wave 15 でも、Undine が詳細実装コンテキストを直接抱え込まないことを明示的な制約にする。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は原則として Gnome / Review-Sylph を直接起動しない。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Undine は各 domain の詳細ソースを大量に読まず、Orch-Sylph の completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- この節は context compaction 後に orchestration skill の内容が薄れた場合の復元規約であり、Wave 15 起動時に必読とする。

## 4. Repository Facts

- Wave 14 は `Completed / implementation-proven`。editor embedded preview は runtime projection 由来の SVG visual / summary / slider を持つ。
- `packages/operation-core/src/operation-type.ts` と `operation-payload.ts` には `createDrawable`、`generateMesh`、`moveMeshVertex` の operation type / payload schema が既に存在する。
- `packages/operation-core/src/operation-registry.ts` の registered handlers は現状 `createParameter`、`addKeyform`、`addKeyformGrid2d` のみで、`createDrawable` / `generateMesh` は未登録。
- `packages/operation-core/src/payloads/model-edit.ts` の `CreateDrawablePayloadSchema` は `sourceAssetId`、`sourceLayerId`、`textureId`、`partId`、`displayName`、`initialBounds` を持つ。
- `GenerateMeshPayloadSchema` は `drawableId`、`method`、`densityHint` を持つ。
- `packages/authoring-core/src/authoring-graph.ts` は `drawables`、`meshes`、`drawOrder`、`stableOrder` を保持し、`package-document-model-files.ts` は session graph から package document へそれらを書き戻す。
- `packages/authoring-core/src/runtime-graph-drawables.ts` は drawable が参照する mesh が存在しない場合に error を投げる。したがって create/generate workflow は runtime-safe な中間状態を維持する必要がある。
- `apps/editor/src/editor-session/session-adapter.ts` には generic `commitOperation` があるが、UI convenience command は `commitCreateParameter` だけである。
- `apps/editor/src/app/editor-app.ts` と `ui/app-shell/app-shell.ts` は Wave 14 時点で preview callback を持つが、drawable / mesh authoring UI はない。

## 5. Design Decisions

- Wave 15 は `createDrawable` / `generateMesh` の最小 product workflow を扱う。
- `moveMeshVertex`、direct canvas manipulation、freeform mesh editing は future scope とし、この wave では扱わない。
- 作成対象は generated rights-clean fixture/preset shape とする。外部画像、PSD、PNG、Cubism asset を取り込まない。
- `createDrawable` / `generateMesh` は operation log と model diff / runtime evidence / validation evidence に乗る通常 operation として扱う。
- Runtime graph 変換が壊れないよう、create/generate の各 committed state は runtime-safe にする。もし payload contract 上それが自然に表現できない場合、Domain A は early escape する。
- Editor UI は「Create Drawable」系の最小 form / preset selector / result display に限定する。巨大な mesh editor や drawing tool は作らない。
- Public `index.ts` は barrel-only を維持し、実装本体を catch-all file に寄せない。

## 6. Non-Goals

- PSD import / split PNG import は扱わない。
- Texture pipeline / renderer adapter / full private viewer は扱わない。
- Canvas direct manipulation、vertex drag、freeform mesh editor は扱わない。
- `moveMeshVertex` operation の UI / handler は扱わない。
- Mask / clipping、rigControl、dynamics authoring UI は扱わない。
- Standalone viewer app は作らない。
- 外部 HTTP / WebSocket / MCP transport は扱わない。
- LLM provider integration は扱わない。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading は扱わない。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave15-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave14/wave14-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures
- 必要に応じて Wave 14 の completion / review / integration report

Undine はすべての設計規約・実装規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Wave 15 は operation/authoring foundation を最初に固め、その後に package/runtime evidence と editor workflow を並列化し、最後に UI / e2e / integration を直列 gate にする。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. drawable / mesh operation foundation | Solo | Wave 14 complete | `createDrawable` / `generateMesh` handler と authoring mutation を作る |
| 2 | B. created drawable runtime / evidence regression | Parallel with C | A | created drawable / mesh が runtime snapshot / validation / evidence で観測できることを固める |
| 2 | C. editor drawable authoring workflow state | Parallel with B | A | editor session / workflow に create drawable preset command と view model を追加する |
| 3 | D. editor drawable authoring UI | Solo | B + C | GUI form / drawable list / operation status / preview wiring を追加する |
| 4 | E. drawable authoring e2e and persistence smoke | Solo | D | desktop/mobile e2e、save/load persistence、basic a11y を検証する |
| 5 | F. integration review and final report | Solo | E | clean integration review、修正反映、final report を完了する |

Batch 2 だけを並列化する。Domain B は packages / fixtures / evidence 側、Domain C は apps/editor workflow 側に所有範囲を分け、同一ファイルの同時編集を避ける。

## 9. Domain Assignments

### A. `wave15-drawable-mesh-operation-foundation`

Purpose:

- `createDrawable` と `generateMesh` の operation handlers を実装し、operation registry に登録する。
- Authoring graph に drawable / mesh / drawOrder / stableOrder を追加・更新する mutation helper を作る。
- Generated preset drawable が runtime-safe な graph state を保つよう、mesh id / drawable id / provenance id / draw order を deterministic に扱う。

Write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/operations/create-drawable*.ts`
- `packages/operation-core/src/operations/generate-mesh*.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-ids.ts`
- focused authoring / operation tests
- discussion completion / review reports

Pass evidence:

- `createDrawable` dry-run / commit が deterministic id、model diff、precondition diagnostics を返す。
- `generateMesh` dry-run / commit が deterministic vertices / uvs / triangles / bounds を作る。
- duplicate drawable、missing part、missing source asset、missing drawable などの precondition が regression で確認される。
- create/generate 後の graph は runtime drawable conversion で missing mesh error を起こさない。
- `index.ts` は barrel-only のまま。

Early escape:

- `CreateDrawablePayloadSchema` / `GenerateMeshPayloadSchema` だけでは runtime-safe な committed state を表現できない。
- generated fixture/provenance の扱いに product decision が必要になる。
- operation handler 実装が import-source / texture pipeline の本格設計を要求する。

### B. `wave15-created-drawable-runtime-evidence-regression`

Purpose:

- Domain A の create/generate operation 結果が runtime snapshot、runtime diff、validation report、operation evidence 上で観測できることを固める。
- Created drawable / mesh の compact regression fixture を作る。

Write scope:

- `packages/operation-core/src/*evidence*.test.ts`
- `packages/runtime-core/src/**` は test-discovered bug fix の最小差分のみ可
- `packages/validator-core/src/**` は test-discovered bug fix の最小差分のみ可
- `fixtures/contracts/**` の compact fixture
- discussion completion / review reports

Pass evidence:

- create/generate 後の runtime snapshot に新しい drawable が含まれる。
- runtime diff が drawable / drawList change を dedicated fields で示す。
- validation evidence が created drawable / mesh を落とさない。
- fixture が過大にならず、future wave の oracle として読める。

Early escape:

- created drawable の runtime evidence が operation evidence pipeline に乗らず、shared contract redesign が必要になる。
- validator が generated fixture drawable を表現できず、policy decision が必要になる。

### C. `wave15-editor-drawable-authoring-workflow-state`

Purpose:

- Editor session / workflow に generated drawable preset 作成 command を追加する。
- UI が使う view model に drawable list、pending create drawable draft、command enabled state、last result summary を追加する。
- Create drawable workflow が operation log / package file set / preview state と矛盾しないようにする。

Write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- focused editor session / workflow / view model tests
- discussion completion / review reports

Pass evidence:

- Editor session から create drawable / generate mesh の commit sequence が実行できる。
- Operation log と package file set に create/generate operations が残る。
- Save/load 後に created drawable / mesh が package document から復元される。
- Preview state は created drawable を壊さず、既存 parameter preview と共存する。
- UI なしの focused tests がある。

Early escape:

- GUI convenience command が複数 operation commit を扱うために workflow architecture の大幅 redesign を要求する。
- createDrawable と generateMesh を1操作に統合すべきか user decision が必要になる。

### D. `wave15-editor-drawable-authoring-ui`

Purpose:

- Editor shell に generated drawable / mesh authoring の最小 UI を追加する。
- User が display name / shape preset / bounds を入力し、create drawable workflow を実行できるようにする。
- Created drawable list と operation result を表示し、embedded preview と自然に接続する。

Write scope:

- `apps/editor/src/ui/drawable-authoring/**`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/**`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- focused UI tests
- discussion completion / review reports

Pass evidence:

- Create Drawable form が表示され、valid command を callback へ渡す。
- Created drawable list に既存 sample drawable と新規 drawable が表示される。
- Operation status / evidence panel と矛盾しない。
- Preview panel と同一画面で破綻しない layout になっている。
- Text overflow / incoherent overlap / nested card layout を増やさない。

Early escape:

- Existing editor shell layout が大幅 redesign なしに authoring panel を収められない。
- UI 実装が full mesh editor や canvas direct manipulation を要求する。

### E. `wave15-drawable-authoring-e2e-and-persistence-smoke`

Purpose:

- Browser-level smoke で generated drawable authoring workflow を固定する。
- Desktop / mobile viewport で create drawable、preview update、save/load persistence、basic a11y を検証する。

Write scope:

- `scripts/**editor*e2e*.mjs`
- `apps/editor/e2e/**`
- `apps/editor/src/**/*.test.ts` の preview/UI focused tests は必要最小限のみ
- narrow test id / aria tweaks in UI files only if needed for a11y smoke
- discussion completion / review reports

Pass evidence:

- `pnpm test:e2e` または既存 editor e2e command で create drawable workflow が走る。
- Slider preview 既存 smoke と create drawable smoke が共存する。
- Created drawable が preview summary / visual / drawable list のいずれかで deterministic に観測できる。
- Save/load 後も created drawable が残る。
- Desktop / mobile の両方で basic layout と accessible names を確認する。

Early escape:

- Current e2e harness が multi-operation create flow を安定検証できない。
- Browser automation / screenshot verification が sandbox 制約で実行できない。

### F. `wave15-integration-review-and-final-report`

Purpose:

- Domain A-E の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 15 final report と maps を更新する。

Write scope:

- `discussion/implementation/waves/wave15/**`
- `discussion/implementation/reviews/wave15/**`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- integration review が Product Workflow、Runtime Truthfulness、Source Organization、Test Adequacy、Persistence、A11y smoke を含む。
- final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 15 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 15 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C の Orch-Sylph を並列投入する。
3. Domain B / C がどちらも `pass` したら、Undine は Domain D を Orch-Sylph に委譲する。
4. Domain D が `pass` したら、Undine は Domain E を Orch-Sylph に委譲する。
5. Domain E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は domain 内で Gnome 実装と Review-Sylph レビューを分離し、needs_fix loop を自分の domain 内で閉じる。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

Orch-Sylph への domain assignment には必ず次を含める。

- target / wave / dependency
- allowed write scope
- forbidden write scope
- basis docs
- required tests
- review lanes
- completion report path
- early escape condition
- `discussion/development_convention/source-file-organization-policy.md`

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Product Workflow: GUI から created drawable / mesh を作り、preview / persistence で確認できるか。
- Runtime Truthfulness: preview と evidence が runtime snapshot / diff 由来であり、UI fake semantics ではないか。
- Operation Integrity: dry-run / commit / operation log / model diff / precondition diagnostics が coherent か。
- Persistence: package file set / save-load / generated artifacts が created drawable を失わないか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / workflow / UI / e2e が domain risk に見合うか。
- Determinism: generated ids、mesh vertices、draw order、preview summary、e2e assertions が deterministic か。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: authoring-core / operation-core focused tests、typecheck
- Domain B: operation evidence / runtime evidence / fixture focused tests
- Domain C: editor session / workflow / view model focused tests、editor typecheck
- Domain D: drawable authoring UI focused tests、editor typecheck
- Domain E: editor e2e smoke、a11y smoke
- Domain F: `pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- .`
- untracked file whitespace check if new fixtures/reports are untracked

Frontend 変更を含むため、可能なら final integration で local editor を起動し、desktop/mobile viewport の created drawable preview screenshot または browser smoke metadata を記録する。

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- `createDrawable` と `generateMesh` の分離では runtime-safe committed state を維持できない。
- Generated drawable の source asset / provenance / rights record の扱いに product decision が必要になる。
- Operation payload contract の変更または schema versioning が必要になる。
- Full renderer / texture pipeline がないと visible drawable authoring として成立しない。
- Existing editor shell の大幅 redesign が必要になる。
- E2E / browser verification が現在の sandbox で安定実行できない。

## 14. Pass Criteria

Wave 15 は次を満たしたとき pass とする。

- `createDrawable` / `generateMesh` operation handlers が dry-run / commit / precondition diagnostics / model diff を持つ。
- GUI から generated drawable / mesh を作成できる。
- Created drawable / mesh が embedded preview に表示または summary として deterministically 観測できる。
- Operation log、package file set、save/load persistence、runtime / validation evidence が created drawable を失わない。
- Desktop / mobile e2e smoke で create drawable workflow と preview update が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
