# Wave87 Domain A Design / Development Compliance Review

## Verdict

pass

No blocking findings.

## Scope Reviewed

- Wave87 Domain A: `wave87-atlas-core-schema-apply-mutation`
- Review lane: Design / Development Compliance Review
- Changed source/tests reviewed:
  - `packages/package-format/src/texture-atlas.ts`
  - `packages/package-format/src/package-document.test.ts`
  - `packages/authoring-core/src/index.ts`
  - `packages/authoring-core/src/texture-atlas-targets.ts`
  - `packages/authoring-core/src/texture-atlas-packing.ts`
  - `packages/authoring-core/src/texture-atlas-binary.ts`
  - `packages/authoring-core/src/texture-atlas-mutations.ts`
  - `packages/authoring-core/src/texture-atlas-mutations.test.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave86/wave86-final-integration-report.md`
- `discussion/implementation/reviews/wave86/wave86-final-clean-integration-review.md`

## Findings

| Severity | Finding | Evidence | Recommendation |
|---|---|---|---|
| none | Package boundaries are coherent for Domain A. Persistent atlas entry dimensions and layout summary schemas live in package-format, while target selection, packing, raw RGBA page generation, and apply mutation live in authoring-core. | `packages/package-format/src/texture-atlas.ts:63`, `packages/package-format/src/texture-atlas.ts:99`, `packages/package-format/src/texture-atlas.ts:143`, `packages/authoring-core/src/texture-atlas-targets.ts:93`, `packages/authoring-core/src/texture-atlas-packing.ts:58`, `packages/authoring-core/src/texture-atlas-binary.ts:20`, `packages/authoring-core/src/texture-atlas-mutations.ts:71` | Proceed. Keep Domain B UI as a caller of these core APIs, not a duplicate implementation. |
| none | Source organization follows the policy. `index.ts` remains a barrel and the new atlas files have focused responsibilities. | `packages/authoring-core/src/index.ts:45`, `packages/authoring-core/src/index.ts:48`; source organization guard passed. | Proceed. Future atlas growth should continue splitting by target, packing, binary, and mutation concerns. |
| none | No new external dependency or forbidden dependency/asset boundary was introduced. | `git status --short -uall` showed no `package.json` or lockfile changes; `node scripts/check-dependencies.mjs` passed; review found no `operation-core` or `validator-core` imports in the new atlas source. | Proceed. |
| none | Schema and ID values are coherent with existing package-format / contracts conventions and contain no spaces in machine-readable IDs. | Atlas IDs and schema literals use safe values such as `texture-atlas-layout-v1`, `single-page-shelf-v1`, `atlas_page_0`, `atlas_layout_single_page_v1`, and dot-separated warning codes: `packages/package-format/src/texture-atlas.ts:100`, `packages/package-format/src/texture-atlas.ts:120`, `packages/package-format/src/texture-atlas.ts:130`, `packages/package-format/src/texture-atlas.ts:144`, `packages/authoring-core/src/texture-atlas-targets.ts:17` | Proceed. |
| none | Persistence boundary is preserved through existing package document and portable bundle paths. The new schema fields are optional on existing `texture-atlas-v1`, and existing binary-ref collection already walks texture atlas entries. | `packages/package-format/src/texture-atlas.ts:67`, `packages/package-format/src/texture-atlas.ts:160`, `packages/authoring-core/src/package-document-from-authoring-session.ts:115`, `packages/package-format/src/portable-package-bundle.ts:271`, `packages/authoring-core/src/portable-project-bundle.ts:155`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:230` | Proceed. |
| none | Forbidden scope is respected. I found no UI/runtime/validator changes, workspace directory export, ZIP/archive/File System Access API, camera/tracking, viewer controls, mesh generation algorithm, deformer/keyform/dynamics behavior, or Cubism compatibility work in the reviewed Domain A files. | Changed implementation is limited to package-format and authoring-core atlas files; `packages/authoring-core/src/texture-atlas-mutations.ts:170` only rewrites included drawable texture refs and mesh UVs. | Proceed. |

## Operation Policy Review

Pass with residual risk, not a blocking finding for Domain A.

`applyTextureAtlasPreview()` directly mutates `AuthoringSession` graph state, generated binary registrations, drawable texture refs, mesh UVs, authoring revision, and dirty state: `packages/authoring-core/src/texture-atlas-mutations.ts:147`, `packages/authoring-core/src/texture-atlas-mutations.ts:159`, `packages/authoring-core/src/texture-atlas-mutations.ts:180`, `packages/authoring-core/src/texture-atlas-mutations.ts:181`, `packages/authoring-core/src/texture-atlas-mutations.ts:196`.

This is acceptable in this Domain A review because:

- Wave87 Domain A explicitly scoped an authoring-core apply mutation foundation, not an operation-core workflow.
- Existing authoring-core mutation helpers already mutate authoring sessions directly and increment authoring revision, for example `setDrawableTexture()` at `packages/authoring-core/src/drawable-texture-mutations.ts:19` and `packages/authoring-core/src/drawable-texture-mutations.ts:50`.
- The existing authoring-core dependency boundary forbids importing `operation-core` or `validator-core`, so moving this implementation into Operation Core inside Domain A would cross the current package dependency design: `packages/authoring-core/src/dependency-boundary.test.ts:7`.

Residual risk:

- Before a user-facing Apply flow is accepted, Domain B or final integration should decide whether UI commit calls this helper only through an Operation Core wrapper, or records an explicit accepted exception. A GUI path that directly commits package changes without Operation Core evidence would conflict with `discussion/development_convention/operation-policy.md`.

## Compatibility / Persistence Notes

- Existing texture atlas documents remain compatible because `TextureAtlasEntry.dimensions` and `TextureAtlasFile.layoutSummary` are optional: `packages/package-format/src/texture-atlas.ts:67`, `packages/package-format/src/texture-atlas.ts:160`.
- Generated atlas binary bytes are stored as package-local binary refs rather than base64 JSON: `packages/authoring-core/src/texture-atlas-binary.ts:67`, `packages/authoring-core/src/texture-atlas-mutations.ts:133`.
- Source texture entries are retained through upsert-only generated atlas registration: `packages/authoring-core/src/texture-atlas-mutations.ts:147`.

## Verification

Review-side checks:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/package-format/src/texture-atlas.ts packages/package-format/src/package-document.test.ts packages/authoring-core/src/index.ts`: passed with LF/CRLF working-copy warnings only.
- `rg -n "[ \t]+$"` across all reviewed Domain A files: no trailing whitespace matches.

