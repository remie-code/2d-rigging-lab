# Wave46 Domain F Review: PSD Selected Layer Focused E2E / Persistence Regression

> Target: `wave46-psd-selected-layer-focused-e2e-persistence-regression`
> Date: 2026-06-05
> Role: Review-Sylph independent reviewer

## Verdict

`pass`

Domain F stays inside the Wave46 F scope for focused e2e/regression/guard work and does not add product implementation. The focused browser e2e now proves the selected `headwear` layer path from explicit PSD import through existing-part materialized texture/drawable mapping and browser-local save/load boundary. Parser import containment remains covered by the dedicated guard command.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-orch-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-review.md`
- `discussion/implementation/reviews/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-review.md`
- `discussion/implementation/reviews/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Scope Reviewed

- `apps/editor/e2e/psd-import-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/run-focused-e2e.mjs`
- `scripts/check-focused-e2e-registry.mjs`
- `scripts/check-psd-parser-import-boundary.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave46/wave46-domain-f-psd-selected-layer-focused-e2e-persistence-regression-report.md`
- Supporting fixture evidence: `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`

The worktree contains other Wave46 Domain A-E source/package/validator changes. I treated those as prerequisite context and did not review them as Domain F edits except where their reported/reviewed contracts affect this e2e.

## Findings

No blocking or non-blocking findings.

Key evidence checked:

- Wave46 plan limits Domain F to `apps/editor/e2e/**`, focused e2e registry/guard updates, and narrow fixture/traceability docs; it forbids product implementation and broad behavior expansion (`discussion/implementation/orchestration/wave46-plan.md:241`, `:248`, `:250`, `:260`).
- The e2e uses `test_data/sample_model.psd` and the Wave44 `headwear` materialization fixture (`apps/editor/e2e/psd-import-focused-smoke.mjs:15`, `:20`). The fixture identifies `psd:root/layer[0]` as `headwear` with materialized byteLength `460800` and digest `671e6a...` (`test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:20`, `:21`, `:49`, `:52`).
- The e2e sets `psd:root/layer[0]`, uploads the explicit PSD file, submits parse, clicks the selected-layer intake action, and verifies the operation log contains `importPsdSourceAsset, importPsdLayerMaterialization` (`apps/editor/e2e/psd-import-focused-smoke.mjs:33`, `:64`, `:65`, `:76`, `:83`, `:84`, `:87`).
- Texture/drawable/part mapping evidence is asserted through digest, byteLength, mediaType, dimensions, texture binary ref, drawable-to-`part_root`, destination kind, source layer, source PSD, private/local provenance, and browser-local persistence facts (`apps/editor/e2e/psd-import-focused-smoke.mjs:266`, `:271`, `:276`, `:281`, `:284`, `:286`, `:291`, `:296`, `:299`).
- Save/load truthfulness is asserted against persisted project contents, including schema/revision, operation types, source asset metadata without source binary ref, texture binary ref, drawable mapping, root part membership, no raw parser object/source PSD/raw visual byte payload claims, and `publicDemoAsset=false` provenance (`apps/editor/e2e/psd-import-focused-smoke.mjs:311`, `:407`, `:420`, `:443`, `:448`, `:450`, `:455`, `:456`, `:460`, `:461`, `:464`, `:465`, `:467`, `:470`, `:471`).
- After reload, the explicit parser session is required to be cleared while the materialized project state and same-origin browser-local byte restoration remain visible (`apps/editor/e2e/psd-import-focused-smoke.mjs:506`, `:524`, `:546`, `:553`, `:554`, `:559`).
- The added e2e test IDs mirror production Editor IDs (`apps/editor/e2e/test-ids.mjs:45`, `:55`, `:61`; `apps/editor/src/editor-state/editor-test-ids.ts:45`, `:55`, `:61`).
- The focused registry update is narrow: existing `psdImportFocused` metadata now names selected-layer texture/part intake and remains standalone direct verification (`scripts/focused-e2e-registry.mjs:109`, `:111`, `:112`, `:113`). The runner executes the registry path with `shell: false` (`scripts/run-focused-e2e.mjs:157`, `:162`, `:165`), and the Wave42 boundary still maps the id to `node apps/editor/e2e/psd-import-focused-smoke.mjs` (`scripts/wave42-focused-e2e-boundary.mjs:96`, `:97`, `:98`).
- Fixture/traceability updates are limited to the Wave46 warning-gated row and related coverage lists (`discussion/tests/fixtures/fixture-manifest.md:65`, `:105`; `discussion/tests/traceability/test-traceability-matrix.md:100`, `:292`).
- The Domain F report records selected layer target, fallback status, no product implementation scope, persistence/provenance boundaries, verification, remaining issues, and provisional assumptions (`discussion/implementation/waves/wave46/wave46-domain-f-psd-selected-layer-focused-e2e-persistence-regression-report.md:16`, `:18`, `:30`, `:52`, `:62`, `:76`, `:81`).

## Verification Performed

- `node scripts/run-focused-e2e.mjs --id psdImportFocused`: pass. Output included `desktop passed byteLength=22406225 materializedBytes=460800 drawable=draw_headwear texture=tex_headwear` and `smoke passed`.
- `node scripts/check-psd-parser-import-boundary.mjs`: pass. Output: `5 direct import/resolve sites limited to approved adapter and Wave44 scripts`.
- `node scripts/check-focused-e2e-registry.mjs`: pass. Output: `20 entries, 14 aggregate-discoverable, 6 standalone direct`.
- `node --check apps/editor/e2e/psd-import-focused-smoke.mjs`: pass.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- apps/editor/e2e/psd-import-focused-smoke.mjs apps/editor/e2e/test-ids.mjs scripts/focused-e2e-registry.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave46/wave46-domain-f-psd-selected-layer-focused-e2e-persistence-regression-report.md`: pass with LF/CRLF working-copy warnings only.
- `rg -n "[ \t]+$" discussion/implementation/waves/wave46/wave46-domain-f-psd-selected-layer-focused-e2e-persistence-regression-report.md`: no trailing whitespace matches; `rg` exited 1 because there were no matches.

Normal managed-sandbox PowerShell process launch failed in this environment with `windows sandbox: spawn setup refresh`, so verification commands were rerun with sandbox escalation.

## Remaining Issues

- None for Domain F.
- Orchestration note: the mixed Wave46 worktree still contains Domain A-E source/package/validator changes. Those are outside this Domain F review and should remain covered by their own reviews and final wave integration.

## User-Decision Points

- None.

## Provisional Assumptions

- Reusing the existing standalone `psdImportFocused` id is acceptable because the existing focused path already owns the explicit PSD sample flow, and the registry remains direct/standalone rather than expanding aggregate e2e runtime.
- Existing destination part `part_root` is a valid Domain D-supported path for Domain F e2e coverage. Domain D/C already cover new-part support separately, so Domain F does not need to exercise both destination modes.
