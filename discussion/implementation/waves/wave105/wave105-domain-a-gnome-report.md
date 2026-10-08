# Wave105 Domain A — Variant Visibility Gate for Perception (Gnome report)

Verdict: **complete**

- Domain id: `wave105-variant-visibility-gate`
- Implementer: Gnome (opus), delegated by Orch-Sylph
- Source of truth: `discussion/implementation/orchestration/wave105-plan.md` §3.1 / §6; `discussion/model-authoring/research/variant-feature-survey.md`; wave104 final integration report.

## 1. What was built (summary)

The perception snapshot generation point (`evaluatePerceptionSnapshot` in
`apps/authoring-host/src/perception/evaluation-adapter.ts`) now composes
`base visible AND variantVisibilityPredicate(activeSelections)` at the **snapshot
level**, returning a NEW snapshot (drawables re-mapped, `drawList` re-derived) so the
runtime-core result is never mutated in place. Because render (`render-view-command.ts`
via the RenderScene adapter), measurement (`measurement-command.ts` via
`snapshot.drawables[].bounds`) and framing (`view-resolution.ts` via
`modelEvaluatedBounds` / `evaluatedDrawableBounds`) all consume this single snapshot,
the eye, the tape measure and the framing share one visibility world.

`renderView` and `inspectEvaluatedGeometry` gained an optional `variantSelections`
payload (shared zod shape). It is resolved + validated by a new host resolver that
rejects unknown group / variant references and mode mismatches deterministically. The
resolved selection is recorded in the render sidecar and the measurement result; the
measurement result also carries a gated `visible` flag per drawable. The ref目視 gate
PNGs were regenerated in the Default outfit.

## 2. Changed files (repo-relative)

Implementation:

- `packages/ai-interface/src/ai-variant-selection.ts` (NEW) — shared `variantSelections`
  payload + resolved-echo zod schemas. Dependency-clean: the `vgrp_*` / `var_*` id token
  patterns are declared inline (mirroring package-format) rather than imported, so the
  ai-interface dependency boundary (which forbids importing `package-format`) is not
  relaxed.
- `packages/ai-interface/src/index.ts` — barrel export of the new module.
- `packages/ai-interface/src/ai-render-view-command.ts` — `variantSelections` on the
  payload; resolved `variantSelections` on `RenderViewSidecarSchema` (optional, so
  pre-revision sidecars still parse; producer always emits it).
- `packages/ai-interface/src/ai-measurement-command.ts` — `variantSelections` on the
  payload; gated `visible` (optional) on the drawable result; resolved
  `variantSelections` on the result (optional, producer always emits).
- `apps/authoring-host/src/perception/variant-selection-resolution.ts` (NEW) — the
  explicit validation layer: defaults via authoring-core's
  `resolveDefaultVariantActiveSelections`, deterministic reject of unknown group /
  variant / mode mismatch / duplicate, deterministic sort by `variantGroupId`.
- `apps/authoring-host/src/perception/evaluation-adapter.ts` — the snapshot-level gate
  (`applyVariantVisibilityGate`) + `variantSelections` option. Identity for gate-free
  packages (returns the snapshot unchanged).
- `apps/authoring-host/src/perception/evaluated-bounds.ts` — `modelEvaluatedBounds` now
  unions only VISIBLE drawables so `modelBounds` framing shares the gated visibility
  world (identical to the old behaviour when nothing is gated).
- `apps/authoring-host/src/perception/render-view-command.ts` — resolves selections once,
  threads them into every snapshot evaluation (base + each sweep cell), records the
  resolved echo in both sidecar builder calls.
- `apps/authoring-host/src/perception/render-view-sidecar.ts` — sidecar builder passes
  through `variantSelections`.
- `apps/authoring-host/src/perception/measurement-command.ts` — resolves selections,
  gates the snapshot, adds the gated `visible` flag per drawable, records the resolved
  echo.
- `apps/authoring-host/src/test-support/perception-fixtures.ts` — new
  `createVariantPerceptionFixture` (a singleSelect group over the two existing drawables;
  Default→eye, Alt→eye-mask), parsed through `VariantGroupSchema` so all group invariants
  are enforced on the fixture.

Tests:

- `packages/ai-interface/src/ai-variant-selection.test.ts` (NEW, 15 tests)
- `apps/authoring-host/src/perception/variant-selection-resolution.test.ts` (NEW, 11 tests)
- `apps/authoring-host/src/perception/variant-visibility-gate.test.ts` (NEW, 14 tests)
- `apps/authoring-host/src/perception/render-view-file-output.test.ts` (+1 test)
- `apps/authoring-host/src/ref-e2e.test.ts` (+3 tests: 6/9 data-derived gate, Rodos
  override, deterministic reject)

