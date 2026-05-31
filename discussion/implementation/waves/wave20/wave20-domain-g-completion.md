# Wave 20 Domain G Completion

> Domain: `wave20-psd-intake-e2e-and-persistence-smoke`
> Orchestrator: Orch-Sylph
> Implementer: Gnome
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome source implementation | `019e7bc4-987e-7b43-b69c-f019fdcc3927` / Gnome the 75th | Added PSD-centered browser e2e/persistence smoke coverage. |
| Review-Sylph independent review | `019e7bd6-3fb8-7400-ac99-3c4e89045b76` / Sylph the 76th | Reviewed basis docs, Domain E/F artifacts, e2e diffs/tests, and verification output. Verdict `pass`. |

Orch-Sylph did not implement source changes. Source implementation and review were separated into distinct contexts.

## Changed Files

| File | Purpose |
|---|---|
| `apps/editor/e2e/source-intake-smoke.mjs` | Switches source intake browser smoke to manual PSD adapter/profile metadata, exercises native form validation, and asserts saved package persistence for PSD source/profile/texture/drawable relations. |
| `apps/editor/e2e/smoke-checks.mjs` | Updates full smoke operation-log expectations from split PNG import to PSD adapter/profile import. |
| `discussion/implementation/reviews/wave20/wave20-domain-g-review.md` | Independent Review-Sylph report. |
| `discussion/implementation/waves/wave20/wave20-domain-g-completion.md` | Completion evidence for this domain. |

No UI implementation source changes were needed.

## Behavior Covered

- Browser smoke now registers parser-free PSD adapter/profile metadata through Source Intake.
- The smoke checks that PSD `role: "unsupported"` layers are not blocked by native `required` attributes on texture preview / texture ID, while mapped PSD layers still require texture mapping.
- The imported PSD source layer is used by the existing createDrawable / generateMesh workflow.
- Preview uses a deterministic `data:image/png` texture preview reference with `deterministic-data-url-v1`; the smoke does not claim PSD byte parsing or raster extraction.
- Save/load assertions inspect localStorage package files for:
  - `psd-source-v1`;
  - `layered-character-psd-profile-v1`;
  - `importPsdSourceAsset`;
  - PSD adapter schema/name/canvas diagnostics;
  - source layer identity, bounds, role, texture ID, target part, and texture preview reference;
  - preview asset metadata and drawable-to-source-layer mapping.
- Desktop and mobile e2e viewports still cover source intake, preview, drawable authoring, mesh vertex edits, layer controls, save/load, reset, horizontal overflow, and accessible-name assertions.

## Verification

```powershell
pnpm.cmd install --frozen-lockfile --force
```

Result: initial sandbox run failed with registry/cache `EACCES` after a forced dependency reinstall began. Escalated rerun passed and restored the existing frozen dependency tree. Lockfile was unchanged.

```powershell
pnpm.cmd test:e2e
```

Result: initial sandbox run failed because Vite dependency reads were blocked. Escalated rerun after implementation fixes passed:

- desktop smoke passed
- mobile smoke passed
- final `editor-e2e: smoke passed`

```powershell
pnpm.cmd typecheck
```

Result: initial sandbox run failed with `EPERM` reading the pnpm-installed TypeScript binary. Escalated rerun passed for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- apps/editor fixtures/e2e discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only existing Git LF/CRLF working-copy warnings.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json
```

Result: no output.

```powershell
rg -n -e "showOpenFilePicker" -e "FileReader" -e "ag-psd" -e "sharp" -e "pngjs" -e "jimp" -e "raster extraction" -e "extract raster" -e "decode image" -e "image decode" -e "PSD parser" -e "psd parser" -e "parsed from bytes" -e "Photoshop-compatible" -e "file picker" apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs
```

Result: no matches.

## Review Result

Review-Sylph verdict: `pass`.

No blocking findings and no non-blocking findings requiring a Domain G fix remain.

Confirmed review lanes:

- UI truthfulness and parser-free PSD adapter/profile wording: pass.
- Native form validation for PSD unsupported and mapped layers: pass.
- Save/load persistence for source layer, texture ID, part ID, preview relation, and `importPsdSourceAsset`: pass.
- Desktop/mobile layout overflow and accessible names: pass.
- No parser, file picker, raster extraction, dependency, operation/validator, app shell, or `index.ts` scope creep: pass.
- Test adequacy: pass.

Review report:

- `discussion/implementation/reviews/wave20/wave20-domain-g-review.md`

## Residual Risks

- The full browser smoke now covers the PSD path instead of the previous split PNG path. Split PNG remains covered by focused Domain F tests and existing unit/integration tests, but the root e2e smoke is now PSD-centered.
- The save/load assertion verifies persisted package files immediately after save and verifies source mapping is rendered after load. It does not re-read localStorage a second time after load because the loaded UI projection already comes from parsed package files.
- `pnpm install --frozen-lockfile --force` was needed only to restore the local `node_modules` state after Vite's transitive dependency was missing. No dependency manifest or lockfile changed.

## Next Domain Gate

Domain G can pass.

Domain H can proceed.

## Explicit Confirmations

- No dependency manifests changed.
- No PSD parser was added.
- No OS file picker was added.
- No image decode or raster extraction was added.
- No broad app shell redesign was made.
- No `index.ts` implementation logic was added.
