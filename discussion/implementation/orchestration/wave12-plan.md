# Wave 12 Plan: Runtime Keyform Evaluation Foundation

> Wave 12 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 12
- Wave name: `runtime-keyform-evaluation-foundation`
- Primary objective: Wave 11 で作成可能になった keyform を runtime snapshot / runtime evidence 上で実際に評価できる foundation を作る。

## 2. Wave 12 の主目的

Wave 11 では authoring keyform mutation、`addKeyform` / `addKeyformGrid2d` operation handler、editor evidence、AI `addKeyform` regression が成立した。一方で、runtime snapshot はまだ keyform を評価せず、`keyformSamples` は空配列のままであり、mesh / drawable の runtime-visible deformation も発生しない。

Wave 12 はこの穴を埋める。具体的には、runtime graph の keyform binding を runtime evaluation に接続し、`linear-1d-v1` と `parameter-grid-2d-v1` の sampling foundation、sampled patch の target application、runtime snapshot / evidence / diff への反映を実装する。

## 3. Undine コンテキスト保護の復元規約

この wave では、Undine が詳細実装コンテキストを直接抱え込まないことを明示的な設計制約にする。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は原則として Gnome / Review-Sylph を直接起動しない。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Undine は各 domain の詳細ソースを大量に読まず、Orch-Sylph の completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- この節は context compaction 後に orchestration skill の内容が薄れた場合の復元規約であり、Wave 12 起動時に必読とする。

## 4. Repository Facts

- `packages/runtime-core/src/runtime-core.ts` の `evaluateRuntimeFrame` / `evaluateRuntimeSequence` は runtime snapshot を作るが、現状 keyform sampling は行っていない。
- `packages/runtime-core/src/snapshot.ts` の `RuntimeSnapshotSchema` は `keyformSamples` を持つが、`createRuntimeSnapshot` は `keyformSamples: []` を返している。
- `packages/runtime-core/src/normalized-runtime-graph.ts` には `keyformBindings` があるが、runtime sample contract に必要な `keyformSetId` が binding 側に保持されていない。
- `packages/authoring-core/src/runtime-graph-keyforms.ts` は authoring keyformSets を runtime keyformBindings に変換しているため、`keyformSetId` の bridge 修正が必要になる。
- `discussion/design/module-contracts/runtime-core-contract.md` は runtime snapshot の `keyformSamples`、`linear-1d-v1`、`parameter-grid-2d-v1`、keyform sampling phase、grid2d missing key diagnostics を要求している。
- `packages/runtime-core/src/snapshot-comparison.ts` は drawable の `bounds` / `vertexHash` 比較が中心で、opacity / visibility / draw order の runtime-visible 差分はまだ薄い。

## 5. Design Decisions

- Wave 12 は keyform runtime evaluation foundation を優先する。AI-host `addKeyformGrid2d` regression 拡張は重要だが、keyform が runtime 上で可視化されない限り効果検証の基盤にならないため、後続候補に回す。
- `keyformSetId` は runtime `KeyformBinding` に追加し、snapshot の `keyformSamples` と evidence が authoring keyformSet へ追跡できるようにする。
- Sampling と target application は分離する。sampling domain は parameter 値から sampled patch を作り、application domain は sampled patch を mesh / drawable state へ適用する。
- Wave 12 の target application は MVP foundation に限定する。mesh vertices、drawable opacity / visibility / draw order を優先し、unsupported target / property は diagnostic として扱う。
- Public `index.ts` は barrel-only を維持し、実装本体を巨大な catch-all source file に寄せない。

## 6. Non-Goals

- 外部 HTTP / WebSocket / MCP transport は扱わない。
- UI 上の keyform authoring 体験拡張は扱わない。
- rigControl hierarchy evaluator の本格実装は扱わない。`rigControl` target は未対応 diagnostic または future scope として扱う。
- 全種類の statePatch value を完全補間しない。Wave 12 では numeric、Vec2、Vec2 array など runtime-visible MVP に必要な deterministic interpolation を優先する。
- AI `addKeyformGrid2d` command の editor host regression 拡張は必須範囲に入れない。runtime evidence domain で自然に必要になった場合だけ最小対応する。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/implementation/waves/wave11/wave11-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures
- 必要に応じて Wave 11 の domain completion / integration review

