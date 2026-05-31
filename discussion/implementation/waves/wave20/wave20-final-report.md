# Wave 20 Final Report: PSD Spec Field Matrix And Adapter Boundary

> Target: `wave20-integration-review-and-final-report`
> Date: 2026-05-31
> Orchestrator: Orch-Sylph
> Status: `pass`

## Status

Wave 20 is `pass` / implementation-proven.

Domain A-G completion reports are all `pass`, Domain H final verification passed, clean integration review passed, maps and current capability documentation were updated, and no source fix remains.

## Domain Results

| Domain | Result | Gnome context | Review-Sylph context | Evidence |
|---|---|---|---|---|
| A. PSD spec field matrix and sample characterization | `pass` | `019e7b5e-3e57-7522-86f4-111cda305bc4` / Gnome the 63rd | `019e7b64-f7f9-7c70-a0bc-8641238d76e7` / Sylph the 64th | [wave20-domain-a-completion.md](wave20-domain-a-completion.md), [../../reviews/wave20/wave20-domain-a-review.md](../../reviews/wave20/wave20-domain-a-review.md) |
| B. PSD adapter result DTO and operation payload gate | `pass` | `019e7b70-e621-72a2-a0bc-345cbe86473f` / Gnome the 65th | `019e7b77-a4c7-7601-976b-da6c87c0b98b` / Sylph the 66th | [wave20-domain-b-completion.md](wave20-domain-b-completion.md), [../../reviews/wave20/wave20-domain-b-review.md](../../reviews/wave20/wave20-domain-b-review.md) |
| C. PSD import operation materialization | `pass` | `019e7b80-e80e-77f3-a369-469860936c86` / Gnome the 68th | `019e7b95-203a-7330-9313-273af785be5e` / Sylph the 70th | [wave20-domain-c-completion.md](wave20-domain-c-completion.md), [../../reviews/wave20/wave20-domain-c-review.md](../../reviews/wave20/wave20-domain-c-review.md) |
| D. PSD profile validator diagnostics | `pass` | `019e7b81-f8ea-7410-84a5-e3a9813fe96d` / Gnome the 69th | `019e7b8c-93ed-7850-9117-d3bc6e83a1d8` / Sylph the 69th | [wave20-domain-d-completion.md](wave20-domain-d-completion.md), [../../reviews/wave20/wave20-domain-d-review.md](../../reviews/wave20/wave20-domain-d-review.md) |
| E. PSD fixtures and contract evidence | `pass` | `019e7ba0-4c29-7352-9806-003aec8041f5` / Gnome the 72nd | `019e7bad-56ec-77e3-b723-9fd910e7b323` / Sylph the 73rd | [wave20-domain-e-completion.md](wave20-domain-e-completion.md), [../../reviews/wave20/wave20-domain-e-review.md](../../reviews/wave20/wave20-domain-e-review.md) |
| F. Editor PSD source intake mode | `pass` | `019e7ba1-2572-7e30-b436-12ad9efdf8fe` / Gnome the 73rd | `019e7bb0-7d2d-7b93-be32-6d8c749ab515` / Sylph the 74th | [wave20-domain-f-completion.md](wave20-domain-f-completion.md), [../../reviews/wave20/wave20-domain-f-review.md](../../reviews/wave20/wave20-domain-f-review.md) |
| G. PSD intake e2e and persistence smoke | `pass` | `019e7bc4-987e-7b43-b69c-f019fdcc3927` / Gnome the 75th | `019e7bd6-3fb8-7400-ac99-3c4e89045b76` / Sylph the 76th | [wave20-domain-g-completion.md](wave20-domain-g-completion.md), [../../reviews/wave20/wave20-domain-g-review.md](../../reviews/wave20/wave20-domain-g-review.md) |
| H. Integration review and final report | `pass` | `019e7bdd-f72b-72a1-be8d-d327cf730b70` / Gnome the 77th | `019e7bde-4170-7790-af54-892011b62f36` / Sylph the 78th | [wave20-final-verification-report.md](wave20-final-verification-report.md), [../../reviews/wave20/wave20-clean-integration-review.md](../../reviews/wave20/wave20-clean-integration-review.md) |

## Changed-File Summary

| Area | Summary |
|---|---|
| PSD basis artifacts | Added Adobe PSD spec field matrix and safe `test_data/sample_model.psd` characterization with checksum, header facts, top-level offsets, and explicit non-claims. |
| Operation core | Added parser-free PSD adapter result DTOs, commit-capable `importPsdSourceAsset` materialization, deterministic missing-adapter / unsupported-feature diagnostics, texture preview metadata validation, registry wiring, and focused operation tests. |
| Authoring core | Added focused test coverage proving PSD source profile metadata, rights, provenance, and flattened diagnostics fit existing authoring mutations. |
| Validator core | Added PSD source profile validator checks for unsupported features and layer provenance, wired validator runtime integration, catalog entries, barrel-only export, and focused tests. |
| Fixtures | Added synthetic parser-free `psd-import-happy-path` and `psd-unsupported-layer` contract fixtures. No PSD, image, WASM, or third-party binary fixtures were added. |
| Editor | Added manual PSD adapter/profile Source Intake mode, parser-free payload construction, UI/native validation behavior, workflow/controller/evidence wiring, and focused state/UI/workflow tests. |
| E2E | Switched Source Intake smoke to the PSD adapter/profile path and verified native validation, createDrawable/generateMesh, texture preview, save/load persistence, desktop/mobile layout, and accessible names. |
| Discussion/maps | Added Wave 20 completion/review/final verification artifacts and updated implementation maps plus current capability map. |
| Dependency manifests | No dependency manifest or lockfile changes. |

