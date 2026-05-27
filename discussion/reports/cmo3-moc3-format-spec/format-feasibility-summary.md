# CMO3 / MOC3 Format Feasibility Summary

> Status: Superseded research summary
> Original synthesis date: 2026-05-24
> Current policy update: Private 2D Rigging Lab / Prototype baseline
> Positive input: `memo/new_concept.md`

## 1. Current Bottom Line

This report is no longer an implementation planning document.

The previous local-use policy allowed possible `.model3.json` / `.moc3` runtime intake through a locally supplied official Cubism SDK/Core. That policy is superseded.

Current project policy:

- The project will not use Cubism SDK/Core.
- The project will not load Cubism models.
- The project will not inspect `.model3.json`, `.moc3`, `.cmo3`, `.physics3.json`, `.motion3.json`, or `.pose3.json`.
- The project will not parse, convert, reconstruct, or round-trip Cubism formats.
- The private prototype uses only rights-clean source artwork and the project-defined model package.
- Existing Live2D / Cubism research is retained only as private research archive for risk confirmation, non-compatibility statements, and scope exclusion decisions.
- Any future Cubism SDK/Core or Cubism format research must be reopened as a separate permission, legal, and scope review track.

## 2. Superseded Local-use Policy

The following earlier direction is explicitly no longer active:

- local-only tool operation as a reason to use SDK/Core;
- `.moc3` runtime intake through a locally installed or user-provided official SDK/Core;
- adapter isolation for SDK/Core;
- fallback inspection of `.model3.json` and companion JSON/package structure;
- runtime package intake scenarios based on existing Cubism model assets.

These ideas must not be treated as current MVP scope, active design input, fixture source, implementation dependency, or acceptance criterion.

## 3. Historical Research Facts

The historical research remains useful only for explaining why the project avoids Cubism formats.

- `.cmo3` is associated with Cubism Editor authoring project data.
- `.moc3` is associated with runtime model data loaded by Cubism Core.
- `.model3.json` is a runtime settings file that links `.moc3`, textures, physics settings, and related runtime assets.
- Public SDK documentation describes runtime loading paths for `.moc3`, not an authoring-state reconstruction path.
- Public companion JSON specs do not make `.moc3` or `.cmo3` safe implementation targets for this project.
- Public reverse-engineered tooling and format notes are not official specifications and must not become implementation basis.

These are historical observations, not current implementation permissions.

## 4. Current Scenario and AC Implications

For current Private 2D Rigging Lab planning:

- Intake scenarios must start from rights-clean source artwork, not Cubism model packages.
- MVP validation fixtures must use project-defined packages, not `.model3.json` / `.moc3` / `.cmo3` assets.
- Runtime preview and viewer work must evaluate the project-defined model package through the private runtime core.
- Reports under `discussion/reports/cmo3-moc3-format-spec/` must not be passed to implementation agents as runtime oracle, UI specification, parser task, or fixture source.
- If an old scenario references `.cmo3`, `.moc3`, `.model3.json`, companion JSON, SDK/Core loading, or existing Cubism model intake, that scenario is a migration follow-up and not current source of truth.

## 5. Allowed Uses of This Report

Allowed:

- explaining why Cubism format intake is out of scope;
- supporting non-compatibility statements;
- identifying old documents that need migration;
- checking that demo/proposal material does not imply Cubism format support.

Not allowed:

- implementing SDK/Core adapter code;
- loading or inspecting existing Cubism model packages;
- using official or third-party Cubism samples as fixtures;
- deriving project model schema from Cubism files;
- using reverse-engineered format notes as a parser or serializer plan;
- showing format details in streaming demos.

## 6. Follow-up

Needed follow-up outside this P0 update:

1. Rewrite active intake scenarios that still mention Cubism project/runtime package intake.
2. Update any Domain AC that still treats existing model package intake as current scope.
3. Add a dedicated streaming demo policy that bans visible Cubism format strings and existing model assets.
4. Keep `sdk-web-local-loader-plan.md` marked as historical/superseded and out of implementation input.