Artifacts / docs:

- `discussion/model-authoring/experiments/ref-render-gate/ref-rest-full.png`,
  `ref-face-focus.png` (+ all 3 sidecars, measurement gate JSON) regenerated in the
  Default outfit. `ref-eyes-viewport.png` bytes unchanged (its viewport does not contain
  outfit drawables) — only its sidecar gained the `variantSelections` record; this is a
  consistency signal, not a miss.
- `discussion/model-authoring/experiments/ref-render-gate/README.md` — updated.

No changes to `package.json`, `pnpm-lock.yaml`, `packages/ai-interface/package.json`, or
any forbidden-scope directory.

## 3. Basis Coverage

Basis read: wave105-plan §3.1 (gate semantics ruling) / §6 (Domain A required
impl/tests/scope/escalate); variant-feature-survey (concept model, pure-function
behaviour, ref data, empty case); wave104 final integration report (perception path
handoff + the "≈9 extra drawables" caveat + the "escalate on install" process note).

| Required (plan §6) | How satisfied |
|---|---|
| evaluation-adapter gate (`base && predicate`, new snapshot, propagates to render+measure) | `applyVariantVisibilityGate` builds a new snapshot; render/measure/framing all consume the one gated snapshot. `EvaluatePerceptionSnapshotOptions.variantSelections` added; render-view / measurement resolve payload → pass resolved form. |
| payload/validation `variantSelections` (zod, defaultActive resolution, deterministic reject of unknown group/variant/mode) | `ai-variant-selection.ts` (zod) + `variant-selection-resolution.ts` (explicit existence + mode-integrity validation, since the pure predicate silently tolerates bad input). |
| sidecar records resolved selections (empty as empty array) | `RenderViewSidecarSchema.variantSelections` (optional, producer always emits); `render-view-sidecar.ts` + both call sites. |
| measurement result: gated visible flag + resolved selections | `visible` on `InspectDrawableGeometryResultSchema` (gated-hidden drawable returns geometry, `visible:false`); `variantSelections` on the result. |
| ref e2e: (1) 6/9 data-derived assert (2) PNG+sidecar regen, determinism (3) override | `ref-e2e.test.ts` 3 new tests. 6/9 derived from `ref/model/variants.json` memberships AND observed on the gated snapshot; determinism (2× byte-identical) retained; Rodos override changes the passing set + echoes the resolved outfit. |
| README update | Header→Wave105, PNGs=Default outfit, `variantSelections` sidecar read, wave104 "≈9 extra" caveat marked resolved, framing 392→389 note. |

| Required test (plan §6) | Where |
|---|---|
| Empty-case invariance (variantGroups absent → identity → output unchanged) | `variant-visibility-gate.test.ts` (identity snapshot + byte-identical render with/without empty selections + empty sidecar echo); plus all pre-existing golden render tests still pass (gate is a no-op there). |
| Composite fixture: default pass/block by membership (render bytes + snapshot visible) | `variant-visibility-gate.test.ts` (snapshot visible flags + drawList + different render bytes vs ungated baseline). |
| Override selection changes passing set / singleSelect+multi rejected | `variant-visibility-gate.test.ts` (Alt flips the set + different bytes) + reject tests; `variant-selection-resolution.test.ts` multiToggle coverage. |
| Unknown group / variant deterministic reject | `variant-selection-resolution.test.ts`, `variant-visibility-gate.test.ts`, `ref-e2e.test.ts` (ref-level reject). |
| Sidecar selections record (default / explicit / empty) | `variant-visibility-gate.test.ts` + `render-view-file-output.test.ts` (on-disk) + `ai-variant-selection.test.ts` (schema). |
| Measurement visible flag (hidden drawable → geometry present, flag false) | `variant-visibility-gate.test.ts`. |
| Non-regression (authoring-host / ai-interface / render-software) | Full suites green (see §4). |

## 4. Verification results

