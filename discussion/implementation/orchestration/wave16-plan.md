# Wave 16 Plan: Drawable Layer Controls And Visibility Authoring

> Wave 16 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 16
- Wave name: `drawable-layer-controls-and-visibility-authoring`
- Primary objective: Wave 15 で作成可能になった複数 drawable を、editor 上で並び替え・表示切替できるようにし、preview / persistence / evidence / e2e で確認する。

## 2. Wave 16 の主目的

Wave 15 では、GUI から rights-clean generated drawable / deterministic mesh を作成し、embedded preview、operation log、package persistence、runtime / validation evidence で確認できるようになった。

次に必要なのは、作成した drawable を layer として扱う最小 workflow である。複数 drawable があるのに、重なり順や表示/非表示を editor から変更できない状態では、preview が見えていても制作操作としてはまだ弱い。

Wave 16 は `setDrawOrder` と `setRuntimeVisibility` を最小 vertical slice として通す。mask/clipping、opacity editor、full layer tree、texture/part authoring、mesh editing へ広げず、まず「drawable を並び替える」「drawable を隠す/戻す」を operation / preview / persistence / e2e で implementation-proven にする。

## 3. Undine コンテキスト保護の復元規約

Wave 16 でも、Undine が詳細実装コンテキストを直接抱え込まないことを明示的な制約にする。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は原則として Gnome / Review-Sylph を直接起動しない。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Undine は各 domain の詳細ソースを大量に読まず、Orch-Sylph の completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- この節は context compaction 後に orchestration skill の内容が薄れた場合の復元規約であり、Wave 16 起動時に必読とする。

## 4. Repository Facts

- Wave 15 は `Completed / implementation-proven`。editor は GUI から generated drawable / deterministic mesh を作成し、preview / persistence / evidence で確認できる。
- `packages/operation-core/src/operation-type.ts` と `operation-payload.ts` には `setDrawOrder` と `setRuntimeVisibility` が既に存在する。
- `packages/operation-core/src/payloads/model-edit.ts` の `SetDrawOrderPayloadSchema` は drawable id と `baseDrawOrder` の entries を持つ。
- `SetRuntimeVisibilityPayloadSchema` は `target` と `runtimeVisibility` を持つ。
- `packages/operation-core/src/operation-registry.ts` には Wave 15 時点で `createDrawable`、`generateMesh`、`createParameter`、`addKeyform`、`addKeyformGrid2d` が登録されているが、`setDrawOrder` / `setRuntimeVisibility` は未登録。
- `packages/authoring-core/src/draw-order-mutations.ts` は drawable 追加時の draw order entry helper を持つが、並び替え mutation はまだない。
- `apps/editor/src/editor-state/drawable-list-state.ts` は drawable list item に `visible` と `baseDrawOrder` を投影している。
- Wave 13 で runtime diff dedicated fields が入り、Wave 14/15 の preview/evidence は runtime snapshot / diff を UI へ投影できる。

## 5. Design Decisions

- Wave 16 は drawable layer controls に限定する。
- 対象操作は `setDrawOrder` と `setRuntimeVisibility` の2つを優先する。
- Draw order UI はまず deterministic な up/down または numeric order editing でよい。full layer tree、drag-and-drop reorder、group/part hierarchy editing は扱わない。
- Visibility は runtime visibility toggle として扱う。opacity editor は payload がないため扱わない。
- Operation log / model diff / runtime diff / validation evidence に反映し、preview は runtime snapshot 由来の状態を表示する。
- Existing generated drawable workflow と preview slider smoke を壊さない。
- Public `index.ts` は barrel-only を維持し、実装本体を catch-all file に寄せない。

## 6. Non-Goals

- Mask / clipping workflow は扱わない。
- Opacity editor は扱わない。
- Part / texture authoring、PSD import、split PNG import、asset pipeline は扱わない。
- Mesh editing、vertex drag、canvas direct manipulation は扱わない。
- Drag-and-drop layer tree や nested part hierarchy editor は扱わない。
- Standalone viewer app / full renderer は作らない。
- 外部 HTTP / WebSocket / MCP transport は扱わない。
- LLM provider integration は扱わない。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading は扱わない。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave16-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave15/wave15-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures
- 必要に応じて Wave 15 の completion / review / integration report

