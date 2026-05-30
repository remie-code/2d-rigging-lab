# Wave 13 Plan: Runtime Diff And Grid2D Evidence Hardening

> Wave 13 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 13
- Wave name: `runtime-diff-and-grid2d-evidence-hardening`
- Primary objective: Wave 12 の runtime keyform evaluation foundation を、runtime diff / Grid2D evidence / diagnostics / AI regression の観測面で固める。

## 2. Wave 13 の主目的

Wave 12 では keyform が runtime snapshot で実際に評価され、`keyformSamples`、mesh/drawable target application、runtime evidence、compact fixture が成立した。一方で、Wave 12 final report は次の残差を明示している。

- runtime diff に drawList / opacity / visibility / draw order 専用 field がない。
- Grid2D compact fixture は未拡張で、unit coverage と coverage note に留まる。
- duplicate key/coordinate、missing parameter、unsupported evaluator、key-range clamp などの diagnostic regression が薄い。
- AI-host `addKeyformGrid2d` runtime-visible evidence は未実装。

Wave 13 はこの残差を一つの hardening wave として扱う。UI / viewer / external transport へ進む前に、「runtime 上で何が変わったか」を contract、evidence、fixture、AI regression で安定して説明できる状態にする。

## 3. Undine コンテキスト保護の復元規約

Wave 13 でも、Undine が詳細実装コンテキストを直接抱え込まないことを明示的な制約にする。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は原則として Gnome / Review-Sylph を直接起動しない。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Undine は各 domain の詳細ソースを大量に読まず、Orch-Sylph の completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- この節は context compaction 後に orchestration skill の内容が薄れた場合の復元規約であり、Wave 13 起動時に必読とする。

## 4. Repository Facts

- `packages/contracts/src/runtime-diff.ts` の `RuntimeDiffSchema` は現在 `runtime-diff-v1` で、`parameterChanges`、`dynamicsChanges`、`drawableChanges`、`diagnosticDelta` を持つ。
- `drawableChanges` は `boundsChanged` と `vertexHashBefore/After` が中心で、opacity / visibility / draw order / drawList 変更を専用 field として表現していない。
- `packages/runtime-core/src/snapshot-comparison.ts` は Wave 12 時点で opacity / visibility / draw order / drawList 差分を検出するが、drawList は `parameterChanges` の `/drawList` として粗く表現している。
- `packages/runtime-core/src/keyform-sampling.ts` は Grid2D sampling と diagnostics を実装済みだが、Wave 12 final report は diagnostic hardening tests の追加を残差としている。
- `fixtures/contracts/runtime-keyform-evaluation-foundation/runtime/grid2d-coverage-note.json` は Grid2D compact fixture omission の理由を記録している。
- `apps/editor/src/ai-command-host/editor-ai-keyform-command-host.test.ts` は AI `addKeyform` runtime-visible evidence を検証済みだが、`addKeyformGrid2d` 版は future regression として残っている。

## 5. Design Decisions

- Wave 13 は user-visible editor/viewer workflow へ進む前の観測基盤 hardening とする。
- runtime diff contract は後方互換を優先し、可能なら `runtime-diff-v1` に defaulted optional fields を追加する。schema version bump が必要な場合は Domain A が `escalate` する。
- drawList / opacity / visibility / draw order は `parameterChanges` へ押し込まず、dedicated runtime diff field で表現する方向を優先する。
- Grid2D evidence は runtime-core fixture / evidence / AI-host regression の3段で固める。
- Diagnostic hardening は production behavior を大きく変えるための domain ではなく、既存 behavior を明示的な regression にする domain とする。実装 bug が見つかった場合だけ最小修正する。
- Domain B escalation 後の alignment decision: `keyform.grid2dDuplicateKey` の canonical severity は `error` とし、strict / acceptance の profile behavior は fail のまま維持する。severity と profile failure status は `diagnostic-policy.md` に従って分離して扱う。Domain B の既存 escalation completion / review に残る unresolved severity 記述は historical pre-resolution artifact として扱い、この決定で supersede する。
- Public `index.ts` は barrel-only を維持し、実装本体を catch-all file に寄せない。

## 6. Non-Goals

- Editor UI の新機能は扱わない。
- Private viewer / renderer surface は扱わない。
- 外部 HTTP / WebSocket / MCP transport は扱わない。
- LLM provider integration は扱わない。
- `rigControl` keyform target application は扱わない。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading は扱わない。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave12/wave12-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures
- 必要に応じて Wave 12 の completion / review / integration report

