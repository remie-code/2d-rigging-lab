# Wave105 Domain A — Test Adequacy Review (Review-Sylph)

Reviewer: Review-Sylph (opus), delegated by Orch-Sylph (Wave105 Domain A, Test Adequacy lane).
Basis: `discussion/implementation/orchestration/wave105-plan.md` §6/§8/§9; Gnome report
`discussion/implementation/waves/wave105/wave105-domain-a-gnome-report.md`; the test + implementation
files listed below. Read-only + mutation-probe methodology; all probes restored (residue-zero proof
in §Probes).

## Overall verdict: **needs_fix** (one genuine test-adequacy gap; everything else passes)

The Variant-gate Required tests are strong and non-vacuous: every mutation I injected into the gate
predicate, the reject validation, and the measurement flag turned the corresponding tests red, and
the ref e2e 6/9 assertion is genuinely derived from `ref/model/variants.json` (not a prompt echo) and
guards against a vacuous pass. The **one gap** is the `modelEvaluatedBounds` visible-only framing
refinement (Gnome report §7/§8, the change the Gnome explicitly asked reviewers to confirm): reverting
it to the old "union all drawables" behaviour leaves **every** perception test AND the full ref e2e
suite green. That behavioural change — required by plan §3.1 ("framing shares the visibility world")
and §9 ("目と巻尺が同じ可視性世界を見る") — is currently unguarded by any test.

## Per-item findings

### 1. Empty-case invariance (byte-identical) — **pass (with a scoped caveat)**
- `variant-visibility-gate.test.ts:57-93` proves the empty (gate-free) package is a no-op *within the
  gated code path*: identity snapshot (all base-visible drawables stay visible) + byte-identical render
  with vs without an empty `variantSelections` request + empty sidecar echo.
- Plan §6 explicitly permits proving the pre-gate↔post-gate byte identity "via the existing golden
  render tests' unchanged pass". I confirmed those goldens still pass: `render-view-command.test.ts`
  (deterministic rest-pose PNG) and `render-view-file-output.test.ts` (byte-identical across runs) are
  green, and the empty-parameter fixture has **no** Variant Groups, so `applyVariantVisibilityGate`
  returns the input snapshot unchanged (`evaluation-adapter.ts:104-109`). Caveat (not a defect): the
  test does not compare bytes against a *pre-Wave105* baseline directly — it relies on the identity
  early-return + the pre-existing goldens. This matches the plan's allowance.

### 2. Composite fixture default pass/block (render bytes + snapshot visibility) — **pass**
- `variant-visibility-gate.test.ts:95-127`: Default selection passes `eye` / hides `eye-mask` at the
  snapshot level (both `drawable.visible` and `drawList` asserted), and the gated render differs from
  the ungated (groups-free) baseline. The two fixtures differ *only* in the presence of the Variant
  Group (`perception-fixtures.ts:214-245` reuses the same two drawables/textures), so the byte diff is
  attributable to the gate.
- Probe P1 (predicate→identity) turned the snapshot-visibility + render-diff assertions red, proving
  they are not vacuous.

### 3. Override + invalid-mode reject — **pass**
- `variant-visibility-gate.test.ts:129-170`: Alt selection flips the passing set (`eye-mask` visible,
  `eye` hidden) AND `altPng ≠ defaultPng` (same fixture — the diff is purely the gate). Probe P1 broke
  `altPng ≠ defaultPng`, so this is the strictest gate-attribution assertion in the suite.
- `singleSelect + multiple variants` is structurally impossible (the discriminated union gives
  singleSelect a single `variantId`), so the "singleSelect with multiple" clause of plan §6 is enforced
  by the schema shape (`ai-variant-selection.ts:35-50`); the mode-mismatch reject
  (multiToggle-against-singleSelect) is covered at `variant-visibility-gate.test.ts:205-221` and
  `variant-selection-resolution.test.ts:151-171`.

### 4. Unknown group / variant deterministic reject (no silent default fallback) — **pass**
- Covered at three layers: resolver unit (`variant-selection-resolution.test.ts:117-186`), gate
  integration (`variant-visibility-gate.test.ts:172-222, 311-326`), and ref level
  (`ref-e2e.test.ts:459-478`).
