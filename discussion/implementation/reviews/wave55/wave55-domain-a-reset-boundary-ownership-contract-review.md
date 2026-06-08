# Wave55 Domain A Review: Reset Boundary / Ownership Contract

> Role: independent Review-Sylph / clean context  
> Target report: `discussion/implementation/waves/wave55/wave55-domain-a-reset-boundary-ownership-contract-report.md`  
> Verdict: `pass`

## Verdict

`pass`

Domain A の境界/所有契約レポートは、Wave55 B-F 開始前に必要な ownership matrix、shared file fences、G integration contract、UX AC checklist、focused regression target、batching judgment、user-decision points を満たしている。

## Scope Reviewed

- 対象レポート本文。
- 指定された orchestration / context hygiene skill。
- Wave55 plan、Wave54 final report/review。
- UI Reset inventories、screen-design docs、capability map、backlog、source file organization policy。
- source implementation や広域 source/diff/test log 棚卸は行っていない。

## Blocking Findings

なし。

## Non-Blocking Observations

- Domain A レポートは source implementation を行わない役割を明記し、source reads を ownership / contract confirmation に限定している。レポート自体も source/test/script/package/lockfile/fixture/generated asset の編集なしを明記しているため、Domain A gate としては妥当である。
- `current-capability-map.md` と `remaining-work-backlog.md` には Wave54 Domain J 未完了の古い記述が残っているが、Wave55 plan と Wave54 final report/review は Wave54 final `pass` を示している。Domain A はこの差分を Domain I docs refresh 対象と扱っており、B-F 開始 blocker にはしていない。この判断は妥当である。
- `apps/editor/src/styles/editor.css` は monolithic conflict point として扱われている。Domain A は C-only selector ownership、新CSSファイル化してGがlink/order、またはCSS-bearing domains sequential の三択を明示しており、B-F実行時の衝突管理として十分である。

## Review Checks

### 1. Domain A Source Implementation

`pass`

レポートは Domain A を boundary / ownership contract 作成に限定し、source implementation は行わないと明記している。Minimal Source Boundary Facts は source facts の狭い確認であり、実装差分や修正指示ではない。Orch-Sylph自身がsource実装しないという orchestration policy と整合している。

### 2. B-F Ownership Matrix / Shared File Fences

`pass`

B/C/D/E/F は主要責務と do-not-touch が分かれている。

- B: Primary Human Shell。final `app-shell.ts` mount、`editor-app.ts`、`task-shell.ts`、PSD content を触らない。
- C: Task Window overlay UX。PSD-specific content、final app-shell routing、quarantine、e2e registryを触らない。
- D: PSD Import clean task。parser/workflow semantics、task shell、final routing、e2e registryを触らない。
- E: Legacy / Debug quarantine。final support-region removalはG、full Diagnostics/Codex migrationやPSD contentは触らない。
- F: UX focused e2e gate。production behaviorやCSS/DOMをtest pass目的で変えない。

Shared file fences は `app-shell.ts`、`editor-app.ts`、`app-shell.test.ts`、`index.html`、final stylesheet wiring を G に予約している。`index.ts` を barrel-only とする source-file-organization policy も明記されている。

### 3. G Integration Contract

`pass`

G は central cutover owner として、B Primary Shell、C overlay/window host、D PSD clean content、E quarantine、final CSS ordering/linking、integration/unit/e2e proof を統合する責務を持つ。レポートは `G owns the central cutover and must not be pushed into Undine/root` と明記しており、Undine/root に source棚卸やsource統合を要求していない。

### 4. UX AC Checklist

`pass`

Wave55必須条件は checklist に入っている。

- startup first viewport で `authoring-workspace-support` と legacy/debug/evidence/Codex-heavy content を出さない。
- Toolbox から PSD Import を開いても document scroll jump を起こさない。
- desktop/mobile で task window の header/title/Back/Close/primary action が viewport 内にあり、long content は window 内で scroll する。
- `role=dialog`、`aria-modal`、`data-task-window-*`、surface metadata、focus、screenshot `base64Length` だけでは pass 不可。
- `Task Summary`、raw refs、`psd:root/...`、operation IDs、approval IDs、plan/candidate digests、diagnostics IDs、evidence paths、generated refs、command payloads、raw parser payloads、route IDs、`data-testid`、test-selector strings は primary human UI に出さない。
- Review-Sylph は visual/geometry/no-scroll/first-viewport checks がない UX pass claim を `needs_fix` にする。

### 5. Focused Regression Targets

`pass`

Required new/focused target として `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused` または exact A/F-approved equivalent が明記されている。さらに `taskWindowUxFocused` は desktop/mobile geometry、no-scroll、forbidden primary text assertions を含める必要があると明記され、`taskWindowRoutingFocused` は route semantic smoke に留められている。

### 6. B-F Batch Judgment

`pass`

B/C/D/E の component work は file fences の下で並列化できる。一方、F は B/C/D/E の主要 DOM/class/testid 契約後に gate definition を行い、final pass は G/H integration evidence で確認する性質がある。`editor.css`、`app-shell.ts`、`app-shell.test.ts` が物理衝突点であること、central cutover を G に寄せる必要があることから、B-F全件同時ではなく 2a / 2b / 3 に分ける判断は妥当である。

### 7. Blocking User Decision Before B-F

`pass`

B-F開始前の blocking user decision は残っていない。Wave55 plan の accepted decisions と Domain A の v0 defaults で、PSD Import は workspace-scoped overlay/window UX、`Task Summary` は primary human UI 不許可、legacy/debug quarantine は non-primary、Product Preflight full detail は primary外、という実装可能な境界が固定されている。

Deferred decisions は final all-tool policy、final quarantine form、Product Preflight final owner、次にpromoteするauthoring workflowであり、B-F開始前 blocker ではない。

## Verification Performed

- 必須参照文書を読み、対象レポートの claims と照合した。
- `discussion/implementation/reviews/wave55/wave55-domain-a-reset-boundary-ownership-contract-review.md` は新規作成前に未存在であることを確認した。
- 対象 Domain A report は未tracked file として確認した。
- source/test/script/package/lockfile/fixture/generated asset の変更、実装、広域diff棚卸、test log棚卸は行っていない。

## User-Decision Points

Blocking before B-F: none.

Deferred / non-blocking:

- final all-tool policy: modal overlay vs non-modal floating window vs docked drawer vs dedicated view。
- final legacy quarantine form: explicit route、dev-only drawer、removable build-time surface。
- final Product Preflight owner: Validation task vs Diagnostics/Evidence detail。
- next authoring workflow to promote after PSD Import proves the reset pattern。