Undine はすべての設計規約・実装規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Wave 16 は operation foundation を先に作り、その後に evidence と editor workflow を並列化し、最後に UI / e2e / integration を直列 gate にする。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. drawable layer operation foundation | Solo | Wave 15 complete | `setDrawOrder` / `setRuntimeVisibility` handler と authoring mutations を作る |
| 2 | B. drawable layer runtime / evidence regression | Parallel with C | A | draw order / visibility changes が runtime diff / evidence / validation に出ることを固める |
| 2 | C. editor layer workflow state | Parallel with B | A | editor session / workflow に reorder / visibility actions と view model を追加する |
| 3 | D. editor layer controls UI | Solo | B + C | drawable list に reorder / visibility controls を追加する |
| 4 | E. layer controls e2e and persistence smoke | Solo | D | create drawable後の reorder / hide / show / save-load / mobile smoke を検証する |
| 5 | F. integration review and final report | Solo | E | clean integration review、修正反映、final report を完了する |

Batch 2 だけを並列化する。Domain B は packages / evidence / fixture 側、Domain C は apps/editor workflow 側に所有範囲を分ける。

## 9. Domain Assignments

### A. `wave16-drawable-layer-operation-foundation`

Purpose:

- `setDrawOrder` と `setRuntimeVisibility` の operation handlers を実装し、operation registry に登録する。
- Authoring graph の drawable baseDrawOrder / drawOrder entries / runtimeVisibility を更新する mutation helper を作る。
- Missing drawable、duplicate entries、invalid target kind、no-op update などを deterministic diagnostic にする。

