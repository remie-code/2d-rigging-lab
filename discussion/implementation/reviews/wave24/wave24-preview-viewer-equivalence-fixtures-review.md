# Wave 24 Domain D Review: Preview / Viewer Equivalence Fixtures

> Target: `wave24-preview-viewer-equivalence-fixtures`
> Implementer: `019e7ecc-b6ea-7de3-99e7-d357cddf03cc` / `Gnome the 37th`
> Role: independent Review-Sylph
> Verdict: `pass`

## Scope

Reviewed Domain D from the basis documents, target fixture/test files, dependency context, and local verification commands. This review did not rely only on the implementer's completion notes and did not edit source, tests, or fixtures. The only write performed by this review is this artifact.

## Findings

No blocking, high, medium, or low findings.

## Design / Development Compliance

Result: `pass`.

- Domain scope is respected. The Domain D implementation is limited to the preview/viewer equivalence fixture, one focused runtime-core fixture test, and the completion report:
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/fixture-manifest.json`
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json`
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/request/evaluation-request.json`
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`
  - `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - `discussion/implementation/waves/wave24/wave24-preview-viewer-equivalence-fixtures-completion.md`
- The fixture stays within the Wave24 Domain D oracle: summary, effective parameters, targeted keyform/drawable/dynamics fields, and runtime diff. It explicitly records no pixel renderer oracle in `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json:275`.
- The runtime input is deterministic: fixed frame indices, `deltaTimeMs: 0`, explicit reset reason, explicit parameter override, target IDs, and `snapshotDetail: "full"` are pinned in `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/request/evaluation-request.json:3`.
- The runtime graph is synthetic metadata only. It contains authored/computed parameters, one Minimum Open Dynamics v1 group, one drawable, one linear keyform binding, and no real assets/binary fixtures in `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json:7`, `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json:27`, `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json:58`, and `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json:90`.
- No editor UI implementation, runtime/validator broad implementation, package manifest/lockfile change, Cubism SDK/Core, Cubism compatibility claim, real PSD/image decode, file picker, archive, actual binary upload, or external dependency addition was found in the Domain D-owned files.
- The public `index.ts` barrel policy is not touched by Domain D.
- The runtime-core test imports the existing editor preview projection only from test code at `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:21`. Given the assignment explicitly allowed a test-only import of the existing editor preview projection, this is acceptable for this domain.

## Test Adequacy

Result: `pass`.

- The test evaluates Preview and Viewer from the same normalized runtime graph and request, then asserts all equivalence flags and the complete expected semantic JSON summary in `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:43`.
- Preview uses the existing embedded preview projection path, not a new mock oracle, through `projectEditorPreview` in `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:153`.
- Viewer uses Domain A's `evaluateViewerRuntimeSnapshot` in `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:48`.
- The expected summary pins preview projection summary, viewer evidence, comparable snapshot summaries, effective authored/computed parameter values, targeted keyform sample, targeted drawable bounds/vertices, targeted dynamics driver/output/state, and runtime diff in `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json:23`, `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json:156`, and `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json:275`.
- Existing Wave23 dynamics compatibility was personally rechecked by running the runtime and validator dynamics contract fixture tests with the new preview/viewer fixture test.
- The fixture is deterministic and reproducible: expected output is checked by exact JSON equality, and no wall-clock, browser frame timing, real asset bytes, or renderer pixels are part of the oracle.

## Verification Performed

Read basis documents:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave24-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave23/wave23-final-report.md`
- `discussion/implementation/reviews/wave23/wave23-clean-integration-review.md`
- `discussion/implementation/waves/wave24/wave24-domain-a-viewer-evaluation-foundation-completion.md`
- `discussion/implementation/reviews/wave24/wave24-domain-a-viewer-evaluation-foundation-review.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`

Inspected target files directly:

- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/fixture-manifest.json`
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json`
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/request/evaluation-request.json`
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`
- `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
- `discussion/implementation/waves/wave24/wave24-preview-viewer-equivalence-fixtures-completion.md`

Inspected dependency/context files:

- `packages/runtime-core/src/viewer-evaluation.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/runtime-grid2d-keyform-fixture.test.ts`

Commands/checks:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/runtime-evidence-report.test.ts` | pass; 5 files / 12 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `pnpm.cmd test:unit` | pass; exit 0 in this review run |
| `git diff --check -- fixtures/contracts packages/runtime-core packages/validator-core discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; LF/CRLF working-copy warnings only |
| trailing whitespace scan over untracked Domain D files | pass; no matches |
| dependency manifest diff check over root/editor/package manifests and package manifests | pass; no output |
| forbidden-scope scan over Domain D files | pass; only non-goal text in the completion report matched |
| `git status --short -uall --` Domain D target paths | confirmed expected untracked Domain D files; review artifact did not exist before this review |

## Residual Risks

- This fixture proves a deterministic normalized runtime graph path, not an editor UI workflow, browser persistence smoke, or end-to-end viewer opening flow. Those remain for later Wave24 domains.
- The oracle is intentionally semantic JSON only. Renderer or pixel equivalence remains future scope.
- The runtime-core fixture test has a test-only relative import from `apps/editor` to exercise the real preview projection. This is acceptable under the Domain D assignment, but it is still cross-package test coupling to watch if fixture coverage grows.
- The fixture manifest was inspected directly, while the test loads the runtime graph, request, and expected summary by fixed paths rather than driving from the manifest. This is not blocking for the current equivalence proof, but a future contract-fixture harness could validate manifest-to-artifact consistency more uniformly.

## Required Gnome Fix

None.

## User Decision Points

None.