- Probe P2a (silent-fallback on unknown group / mode mismatch) reddened 7 tests; Probe P2b
  (silent-fallback on unknown variant id) reddened both the resolver unit test AND the ref e2e
  "rejects an unknown variant reference … does not silently fall back to default" test. The
  no-silent-fallback contract is genuinely enforced end to end.

### 5. Sidecar selections record (default / explicit / empty) — **pass**
- Default + explicit: `variant-visibility-gate.test.ts:224-258`; on-disk default:
  `render-view-file-output.test.ts:76-113`; empty: `variant-visibility-gate.test.ts:86-92`; schema
  round-trip incl. empty array + pre-revision back-compat: `ai-variant-selection.test.ts:103-139`.
- Probe P4 (resolved echo → `[]`) reddened the default + explicit gate sidecar tests and the on-disk
  file-output test. Non-vacuous.

### 6. Measurement visibility flag (hidden drawable → geometry present, flag false) — **pass**
- `variant-visibility-gate.test.ts:260-292`: gated-hidden `eye-mask` returns `found:true`,
  `visible:false`, `hasBounds:true`; visible `eye` returns `visible:true`; result echoes the resolved
  outfit. Empty-package case at `:294-309`.
- Probe P3 (`visible: true` hard-coded) reddened this test, proving the flag reflects the real gated
  visibility rather than a constant.

### 7. ref e2e 6/9, data-derived + vacuous-pass guard — **pass**
- `ref-e2e.test.ts:397-426`: `expectedDefaultPass` is computed at runtime from
  `ref/model/variants.json` memberships (`targetsPassingVariant`, `:148-153`) — the same rule the pure
  predicate applies — NOT transcribed from the prompt. The headline numbers are hard-guarded
  (`expect(expectedDefaultPass.size).toBe(6)` / `expect(expectedDefaultBlocked).toHaveLength(9)`), so a
  future variants.json drift or an empty membership read fails loudly instead of passing vacuously.
- The OBSERVED set comes from the gated snapshot via `inspectEvaluatedGeometry` (`measureVisibleTargets`,
  `:176-196`) — the same gated snapshot the render consumes — and is asserted equal to the
  data-derived set. Probe P1 (predicate→identity) and Probe P3 (measurement flag→true) both reddened
  this test, confirming it observes the *gated* world, not the raw runtime snapshot. Override
  (`:428-457`) additionally asserts Rodos's set differs from Default (`.not.toEqual`), guarding against
  "re-rendered the same outfit".

### 8. Determinism (2× byte-identical) — **pass**
- Retained at `ref-e2e.test.ts:301-311` (fresh-dir re-render byte-identical) and
  `render-view-file-output.test.ts:54-74, 100-113` (cross-run byte-identical incl. sidecar content sans
  the legitimately per-run `pngPath`). The selection serialization is sorted by `variantGroupId`
  (`variant-selection-resolution.ts:121-124`) so it does not perturb determinism — the on-disk test
  proves this.

### 9. Non-regression — **pass**
- `apps/authoring-host` perception suites (60 tests across gate/resolver/file-output/measurement/render
  /texture) green; `ai-interface` variant schema (15) green; ref e2e (7) green after every probe was
  restored. (I did not re-run the full render-software suite — the gate touches no render-software code
  and the Gnome report records 37/37; this is the one item I took on report + inspection rather than
  independent execution — see Questions.)

## The gap (needs_fix)

**`modelEvaluatedBounds` visible-only framing has no guarding test.**
- Location: `apps/authoring-host/src/perception/evaluated-bounds.ts:121-128` (the
  `.filter((drawable) => drawable.visible)` on the model-bounds union), consumed by
  `view-resolution.ts:57-59` for default / `modelBounds` framing.
- Probe P5: I reverted the filter to union ALL drawables (the pre-Wave105 behaviour). **All 45
  perception tests AND all 7 ref e2e tests stayed green.** Nothing fails.