Write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/operations/set-draw-order*.ts`
- `packages/operation-core/src/operations/set-runtime-visibility*.ts`
- `packages/operation-core/src/operation-registry.ts`
- focused authoring / operation tests
- discussion completion / review reports

Pass evidence:

- `setDrawOrder` dry-run / commit が model diff と precondition diagnostics を返す。
- `setRuntimeVisibility` dry-run / commit が model diff と precondition diagnostics を返す。
- drawables と drawOrder entries の order state が矛盾しない。
- Runtime graph conversion が draw order / visibility changes を反映できる。
- `index.ts` は barrel-only のまま。

Early escape:

- `SetDrawOrderPayloadSchema` だけでは stable order と base draw order の意味を安全に更新できない。
- visibility target の `TargetRefSchema` と drawable model の対応に設計判断が必要になる。
- operation handler 実装が mask/part/layer tree の本格設計を要求する。

### B. `wave16-drawable-layer-runtime-evidence-regression`

Purpose:

- Domain A の draw order / visibility operation 結果が runtime snapshot、runtime diff、validation report、operation evidence で観測できることを固める。
- created drawable fixture と組み合わせ、複数 drawable の drawList / visibility 変化を compact oracle にする。

Write scope:

- `packages/operation-core/src/*evidence*.test.ts`
- `packages/runtime-core/src/**` は test-discovered bug fix の最小差分のみ可
- `packages/validator-core/src/**` は test-discovered bug fix の最小差分のみ可
- `fixtures/contracts/**` の compact fixture
- discussion completion / review reports

Pass evidence:

- Runtime diff が draw order / drawList / visibility change を dedicated fields で示す。
- Hidden drawable の扱いが preview/evidence と矛盾しない。
- Validation evidence が reordered / hidden drawable を落とさない。
- Fixture が過大にならず future wave の oracle として読める。

Early escape:

- Runtime diff が draw order / visibility を表現できず shared contract redesign が必要になる。
- Validator policy が hidden drawable をどう扱うべきか未決で user decision が必要になる。

### C. `wave16-editor-layer-workflow-state`

Purpose:

- Editor session / workflow に drawable visibility toggle と draw order update action を追加する。
- UI が使う view model に ordered drawable list、visibility state、move up/down enabled state、last layer operation result を追加する。
- Existing create drawable workflow、preview slider、save/load と矛盾しないようにする。

Write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- focused editor session / workflow / view model tests
- discussion completion / review reports

Pass evidence:

- Editor session から `setDrawOrder` / `setRuntimeVisibility` が commit できる。
- Operation log と package file set に layer operations が残る。
- Save/load 後に draw order / visibility が復元される。
- View model が Domain D の UI に必要な ordered drawables と command state を提供する。
- UI なしの focused tests がある。

Early escape:

- Reorder action が numeric order と stable order のどちらを正とするか user decision を必要とする。
- Multi-drawable workflow が current editor state architecture の大幅 redesign を要求する。

### D. `wave16-editor-layer-controls-ui`

Purpose:

- Drawable authoring / drawable list UI に visibility toggle と reorder controls を追加する。
- User が generated drawable を作成後、一覧から hide/show と up/down reorder を実行できるようにする。
- Embedded preview と result summary が更新されるよう app shell に接続する。

Write scope:

- `apps/editor/src/ui/drawable-authoring/**`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/**`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- focused UI tests
- discussion completion / review reports

Pass evidence:

- Drawable list に visibility toggle と move up/down controls が表示される。
- Disabled state が first/last/single drawable で正しい。
- Callback wiring が Domain C actions を呼ぶ。
- Preview panel と同一画面で layout が破綻しない。
- Text overflow / incoherent overlap / nested card layout を増やさない。

Early escape:

- Existing drawable authoring panel が layer controls を収めるには broad redesign が必要になる。
- Reorder UI が drag-and-drop tree を要求する場合。

### E. `wave16-layer-controls-e2e-and-persistence-smoke`

Purpose:

- Browser-level smoke で create drawable -> reorder -> hide/show -> preview -> save/load を固定する。
- Desktop / mobile viewport と basic a11y を確認する。

Write scope:

- `scripts/**editor*e2e*.mjs`
- `apps/editor/e2e/**`
- `apps/editor/src/**/*.test.ts` の focused tests は必要最小限のみ
- narrow test id / aria tweaks in UI files only if needed for a11y smoke
- discussion completion / review reports

Pass evidence:

- `pnpm test:e2e` または既存 editor e2e command で layer controls workflow が走る。
- Existing preview slider smoke と generated drawable smoke が壊れない。
- Reorder / hide / show により preview summary / visual / drawable list の deterministic 変化を検証する。
- Save/load 後も draw order / visibility が残る。
- Desktop / mobile の両方で basic layout と accessible names を確認する。

Early escape:

- Current e2e harness が reorder / visibility の deterministic assertion を安定検証できない。
- Browser automation / screenshot verification が sandbox 制約で実行できない。

### F. `wave16-integration-review-and-final-report`

Purpose:

- Domain A-E の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 16 final report と maps を更新する。

Write scope:

- `discussion/implementation/waves/wave16/**`
- `discussion/implementation/reviews/wave16/**`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- integration review が Product Workflow、Runtime Truthfulness、Operation Integrity、Persistence、UI / Accessibility、Source Organization、Test Adequacy を含む。
- final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 16 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 16 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C の Orch-Sylph を並列投入する。
3. Domain B / C がどちらも `pass` したら、Undine は Domain D を Orch-Sylph に委譲する。
4. Domain D が `pass` したら、Undine は Domain E を Orch-Sylph に委譲する。
5. Domain E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は domain 内で Gnome 実装と Review-Sylph レビューを分離し、needs_fix loop を自分の domain 内で閉じる。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

Orch-Sylph への domain assignment には必ず次を含める。

- target / wave / dependency
- allowed write scope
- forbidden write scope
- basis docs
- required tests
- review lanes
- completion report path
- early escape condition
- `discussion/development_convention/source-file-organization-policy.md`

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Product Workflow: GUI から draw order / visibility を変え、preview / persistence で確認できるか。
- Runtime Truthfulness: preview と evidence が runtime snapshot / diff 由来であり、UI fake semantics ではないか。
- Operation Integrity: dry-run / commit / operation log / model diff / precondition diagnostics が coherent か。
- Persistence: package file set / save-load / generated artifacts が draw order / visibility changes を失わないか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / workflow / UI / e2e が domain risk に見合うか。
- Determinism: draw order、drawList、visibility state、preview summary、e2e assertions が deterministic か。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: authoring-core / operation-core focused tests、typecheck
- Domain B: operation evidence / runtime evidence / fixture focused tests
- Domain C: editor session / workflow / view model focused tests、editor typecheck
- Domain D: layer controls UI focused tests、editor typecheck
- Domain E: editor e2e smoke、a11y smoke
- Domain F: `pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- .`
- untracked file whitespace check if new fixtures/reports are untracked

Frontend 変更を含むため、可能なら final integration で local editor を起動し、desktop/mobile viewport の layer control screenshot metadata または browser smoke metadata を記録する。

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- `setDrawOrder` の payload が base order と stable order の更新意味論を安全に表現できない。
- Hidden drawable を validation / preview / evidence でどう扱うか設計文書と矛盾する。
- Existing drawable authoring UI の大幅 redesign が必要になる。
- E2E / browser verification が現在の sandbox で安定実行できない。

## 14. Pass Criteria

Wave 16 は次を満たしたとき pass とする。

- `setDrawOrder` / `setRuntimeVisibility` operation handlers が dry-run / commit / precondition diagnostics / model diff を持つ。
- GUI から drawable の重なり順と表示/非表示を変更できる。
- Changes が embedded preview / preview summary / runtime diff で deterministically 観測できる。
- Operation log、package file set、save/load persistence、runtime / validation evidence が draw order / visibility changes を失わない。
- Desktop / mobile e2e smoke で layer controls workflow と preview update が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