Undine はすべての設計規約・実装規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Wave 12 は直列 gate と並列 batch を組み合わせる。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. keyform binding identity / parameter resolution | Solo | Wave 11 complete | `keyformSetId` と effective parameter resolution の基盤を作る |
| 2 | B. keyform sampling foundation | Parallel with C | A | `linear-1d-v1` / `parameter-grid-2d-v1` sampling を作る |
| 2 | C. keyform target application | Parallel with B | A | sampled patch を mesh / drawable state へ適用する |
| 3 | D. runtime snapshot integration | Solo | B + C | snapshot / sequence / diff / trace に keyform evaluation を接続する |
| 4 | E. runtime evidence regression | Parallel with F | D | runtime evidence / editor evidence / AI evidence の観測を固める |
| 4 | F. compact runtime keyform fixture | Parallel with E | D | compact contract fixture と regression を作る |
| 5 | G. integration review / final report | Solo | E + F | clean integration review、修正反映、final report を完了する |

## 9. Domain Assignments

### A. `wave12-runtime-keyform-binding-identity-and-parameter-resolution`

Purpose:

- Runtime `KeyformBinding` が `keyformSetId` を保持できるようにする。
- Authoring keyformSet から runtime keyformBinding への identity bridge を作る。
- Runtime snapshot / sampling が共通利用できる effective parameter resolution helper を切り出す。

Write scope:

- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/keyform-evaluation-types.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/snapshot.ts` は helper 利用のための最小差分のみ可
- `packages/authoring-core/src/runtime-graph-keyforms.ts`
- focused tests only

Pass evidence:

- `keyformSetId` が runtime graph に残る。
- 既存 authoring/runtime tests が通る。
- effective parameter resolution が snapshot 既存挙動を壊さない。

### B. `wave12-runtime-keyform-sampling-foundation`

Purpose:

- Runtime keyform bindings と effective parameter values から sampled patches / keyformSamples / diagnostics を作る。
- `linear-1d-v1` と `parameter-grid-2d-v1` の deterministic sampling foundation を実装する。

Write scope:

- `packages/runtime-core/src/keyform-sampling.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.ts`
- focused runtime-core tests

Pass evidence:

- 1D exact key / interpolation / out-of-range clamp が deterministic に動く。
- Grid2D exact key / bilinear interpolation / missing surrounding key diagnostic が動く。
- unsupported patch value は silent ignore ではなく diagnostic になる。

### C. `wave12-runtime-keyform-target-application`

Purpose:

- sampled patch を runtime target state へ適用する。
- Mesh vertices 変更時に bounds / vertexHash が deterministic に更新されるようにする。
- Drawable opacity / visibility / draw order の変更を snapshot に反映できるようにする。

Write scope:

- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/drawable-geometry.ts` または既存相当 helper
- focused runtime-core tests

Pass evidence:

- mesh vertices patch が evaluated drawable の bounds / vertexHash に反映される。
- opacity / visibility / draw order patch が snapshot output に反映される。
- unsupported targetKind / targetProperty は diagnostic になる。

### D. `wave12-runtime-snapshot-keyform-integration`

Purpose:

- Sampling と target application を `createRuntimeSnapshot` / runtime frame evaluation へ接続する。
- `keyformSamples` を snapshot に入れる。
- runtime trace / sequence artifact / snapshot comparison が keyform evaluation を観測できるようにする。

Write scope:

- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/index.ts` は barrel-only export 追加のみ可
- focused runtime-core tests

Pass evidence:

- keyform がない graph の既存 runtime snapshot 挙動は維持される。
- keyform がある graph では `keyformSamples` が空でなくなる。
- mesh keyform の runtime diff が drawable 変更として観測できる。
- opacity / visibility / draw order の差分も必要最小限で観測できる。

### E. `wave12-runtime-evidence-keyform-regression`

Purpose:

- Runtime evidence / editor evidence / AI operation evidence から keyform runtime effect を観測できることを確認する。
- Wave 11 の `addKeyform` で作られた keyform が runtime artifact 上で無視されないことを regression にする。

Write scope:

- `packages/runtime-core/src/*evidence*.test.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/ai-command-host/*keyform*.test.ts` は必要時のみ
- source change は原則禁止。必要な場合は Orch-Sylph が理由を completion report に記録する。

Pass evidence:

- runtime evidence artifact に keyform sample / drawable change が含まれる。
- editor session evidence が keyform runtime effect を失わない。
- AI `addKeyform` regression が runtime-visible evidence と接続される。

### F. `wave12-runtime-keyform-fixture`

Purpose:

- Compact fixture で runtime keyform evaluation の再現性を固定する。
- review / future wave が読む最小 oracle を作る。

Write scope:

- `fixtures/contracts/runtime-keyform-evaluation-foundation/**`
- fixture-specific tests
- 必要に応じて package-format / runtime-core fixture loader tests

Pass evidence:

- 1D mesh vertices keyform の compact fixture がある。
- 可能なら Grid2D keyform の compact fixture もある。fixture が過大になる場合は Grid2D は unit test に留め、理由を記録する。
- fixture expected artifact に `keyformSamples` と runtime-visible drawable change が含まれる。

### G. `wave12-integration-review-and-final-report`

Purpose:

- Domain A-F の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 12 final report と maps を更新する。

Write scope:

- `discussion/implementation/waves/wave12/**`
- `discussion/implementation/reviews/wave12/**`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- integration review が Design / Development Compliance と Test Adequacy を含む。
- final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 12 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 12 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Batch 1 の Domain A を Orch-Sylph に委譲し、Domain A の completion report を待つ。
2. Domain A が pass したら、Undine は Domain B と Domain C の Orch-Sylph を並列投入する。
3. Domain B / C がどちらも pass したら、Undine は Domain D を Orch-Sylph に委譲する。
4. Domain D が pass したら、Undine は Domain E と Domain F の Orch-Sylph を並列投入する。
5. Domain E / F がどちらも pass したら、Undine は Domain G を Orch-Sylph に委譲する。
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

- Design / Contract Compliance: `runtime-core-contract.md` と Wave12 plan に反していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / integration / fixture / evidence test が domain risk に見合うか。
- Determinism: interpolation、vertexHash、bounds、diagnostics が deterministic か。
- Backward Compatibility: keyform なし graph の既存 snapshot / evidence が壊れていないか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A-C: focused `pnpm exec vitest run ...` on touched package tests
- Domain D: runtime-core focused tests plus typecheck
- Domain E-F: affected package/editor tests plus fixture regression
- Domain G: `pnpm typecheck` and `pnpm test`

最終 verification:

- `pnpm typecheck`
- `pnpm test`
- 必要に応じて `pnpm check`

既知の sandbox / dependency issue が出た場合は、実行失敗を隠さず記録し、必要なら承認付きで再実行する。

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- runtime keyform binding に `keyformSetId` を追加すると契約互換性に大きな破壊が出る。
- `parameter-grid-2d-v1` の bilinear interpolation が既存 DTO 形状だけでは一意に決まらない。
- target application が mesh vertices 以外に広がり、Wave 12 の単位を超える。
- evidence / fixture 対応のために editor UI や AI transport の新機能が必要になる。
- source-file organization policy を守るには大きめの分割設計判断が必要になる。

## 14. Pass Criteria

Wave 12 は次を満たしたとき pass とする。

- Runtime graph が keyform identity を失わない。
- `linear-1d-v1` / `parameter-grid-2d-v1` の sampling foundation がある。
- sampled keyform patch が runtime snapshot の drawable state に反映される。
- `keyformSamples` が runtime snapshot / evidence 上で観測できる。
- Runtime diff / fixture / tests が keyform runtime effect を捕捉する。
- `index.ts` は barrel-only のままで、巨大 source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