- Why it matters: this is exactly the behavioural change plan §3.1 requires ("framing shares the same
  visibility world") and §9 lists as a requirement ("目と巻尺が同じ可視性世界を見る … drawableFocus /
  modelBounds bbox"). The Gnome report §5 claims it tightened ref framing 392→389 and §8/§Questions
  explicitly asks the reviewer to confirm the reading — but no test locks it. The composite fixture
  cannot catch it (eye + eye-mask overlap the same region, so hiding one does not shrink the union),
  and ref e2e writes PNGs to a fresh/worktree dir and only asserts *determinism* (2× identical), never
  comparing against a committed golden — so a framing regression would silently repaint the gate PNGs
  and pass.
- Direction of fix (small, additive; no impl change): add one assertion that the model-bounds framing
  (or `modelEvaluatedBounds` directly) over the composite Variant fixture is TIGHTER under a selection
  that hides a spatially-distinct drawable than over the ungated baseline — i.e. a fixture where the
  Default-hidden drawable extends the union, so visible-only vs union-all produces different bounds.
  The current eye/eye-mask fixture will not exercise it (co-located); the fixture needs one gated
  drawable placed outside the other's bbox. Alternatively, a direct unit test on `modelEvaluatedBounds`
  feeding a hand-built snapshot with one `visible:false` drawable outside the visible union, asserting
  the returned rect excludes it. Either closes the gap without touching production code.

## Secondary observations (not blocking)

- The composite fixture mutates `base.session.graph.variantGroups` by direct assignment
  (`perception-fixtures.ts:234`) rather than through an operation-core commit. It is parsed through
  `VariantGroupSchema` first so group invariants hold, and this is test-support only — acceptable, and
  it keeps the fixture from depending on a variant-editing operation that is explicitly out of scope
  (plan §12). Noted for awareness, not a defect.
- ref e2e reject test uses `.rejects.toThrow()` (any throw) rather than asserting the
  `VariantSelectionResolutionError` type, because the error crosses the command boundary and is
  surfaced as a rejected response. The unit + gate layers already pin the specific error type, so the
  ref layer asserting "throws at all" is adequate.

## Probes (all restored — residue-zero proof)

| # | Mutation (temporary) | File | Tests that reddened | Restored |
|---|---|---|---|---|
| P1 | predicate → identity (`&& true`) | `evaluation-adapter.ts` | gate suite: 5 (default pass/block, override flip, altPng≠defaultPng, measurement flag); ref e2e 6/9 (via P3-shaped path) | yes |
| P2a | unknown-group + mode-mismatch reject → `continue` (silent) | `variant-selection-resolution.ts` | 7 (resolver rejects + gate reject + measurement reject) | yes |
| P2b | unknown-variant-id reject → `continue` (silent) | `variant-selection-resolution.ts` | resolver unit + ref e2e "does not silently fall back to default" | yes |
| P3 | measurement `visible: drawable.visible` → `visible: true` | `measurement-command.ts` | gate measurement-flag test + ref e2e 6/9 | yes |
| P4 | sidecar resolved echo → `[]` | `render-view-command.ts` | gate sidecar default+explicit + on-disk file-output | yes |
| P5 | `modelEvaluatedBounds` visible-only → union-all | `evaluated-bounds.ts` | **NONE (this is the gap)** | yes |

Residue-zero proof:
- `git diff | grep -c PROBE` → `0`; `grep -rl "PROBE:" apps/authoring-host/src packages/ai-interface/src`
  → NONE.
- After restoring P5 I re-ran the full ref e2e suite (7/7 green) so the worktree gate PNGs/sidecars are
  the correct visible-only versions; confirmed `ref-rest-full.render-view.json` records
  `outputWidth: 389` (the visible-only framing, matching Gnome §5) — proving the P5 probe did not leave
  a union-all (392) PNG/sidecar in the worktree.
- `git status --porcelain` for the probe-touched files shows only the expected Wave105 Gnome
  modifications (`M` on the four edited files, `??` on the new resolver) — no probe-introduced files or
  reverted-but-different content. Post-probe unit suites (60) + ai-interface (15) + ref e2e (7) all
  green.

## Questions (for Orch-Sylph)

1. **Scope of the fix**: closing the P5 gap needs a *new/extended fixture* (a gated drawable placed
   outside the visible union's bbox) or a *direct `modelEvaluatedBounds` unit test*. Both are additive
   (no production change) and within Domain A's allowed write scope
   (`apps/authoring-host/**` tests + `perception-fixtures.ts`). Confirm you want this returned to Gnome
   as a narrow test-only follow-up rather than a full re-delegation.
2. **render-software non-regression**: I did not independently re-run the render-software suite (the
   gate touches no render-software code; Gnome reports 37/37). If you want independent execution of that
   suite as part of this lane, say so and I will run it.