## Final Verification

Final verification was delegated to Gnome and persisted in [wave20-final-verification-report.md](wave20-final-verification-report.md).

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `pnpm.cmd test:unit` | pass after sandbox escalation | Initial sandbox run hit `EPERM` reading installed Vitest. Escalated rerun passed `93` files / `496` tests. |
| `pnpm.cmd test:e2e` | pass after dependency-tree restore and sandbox escalation | Frozen install restored the existing pnpm tree with no manifest/lockfile changes. Desktop and mobile smoke passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation` | pass | No whitespace errors; Git LF/CRLF working-copy warnings only. |
| Dependency manifest diff check | pass | `package.json`, `pnpm-lock.yaml`, workspace manifest, app manifests, and package manifests had no diff or untracked changes. |
| Parser/file-picker/decode/raster scan | pass | Changed production files contain no OS file picker, PSD parser dependency, filesystem read, image decode implementation, raster extraction implementation, or Photoshop-compatible rendering claim. Matches were negative/truthfulness diagnostics or metadata names. |

## Integration Review

Clean integration review was delegated to Review-Sylph and persisted in [../../reviews/wave20/wave20-clean-integration-review.md](../../reviews/wave20/wave20-clean-integration-review.md).

Verdict: `pass`.

Rubric result:

| Rubric | Result |
|---|---|
| PSD Spec Basis | pass |
| Sample Characterization | pass |
| PSD Profile Truthfulness | pass |
| Dependency Policy Compliance | pass |
| Source Layer Mapping | pass |
| Texture Preview Persistence | pass |
| Validator Evidence | pass |
| UI / Accessibility | pass |
| Source Organization | pass |
| Test Adequacy | pass |
| Orchestration Compliance | pass |

Review-Sylph found no blocking, high, medium, or low source findings. No source fix is required.

## Capability Now Proven

Wave 20 proves a parser-free PSD adapter/profile boundary:

- Adobe PSD spec coverage and the rights-cleared sample PSD are recorded as implementation basis.
- `importPsdSourceAsset` can commit when a trusted adapter supplies `layered-character-psd-profile-v1` metadata.
- Missing adapter result, unsupported PSD features, missing provenance, missing texture preview, and source-layer mismatches are deterministic diagnostics.
- PSD source assets preserve source profile, layer/group metadata, texture preview reference, texture ID, target part mapping, rights/provenance, operation log, source manifest evidence, and browser save/load persistence.
- Editor Source Intake can manually enter PSD adapter/profile metadata and drive the existing createDrawable / generateMesh / preview workflow.

## Explicit Non-Claims

Wave 20 does not implement or claim:

- actual PSD binary parser support;
- PSD layer tree extraction from file bytes;
- PSD channel image decode;
- raster extraction or preview generation from PSD pixels;
- Photoshop-compatible compositing, masks, effects, smart objects, text, or vector rendering;
- OS file picker or package archive import/export;
- dependency additions for PSD/image parsing.

## Residual Risks

- PSD details are still persisted through current package/source manifest surfaces, including flattened `diagnostics: string[]` and `sourceLayer.unsupportedFeatures: string[]`. A later package-format wave may want structured PSD profile persistence.
- The root browser smoke is now PSD-centered. Split PNG compatibility remains covered by focused state/workflow/operation tests, but not as the primary e2e path.
- E2E required restoring local `node_modules` from the frozen lockfile because sandbox-visible dependency reads/resolution were blocked. This changed installed dependency state only, not manifests or lockfiles.
- Future real PSD parser work will need separate rights, dependency, binary fixture, file storage, decode, mask/group semantics, and texture generation review before any stronger import claim.

## Next-Wave Recommendation

Recommended next wave: choose one of these, in this priority order:

1. Real asset I/O boundary design: package binary file set, OS/file/archive import-export policy, and storage failure UX, still without implementing a PSD parser.
2. Real texture pipeline expansion: actual PNG bytes/decode/materialization for rights-clean texture assets before PSD raster extraction.
3. Product authoring workflow expansion: layer tree, opacity/mask/clipping controls, richer part/texture authoring, or standalone viewer depending on MVP priority.
4. PSD parser dependency proposal only after the project explicitly accepts dependency/license/provenance scope and defines binary fixture policy.

No escalation or user decision is required to close Wave 20. Parser/decode/file-picker work remains future scope and must be planned as a separate wave.
