# UI Reset Inventory: Primary UI Quarantine

Status: inventory / Wave55 planning input
Date: 2026-06-08
Owner role: UI Reset Inventory A Sylph

## Scope

この棚卸は、現在の Editor UI から「Primary Human UI に出してはいけないもの」を分離するための調査である。source 実装の変更は行っていない。

対象は主に以下。

- `apps/editor/src/ui/**`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/editor.css`
- `discussion/design/screen-design/**`
- Wave54 最終報告とレビュー

この文書での「消す」は、実装削除ではなく「通常導線の Primary UI から外す」ことを意味する。状態接続、callback、test/evidence 観測は、別 route / debug surface / structured test harness に移して維持する前提で扱う。

## Verdict

Primary Human UI の最大の汚染源は、`createAuthoringWorkspacePrimaryLayout(...)` の直後に `createWorkspaceSupportRegion([...])` で legacy/debug/Codex/evidence-heavy panels を通常 UI と同じ画面に並べている構造である。

Wave55 では、Primary shell の通常導線から `authoring-workspace-support` 全体を外し、必要な状態接続は以下へ隔離するべきである。

- Human primary: App Bar, Toolbox launcher, Structure/Parts, Canvas/Preview, Inspector, Parameter Bar, Diagnostics Strip, active task window
- Diagnostics/Evidence: operation log, generated evidence, package file set, reload summary, runtime snapshot/diff, Product Preflight detail, PSD/source evidence
- Codex/Automation: Codex Proposal Review, AI Approval, AI Transcript, command/proposal transcript
- Legacy/debug route: callback 保持と調査用の旧パネル群
- Dedicated task/view routes: PSD Import, Source Intake, Project Storage, Validation/Product Preflight, Tutorial, Viewer/Runtime

## Repository Facts

- `apps/editor/src/app/editor-app.ts` は `activeTask: "psdImport" | "diagnosticsEvidence" | "codexAutomation" | null` を持ち、PSD Import / Diagnostics Evidence / Codex Automation の task window を開く callback を `createEditorAppShell(...)` に渡している。
- `apps/editor/src/ui/app-shell/app-shell.ts` は primary layout、active task window、legacy support panels を同じ workspace に append している。
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts` の `createWorkspaceSupportRegion()` は `data-shell-group="legacy-support"` を付けるが、画面上は Primary と同じ workspace 内に見える。
- `apps/editor/src/styles/editor.css` は `.authoring-workspace-support`、`.editor-panel`、`.project-persistence-panel`、`.product-preflight-panel`、`.editor-persistence-grid` を通常の UI panel として見えるようにスタイルしている。
- screen design docs は、Human UI、debug/evidence、Codex-facing surface、test-facing surface の分離を明示している。特に operation ID、digest、generated ref、evidence path、package file set、reload summary、raw diagnostics は通常 UI から分ける方針である。
- Wave54 は route/surface 分離 v0 の骨格を通したが、legacy support panels の full migration は future work として残っている。

## Primary UI から消すべき既存パネル/表示

| 現行パネル/表示 | 主なファイル | Primary から外す理由 | 推奨隔離先 | 主な実装リスク |
|---|---|---|---|---|
| Workspace support region 全体 | `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`, `apps/editor/src/ui/app-shell/app-shell.ts`, `apps/editor/src/styles/editor.css` | legacy/debug/Codex/evidence-heavy panels を通常 UI として見せてしまう。Primary shell 再設計の妨げになる。 | Legacy/debug route。通常導線では非表示。 | panel 内 callback が大量に残っている。既存 unit/e2e が visible DOM を前提にしている。 |
| Operation Log Summary | `apps/editor/src/ui/evidence-panel/operation-log-summary-panel.ts` | Operation ID、operation type、surface、timestamp、target IDs は evidence/test 観測であり Human primary ではない。 | Diagnostics/Evidence route | persistence smoke など多数の e2e がこの表示を読む。 |
| Generated Evidence Summary | `apps/editor/src/ui/evidence-panel/generated-evidence-summary-panel.ts` | runtime snapshot ID、state path、sequence path、validation report ID/path は evidence details。 | Diagnostics/Evidence route | evidence path の可視性を失うとテストと調査が困るため、route 側で維持が必要。 |
| Package File Set | `apps/editor/src/ui/package-file-set/package-file-set-panel.ts` | package file path、generated evidence file、operation log path は通常作業に不要な実装詳細。 | Diagnostics/Evidence route / Project Storage detail | package persistence 系テストが path 表示に依存している。 |
| Reload Summary | `apps/editor/src/ui/package-file-set/reload-summary-panel.ts` | reload file path、committed parameter IDs は primary UX ではない。 | Diagnostics/Evidence route / Project Storage detail | reload/persistence の観測点を別 route に移す必要がある。 |
| Product Preflight full panel | `apps/editor/src/ui/product-preflight/product-preflight-panel.ts` | report ID、package ID、revision、category counts、evidence refs、diagnostic refs、blocking/warning/not-supported details が通常 UI には重すぎる。 | Validation/Product Preflight task または Diagnostics/Evidence detail | Primary に残すべき compact diagnostics strip と full detail の責務分割が必要。 |
| Product Preflight comparison/detail | `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts` | deterministic report comparison、evidence refs、diagnostic refs、rerun details は debug/evidence surface。 | Diagnostics/Evidence route / Validation detail | preflight diff smoke が現在の表示に依存している。 |
| Codex Proposal Review | `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts` | proposal JSON、operation list、validation、diff、approval/commit は Codex-facing workflow。Human primary に置くと作業 UI を占有する。 | Codex/Automation route | proposal review smoke と approval flow の callback を移す必要がある。 |
| AI Approval | `apps/editor/src/ui/ai-approval/**` | command ID、operation ID、dry-run/approve/reject/commit、latest AI event は Codex/automation surface。 | Codex/Automation route | AI approval callbacks が primary から消えるため route 側で保持する必要がある。 |
| AI Transcript | `apps/editor/src/ui/ai-transcript/**` | operation ID、evidence、command ID、operation log link は transcript/debug 内容。 | Codex/Automation route | smoke-checks が transcript text と status を見る。 |
| Viewer / Runtime support panel | `apps/editor/src/ui/viewer-runtime/**`, `apps/editor/src/ui/app-shell/app-shell.ts` | runtime snapshot/diff、validation diagnostics、rig/mask/part/drawable/mesh/dynamics evidence を support panel として常時表示するのは Primary ではない。 | Viewer/Runtime dedicated view。raw evidence は Diagnostics/Evidence。 | Viewer toggle は `activeTask` とは別の state で動いている。route 化時に状態管理の整理が必要。 |
| Project Persistence full panel | `apps/editor/src/ui/project-persistence/project-persistence-panel.ts` | save/load/export/import 自体は UX 候補だが、storage keys、persistent bytes、bundle issue codes、transport details は primary ではない。 | Project Storage task/detail。Primary は compact save state/action のみ候補。 | storage 操作 callback を失わないよう task 化が必要。 |
| Project Transport Capability | `apps/editor/src/ui/project-persistence/project-transport-capability-section.ts` | IndexedDB/file transport capability や内部 status は debug/support 情報。 | Project Storage detail / Diagnostics | browser capability 表示に依存するテストがあれば移設が必要。 |
| Source Intake panel | `apps/editor/src/ui/source-assets/**` | source profile、adapter、canvas、byte length、storage truth、rights/provenance、imported source diagnostics/evidence は import task/detail。常時 primary ではない。 | Source Intake task / PSD Import task / Diagnostics detail | source intake callback と imported source state の置き場が必要。 |
| Explicit PSD Import task の advanced/evidence sections | `apps/editor/src/ui/psd-import/explicit-psd-import-panel.ts` | PSD Import task 自体は route でよいが、Advanced Workflow Controls、Evidence Boundary、full refs/diagnostics は Human task の primary content ではない。 | PSD Import task の secondary/debug section、Diagnostics/Evidence | PSD focused tests が stable test IDs と workflow text に依存している。 |
| Tutorial Workflow panel | `apps/editor/src/ui/tutorial/tutorial-workflow-panel.ts` | recipe/readiness/evidence target/steps/non-goals は tutorial task の内容であり、通常 workspace support ではない。 | Tutorial task route | tutorial persistence smoke が現在の panel 表示を読む可能性。 |
| Drawable Authoring panel | `apps/editor/src/ui/drawable-authoring/**` | drawable create/update、mesh topology/vertex/canvas、duplicate drawable list が大量にあり、Primary UX の正解ではない。 | Drawable/Mesh active tool route or Inspector/Tool Panel。legacy fallback は debug route。 | callback が多い。`drawable.list` の重複で tests/implementation が誤対象を掴む。 |
| Rig Control panel | `apps/editor/src/ui/rig-control/**` | project-defined rig controls、warp lattice drafts、bind/keyform forms、runtime evidence は active tool/detail。常時 primary ではない。 | Rig active tool / Inspector / Diagnostics detail | rig persistence smoke と runtime evidence 表示に依存がある。 |
| Dynamics panel | `apps/editor/src/ui/dynamics/**` | create/update dynamics、preview run/reset、computed output、runtime/validation evidence は active tool/detail。 | Dynamics active tool / Viewer / Diagnostics detail | dynamics preview/run callback と evidence observation を分ける必要。 |
| Composition panel | `apps/editor/src/ui/composition/**` | mask/opacity forms、keyform lists、runtime evidence、operation diagnostics は active tool/detail。 | Composition/Drawable Inspector / Diagnostics detail | composition persistence tests が visible text を読む。 |
| Legacy Parameters / Operation panels | `apps/editor/src/ui/parameter-operation/**`, `apps/editor/src/ui/app-shell/app-shell.ts` | full parameter list/create operation panel は Primary ではなく Parameter Manager / Inspector / Parameter Bar の責務。operation-oriented display は debug 寄り。 | Parameter Manager task、Inspector、Diagnostics | create parameter callback と operation status 表示の移設が必要。 |
| Preview summary の evidence/diff-heavy subdetails | `apps/editor/src/ui/preview/preview-summary.ts`, `apps/editor/src/ui/preview/**` | Canvas/Preview は Primary に必要だが、Snapshot、Mesh evidence counts、texture fallback diagnostics、Diff details は primary visual editing を圧迫する。 | Preview の compact status、詳細は Diagnostics/Evidence / Viewer | preview/mesh/topology tests が summary text に依存している可能性。 |

## Legacy / Debug Route へ隔離すべきもの

### Legacy Support Route

旧 UI を callback 保持・比較・調査目的で残すなら、Primary ではなく legacy/debug route に隔離する。

対象候補:

- `parametersPanel`
- `operationPanel`
- `drawableAuthoringPanel`
- `sourceIntakePanel`
- `projectPersistencePanel`
- `productPreflightPanel`
- `tutorialWorkflowPanel`
- `viewerRuntimePanel`
- `compositionPanel`
- `rigControlPanel`
- `dynamicsPanel`
- `codexProposalReviewPanel`
- `aiApprovalPanel`
- `aiTranscriptPanel`
- `persistencePanel`

実装判断としては、これらを削除するより先に「通常 route から mount しない」ことを AC にするのが安全である。

### Diagnostics / Evidence Route

既に Wave54 で skeleton route があるため、以下はここへ集約する。

- Operation log summary
- Generated evidence summary
- Package file set
- Reload summary
- Product Preflight full detail and comparison
- Runtime snapshot / runtime diff
- Validation diagnostics
- PSD Import evidence boundary
- Source intake imported source evidence
- Preview/mesh/rig/dynamics/composition evidence summaries
- Evidence paths, generated refs, source refs, operation IDs, command payloads

### Codex / Automation Route

既に Wave54 で skeleton route があるため、以下はここへ集約する。

- Codex Proposal Review
- AI Approval
- AI Transcript
- Proposal JSON/diff/validation
- Dry-run/approve/reject/commit command surface
- Command ID, operation ID, evidence-count oriented transcript

### Dedicated Human Task / View Routes

Primary の常時 support panels ではなく、launcher から開く task/view として扱う。

- PSD Import task: `apps/editor/src/ui/psd-import/explicit-psd-import-panel.ts`
- Source Intake task: `apps/editor/src/ui/source-assets/**`
- Project Storage task: `apps/editor/src/ui/project-persistence/**`
- Validation/Product Preflight task: `apps/editor/src/ui/product-preflight/**`
- Tutorial task: `apps/editor/src/ui/tutorial/**`
- Viewer/Runtime view: `apps/editor/src/ui/viewer-runtime/**`

## Primary UI に残す候補

残す候補は、現行 UI があるからではなく、screen design docs 上の Human authoring workflow に必要なものだけに限定する。

| Primary candidate | 主なファイル | 残す理由 | 注意点 |
|---|---|---|---|
| App Bar / package status | `apps/editor/src/ui/app-shell/app-shell.ts`, `apps/editor/src/ui/app-shell/package-status.ts` | project/package の現在地、保存状態、primary task launcher は必要。 | package ID/revision や workflow status が evidence/debug 表現になりすぎないよう compact にする。 |
| Toolbox launcher | `apps/editor/src/ui/app-shell/toolbox-surface.ts`, `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts` | tool/task/view の起点は Primary に必要。 | Toolbox 内に作業 UI を置かない。disabled reason が legacy support panels を正解扱いしないこと。 |
| Structure / Parts Tree | `apps/editor/src/ui/app-shell/parts-tree-surface.ts`, `apps/editor/src/ui/layer-tree/**` | part/drawable hierarchy、selection、visibility/lock、draw order は authoring の中核。 | 現行の create/update/assignment mega form をそのまま UX 正解にしない。`drawable.list` duplicate を排除または route scope 化する。 |
| Canvas / Preview | `apps/editor/src/ui/preview/**` | visual editing target と即時 preview は Primary に必要。 | evidence/diff-heavy summary は詳細 route へ逃がす。 |
| Inspector | `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts` | selected part/drawable/tool の contextual controls と summary は Primary に必要。 | legacy panel の全機能を Inspector に丸ごと詰め込まない。active selection/context に限定する。 |
| Parameter Bar | `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts` | active parameter の調整・key marker は primary authoring の基本操作。 | `debugOverride` のような debug 表現は通常 UI から外す。Quick Create/Manager は route/callback 実装が必要。 |
| Diagnostics Strip | `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts` | blocking/warning count と top issues は Primary に必要。 | Details button を Diagnostics/Evidence route に接続する。full diagnostics をここに展開しない。 |
| Active task window shell | `apps/editor/src/ui/app-shell/task-shell.ts`, `apps/editor/src/ui/app-shell/app-shell.ts` | PSD Import / Diagnostics / Codex などを primary workspace 上で一時的に開く shell は有効。 | task を開いた時だけ mount する。legacy panels を常時 support として並べない。 |

## 現行 UI が Gnome を誤誘導しそうな箇所

1. `createWorkspaceSupportRegion()` が primary layout の直後に置かれている。
   - `apps/editor/src/ui/app-shell/app-shell.ts`
   - `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
   - 見た目上、legacy panels が通常 authoring workspace の一部に見える。

2. Toolbox の disabled reason が support panels を正規導線のように示している。
   - `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
   - 例: `Detailed controls are in support panels`, `Available in support panels`
   - これは Wave55 以降の実装者に「support panels を残すべき」と誤読されやすい。

3. CSS が legacy/debug panels を通常カードとして見せている。
   - `apps/editor/src/styles/editor.css`
   - `.authoring-workspace-support`, `.editor-panel`, `.project-persistence-panel`, `.product-preflight-panel`, `.editor-persistence-grid`
   - 視覚上の完成度が、UX 判断の根拠に見えてしまう。

4. Diagnostics/Codex skeleton route があるのに、同じ内容の full legacy panels が primary に残っている。
   - `apps/editor/src/ui/app-shell/app-shell.ts`
   - Gnome が skeleton route だけ整えて、primary clutter を残すリスクが高い。

5. Duplicate selector / duplicate surface が存在する。
   - `apps/editor/src/ui/app-shell/parts-tree-surface.ts`
   - `apps/editor/src/ui/drawable-authoring/**`
   - `drawable.list` が Parts Tree と legacy Drawable Authoring の両方に現れ、tests や実装が間違った list を対象にする恐れがある。

6. `apps/editor/src/ui/app-shell/app-shell.test.ts` の現行テストが「existing panels を named shell surfaces に分類し、workflow を動かさない」ことを確認している。
   - これは Wave54 の互換 AC としては正しいが、Wave55 では「primary から消す」AC に置き換える必要がある。

7. Viewer button が dedicated view ではなく support panel 表示に見える。
   - `apps/editor/src/ui/app-shell/app-shell.ts`
   - `apps/editor/src/ui/viewer-runtime/**`
   - screen design 上は view/screen であり、support panel 維持の理由にしてはいけない。

8. PSD Import task は route 化済みだが、content 内に Advanced Workflow Controls / Evidence Boundary が残っている。
   - `apps/editor/src/ui/psd-import/explicit-psd-import-panel.ts`
   - task route に入っただけでは Human UI と debug/evidence の分離が完了したとは言えない。

9. Parameter Bar / Preview summary に debug/evidence 語彙が漏れている。
   - `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts`
   - `apps/editor/src/ui/preview/preview-summary.ts`
   - `debugOverride`, `Mesh evidence`, runtime diff などは Primary の通常表示としては要注意。

## Wave55 で「通常 UI から消す」AC にすべき観点

1. 初期表示の Primary shell は `authoring-workspace-support` を mount しない。

2. 初期表示の visible DOM に、少なくとも以下の legacy/debug/Codex/evidence headings が出ない。
   - `Operation log`
   - `Generated evidence`
   - `Package file set`
   - `Reload summary`
   - `Codex Proposal Review`
   - `AI Approval`
   - `AI transcript`
   - `Product Preflight` の full detail
   - `Project Persistence` の full panel
   - `Transport capability`
   - `Source Intake`
   - `Drawable Authoring`
   - `Rig Control`
   - `Dynamics`
   - `Composition`
   - `Tutorial Workflow`
   - `Viewer / Runtime` の full evidence panel

3. Diagnostics/Evidence route だけが operation log、generated evidence、package file set、reload summary、runtime snapshot/diff、Product Preflight detail、PSD/source evidence を表示する。

4. Codex/Automation route だけが Codex Proposal Review、AI Approval、AI Transcript、proposal JSON/diff/approval command を表示する。

5. Toolbox は launcher に限定する。disabled reason や status text で legacy support panels を正規導線として参照しない。

6. Viewer/Runtime は dedicated view として開く。Primary support region に full runtime/evidence panel を常時出さない。

7. Primary に残る Diagnostics Strip は compact summary のみとし、詳細 button は Diagnostics/Evidence route へ接続する。

8. Primary に残る Canvas/Preview は visual editing と最小限の状態に限定し、raw evidence/diff/path/ID details を表示しない。

9. E2E/unit tests は「legacy panel が primary にあること」ではなく、以下を検証する。
   - Primary から消えていること
   - 隔離 route で必要な evidence/debug/Codex state が観測できること
   - callback が route 移動後も動くこと
   - duplicate selectors を route/surface scope で誤取得しないこと

10. `data-testid` は必要なら維持するが、Primary UX の存在理由にしない。test-facing surface は Human primary から独立させる。

## Implementation Risks

### Callback disconnection

現在の support panels は、ただの表示ではなく操作 callback の所有者でもある。

影響候補:

- parameter create/update
- drawable create/update
- mesh/topology/vertex editing
- source intake and import commit
- project save/load/export/import/reset
- Product Preflight run/rerun
- rig control / warp lattice / keyform operations
- dynamics preview/reset/update
- composition mask/opacity operations
- Codex proposal approve/commit
- AI dry-run/approve/reject/commit

対策は、source 削除ではなく route owner の移設である。Wave55 では「通常 UI から mount しない」と「callback の移設先を持つ」を分けて扱うべきである。

### Test breakage

既存 e2e は legacy panels の visible text と `data-testid` に広く依存している。

代表的な依存:

- operation log / generated evidence / reload summary / package file set を読む persistence 系 smoke
- Product Preflight panel/detail/comparison を読む smoke
- Codex Proposal Review / AI Approval / AI Transcript を読む smoke
- Viewer Runtime / preview / mesh canvas / topology status を読む smoke
- `apps/editor/src/ui/app-shell/app-shell.test.ts` の existing panels classification assertions

Wave55 では、test を「Primary に存在する」前提から「隔離 route で観測できる」前提に更新する必要がある。

### State observation loss

Evidence panels を primary から消すと、operation log、generated evidence、package file set、reload summary、runtime snapshot/diff、Product Preflight diagnostics の観測点が一時的に失われる恐れがある。

対策:

- Diagnostics/Evidence route に同等以上の observation surface を持たせる
- route-scoped test selectors を明示する
- primary diagnostics strip は count/status のみ残し、detail route へ遷移できるようにする

### Duplicate selector risk

`drawable.list` は Parts Tree と legacy Drawable Authoring の両方に現れる。Primary UI reset では、Parts Tree を primary owner にするか、legacy route に同名 selector を閉じ込める必要がある。

### Viewer/Runtime state routing risk

Viewer/Runtime は `activeTask` route とは別 state で support panel 的に表示されている。Dedicated view 化では、open/close state、app bar status、preview/runtime evidence の所有者を整理する必要がある。

### PSD Import task compatibility risk

PSD Import は task window route 化されているが、現行 tests は `psdImport.task.open`、`explicitPsdImport.panel`、workflow section text、approval binding に依存している。Human task と debug/evidence detail の分離時に、test-facing selectors を route-scoped に維持する必要がある。

### CSS and accessibility regression risk

legacy panels を primary から外すと、CSS grid、landmark labels、headings、focus order が変わる。これは望ましい変更だが、unit tests と visual/a11y checks を同時に更新しないと regressions と見なされやすい。

## user-decision needed

棚卸自体には blocking decision はない。Wave55 実装計画前に Undine/root が決めるとよい点は以下。

1. Legacy/debug route を明示 route として持つか、dev-only/debug drawer として持つか。
2. Product Preflight full detail の主所有者を Validation task にするか、Diagnostics/Evidence detail にするか。
3. Viewer/Runtime を `activeTask` と同じ task-window 系に寄せるか、独立 view route として扱うか。
4. PSD Import task 内の Advanced/Evidence sections を、同 Wave で隠すか、次 Wave に分けるか。

## Recommendation for Next Wave

Wave55 は「full visual redesign」ではなく、まず primary contamination を取り除く wave として切るのがよい。

推奨する実装順:

1. `createWorkspaceSupportRegion([...])` を normal primary mount から外す。
2. Diagnostics/Evidence route に evidence/persistence panels を route-scoped に移す。
3. Codex/Automation route に Codex/AI panels を route-scoped に移す。
4. active tool/task panels は legacy route に隔離し、Primary には launcher/compact status のみ残す。
5. tests を「Primary absence」と「quarantine route presence」に書き換える。

重要なのは、旧 panel の存在を UX の正解として保存しないことである。保存するべきなのは operation wiring、state observation、testable contracts であり、通常 UI 上の配置ではない。