| Command | Result |
|---|---|
| `npx vitest run apps/authoring-host` (ref e2e included) | **80 passed / 0 failed** (14 files). Was 51 pre-wave; +29 new. ref e2e = 7 tests. |
| `npx vitest run packages/ai-interface` | **122 passed / 0 failed** (18 files). Was 107; +15 new. Dependency-boundary test passes (no boundary relaxation). |
| `npx vitest run packages/render-software` | **37 passed / 0 failed** (7 files). Unchanged — non-regression. |
| `npx tsc --noEmit` (root) | **exit 0** |
| `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | **exit 0** |
| `git diff --check` | exit 0 (no whitespace errors; only benign LF→CRLF advisories) |
| `node scripts/check-source-organization.mjs` | passed |
| Forbidden-scope diff | clean — `git status --porcelain` empty for runtime-core / authoring-core / render-software / render-webgl2 / operation-core / validator-core / package-format / apps/editor / apps/runtime-player / `ref/`. |
| Boundary / deps | `packages/ai-interface/package.json`, `pnpm-lock.yaml`, root `package.json` all unchanged. No install. |

## 5. Regenerated PNGs (what changed vs wave104)

The wave104 PNGs were rendered without the gate, so all three outfits (Ware group:
Default / Rodos / Endoministorator) overpainted each other — the ≈9 extra outfit
drawables the survey flagged. With the gate resolving to `defaultActive` (Default):

- `ref-rest-full.png` — binary changed; model-bounds framing tightened 392×1024 → 389×1024
  (the removed outfit drawables no longer widen the union).
- `ref-face-focus.png` — binary changed (stacked outfit layers removed from the frame).
- `ref-eyes-viewport.png` — bytes UNCHANGED (its stage viewport covers the eye region, no
  outfit drawables), sidecar gained the `variantSelections` record. This is the expected
  consistency behaviour, not a miss.
- All 3 sidecars + `ref-measurement-gate.json` now record
  `variantSelections: [{kind:"singleSelect", variantGroupId:"vgrp_expression",
  variantId:"var_expression_default"}]`.

Determinism preserved: the ref e2e re-render into a fresh directory is byte-identical.

## 6. How the 6 pass / 9 blocked was derived (not transcribed)

`ref-e2e.test.ts` reads `ref/model/variants.json` at runtime, computes for the Default
variant the target drawables whose membership `variantIds` contain
`var_expression_default` (INDEPENDENT expectation from the package data — the same rule
the pure predicate applies), and asserts that set equals what the **gated snapshot**
reports visible (measured through `inspectEvaluatedGeometry`, the same gated snapshot the
render consumes). The membership-derived Default set is size 6, its complement in the 15
targets is 9; both are asserted (`expect(...).toBe(6)` / `toHaveLength(9)`) to guard
against a vacuous pass. The 6 are tie / topwear(26f93e8b) / bottomwear(26f93eaa, shared
with Endoministorator) / handwear-l(26f93ec9) / handwear-r(26f93ee8) / neck_back; the 9
are the 5 Rodos + 4 Endoministorator members. The prompt's id list was used only to
sanity-check my reading of the file, never as the assertion source.

## 7. Design fidelity notes

- authoring-core / runtime-core UNCHANGED. The predicate + default derivation are
  consumed from authoring-core (`createVariantVisibilityPredicate`,
  `resolveDefaultVariantActiveSelections`), never re-implemented.
- The gate returns a new snapshot object (spread copy of drawables + snapshot); the
  runtime-core result is treated as read-only.
- Selection serialization is sorted by `variantGroupId` (both the authoring-core form and
  the resolved echo), so sidecar bytes stay deterministic.
- multiToggle is handled end to end (resolver + schema + tests), though `ref/` only
  exercises singleSelect. The purely-consumed predicate's multiToggle semantics
  ("membership ∩ active ≠ ∅") were unambiguous, so no escalate was needed.

## 8. Residual risks / notes for review

- The `modelEvaluatedBounds` change (union visible-only) is a behavioural refinement: for
  a gate-free package every drawable is visible so it is identical to the old union; only
  gated packages differ. This is required for framing to share the visibility world
  (plan §3.1). Reviewers should confirm this reading.
- The measurement `visible` flag and render sidecar `variantSelections` are additive
  optional fields; pre-revision consumers still parse. Producers always emit them (empty
  array when no groups).
- ref sidecar `packagePath` / `pngPath` remain machine-absolute (a pre-existing wave104
  non-blocking note, C-DEV-N-01); the on-disk sidecar determinism test compares content
  with `pngPath` excluded because that field legitimately embeds the per-run outDir.

## 9. Artifact-Wait protocol note (for Orch-Sylph)

This report file is written to the contract path
`discussion/implementation/waves/wave105/wave105-domain-a-gnome-report.md` as the
completion signal, per the wave105 §3.2 experiment. No L0 relay was needed on my side; I
completed the domain end to end without escalation.

## Questions

None blocking. One point for the reviewer's awareness: I extended `modelEvaluatedBounds`
to union only visible drawables (§7 first bullet). If the reviewer prefers framing to
remain over ALL drawables (visible or gated) I can revert that one function — but I read
plan §3.1 ("framing shares the same visibility world") as requiring it.