Undine はすべての設計規約・実装規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Wave 13 は、最初に runtime diff contract と diagnostic regression を固め、その後に evidence / fixture / AI regression を並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. runtime diff contract and comparison semantics | Parallel with B | Wave 12 complete | dedicated drawable state / drawList diff fields を作る |
| 1 | B. keyform diagnostic regression hardening | Parallel with A | Wave 12 complete | Grid2D / sampling diagnostic regression を増やす |
| 2 | C. runtime evidence diff projection hardening | Parallel with D/E | A + B | enriched runtime diff を runtime evidence で観測する |
| 2 | D. Grid2D runtime fixture and evidence | Parallel with C/E | A + B | Grid2D runtime-visible fixture / evidence を追加する |
| 2 | E. AI/editor Grid2D evidence regression | Parallel with C/D | A + B | AI `addKeyformGrid2d` runtime-visible evidence を検証する |
| 3 | F. integration review and final report | Solo | C + D + E | clean integration review、修正反映、final report を完了する |

## 9. Domain Assignments

### A. `wave13-runtime-diff-contract-and-comparison-semantics`

Purpose:

- Runtime diff contract に drawable runtime state と drawList の専用表現を追加する。
- `compareRuntimeSnapshots` が opacity / visibility / draw order / drawList を dedicated fields に出すようにする。
- 既存 runtime diff consumers を壊さない後方互換を維持する。

Write scope:

- `packages/contracts/src/runtime-diff.ts`
- `packages/contracts/src/*runtime-diff*.test.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/snapshot-comparison.test.ts`
- 必要最小限の runtime-core focused tests

Pass evidence:

- mesh bounds / vertexHash diff は既存挙動を維持する。
- opacity / visibility / baseDrawOrder / evaluatedDrawOrder の before/after が runtime diff に表現される。
- drawList order change が dedicated field で表現され、`parameterChanges` の粗い `/drawList` に依存しない。
- 既存 evidence / tests が typecheck で壊れない。

Early escape:

- `runtime-diff-v1` に defaulted field 追加では互換性が保てず schema version bump が必要になる場合。
- contracts package 変更が AI / operation / validation の広範囲 rewrite を要求する場合。

### B. `wave13-keyform-diagnostic-regression-hardening`

Purpose:

- Wave 12 残差の diagnostic paths を直接 regression にする。
- duplicate linear key、duplicate Grid2D coordinate、missing parameter、unsupported evaluator、Grid2D key-range clamp を明示的にテストする。
- 実装 bug が見つかった場合だけ最小修正する。

Write scope:

- `packages/runtime-core/src/keyform-sampling.test.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-sampling.ts` は test-discovered bug fix の最小差分のみ可
- `packages/runtime-core/src/keyform-grid2d-interpolation.ts` / `keyform-linear1d-interpolation.ts` は最小 bug fix のみ可

Pass evidence:

- diagnostic `checkId`、severity、target、evidence が安定している。
- unsupported evaluator / unsupported patch shape が silent ignore にならない。
- Grid2D clamp と missing surrounding key が区別して観測できる。

Early escape:

- 現在の diagnostic policy と runtime-core contract が矛盾する場合。
- diagnostic shape を contracts 側で変更しないと表現できない場合。

### C. `wave13-runtime-evidence-diff-projection-hardening`

Purpose:

- Domain A の enriched runtime diff を runtime evidence artifact 上で観測できるようにする。
- runtime evidence tests が drawable runtime state / drawList changes を専用 diff field として検証する。

Write scope:

- `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`
- `packages/runtime-core/src/*evidence*.ts` は必要最小限のみ
- `packages/operation-core/src/*evidence*.test.ts` は既存 evidence path の regression が必要な場合のみ
- discussion completion / review reports

Pass evidence:

- runtime evidence artifact が enriched runtime diff を保持する。
- mesh deformation、opacity / visibility / draw order、drawList change の evidence regression がある。
- production source 変更が不要なら tests-only に留める。

Early escape:

- evidence artifact contract が dedicated runtime diff fields を落としてしまい、source redesign が必要になる場合。

### D. `wave13-grid2d-runtime-fixture-and-evidence`

Purpose:

- Wave 12 で omission note に留めた Grid2D compact fixture を実体化する。
- `parameter-grid-2d-v1` の runtime-visible sample / target application / diff / diagnostics を fixture oracle にする。

Write scope:

- `fixtures/contracts/runtime-grid2d-keyform-evidence/**` または既存 fixture convention に沿う同等 path
- `packages/runtime-core/src/*grid2d*fixture*.test.ts`
- 必要なら `fixtures/contracts/runtime-keyform-evaluation-foundation/runtime/grid2d-coverage-note.json` の更新
- discussion completion / review reports

Pass evidence:

- 2 parameter input、Grid2D keys、bilinear sample、runtime-visible drawable change が fixture で再現される。
- expected output に `keyformSamples`、sampledCoordinates、drawable state/diff が含まれる。
- fixture が過大になりすぎない。

Early escape:

- compact fixture として保持するには oracle が大きすぎる場合。
- Grid2D interpolation semantics に追加の user decision が必要な場合。

### E. `wave13-ai-editor-grid2d-evidence-regression`

Purpose:

- AI/editor path で `addKeyformGrid2d` が runtime-visible evidence へ接続されることを検証する。
- 既存 AI host / editor session / transcript persistence を使い、外部 transport や LLM provider は追加しない。

Write scope:

- `apps/editor/src/ai-command-host/editor-ai-keyform-command-host.test.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts` は必要最小限のみ
- `packages/ai-interface/src/**` は `addKeyformGrid2d` command schema が不足している場合のみ
- `apps/editor/src/ai-command-host/**` は schema/host support が不足している場合のみ
- discussion completion / review reports

Pass evidence:

- AI `addKeyformGrid2d` dry-run / approval / commit の regression がある。
- committed package file set の candidate runtime snapshot に Grid2D `keyformSamples` と runtime-visible drawable diff がある。
- transcript / evidence refs が既存 path で追跡できる。

Early escape:

- `addKeyformGrid2d` を AI command catalog に入れるために broader command redesign が必要な場合。
- editor UI の新機能が必要になる場合。

### F. `wave13-integration-review-and-final-report`

Purpose:

- Domain A-E の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 13 final report と maps を更新する。

Write scope:

- `discussion/implementation/waves/wave13/**`
- `discussion/implementation/reviews/wave13/**`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- integration review が Design / Development Compliance と Test Adequacy を含む。
- final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 13 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 13 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A と Domain B の Orch-Sylph を並列投入し、両方の completion report を待つ。
2. Domain A / B がどちらも `pass` したら、Undine は Domain C / D / E の Orch-Sylph を並列投入する。
3. Domain C / D / E がすべて `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
4. 各 Orch-Sylph は domain 内で Gnome 実装と Review-Sylph レビューを分離し、needs_fix loop を自分の domain 内で閉じる。
5. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
6. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
7. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
8. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

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

- Design / Contract Compliance: Wave13 plan、runtime-core contract、runtime diff contract に反していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / integration / evidence / fixture / AI regression が domain risk に見合うか。
- Backward Compatibility: existing runtime evidence / AI transcript / operation evidence を壊していないか。
- Determinism: Grid2D sampling、diff ordering、drawList ordering、diagnostic evidence が deterministic か。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: contracts focused tests、runtime-core snapshot comparison tests、typecheck
- Domain B: runtime-core sampling/interpolation focused tests、runtime-core broader tests if feasible
- Domain C: runtime evidence focused tests、typecheck
- Domain D: fixture regression tests、runtime-core focused tests、typecheck
- Domain E: editor AI host / session tests、affected editor tests、typecheck
- Domain F: `pnpm typecheck`、`pnpm test`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test`
- `pnpm run check:source`
- `git diff --check -- .`
- untracked file whitespace check if new fixtures/reports are untracked

既知の sandbox / dependency issue が出た場合は、実行失敗を隠さず記録し、必要なら承認付きで再実行する。

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Runtime diff schema version bump が必要になる。
- Runtime diff contract expansion が validation / operation / AI contracts の大規模 redesign を要求する。
- Grid2D fixture oracle が過大になり、compact fixture として維持しづらい。
- `addKeyformGrid2d` AI support が command catalog redesign や editor UI 実装を必要とする。
- Diagnostic severity / checkId policy が既存設計文書と矛盾する。

## 14. Pass Criteria

Wave 13 は次を満たしたとき pass とする。

- Runtime diff が drawable runtime state と drawList changes を dedicated field で表現できる。
- Grid2D keyform runtime effect が fixture / evidence / tests で観測できる。
- keyform diagnostic regression が Wave 12 残差を直接カバーしている。
- AI/editor `addKeyformGrid2d` path が runtime-visible evidence につながる、または追加 redesign が必要な場合は明確に `escalate` されている。
- `index.ts` は barrel-only のままで、巨大 source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