Parent verification accepted as adequate for this lane:

- Focused atlas Vitest: escalated pass, 2 files / 16 tests.
- Portable bundle Vitest: escalated pass, 2 files / 9 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with LF/CRLF warnings only.

I did not rerun Vitest or typecheck in this review lane because the parent supplied escalated pass results and the sandboxed Vitest failure is the known esbuild `spawn EPERM` behavior.

## Residual Risks

- Operation Core integration remains unresolved for the future UI/user-facing Apply path, as noted above.
- The generated atlas texture is binary/layout-only in Domain A; no human preview asset record is generated. This is not a package-boundary violation, but Domain B should confirm whether UI preview needs a separate preview asset or can render from layout/binary state.
- Raw RGBA dimensions still depend on the existing authoring convention and source mesh bounds for source textures; no broad texture-dimension migration was attempted.
- Stale preview guarding checks drawable texture refs and mesh UVs, but not every possible source-byte or mesh-topology drift. Domain B should treat preview state as invalidated when target inputs, settings, or bytes change.

## User-Decision Points

- Decide in Domain B/final integration whether the Apply command is Operation Core-wrapped for user-facing commits or explicitly accepted as an authoring-core direct mutation exception.
- Decide whether generated atlas pages need a separate preview asset record for UI inspection, or whether v0 remains binary/layout-only.
- Workspace Directory Export remains deferred and should not be treated as implemented by Domain A.
