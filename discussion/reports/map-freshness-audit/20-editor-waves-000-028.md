# Editor implementation map-freshness audit: Waves 0–28

監査日: 2026-08-08 (Asia/Tokyo)
基準点: Git `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` (契約の基準点と一致)

## 1. Scope and method

対象は `discussion/implementation/orchestration` の Wave 0–28 plans、`discussion/implementation/waves/wave0`–`wave28` の wave maps / completion・integration・final reports、`discussion/implementation/reviews/wave0`–`wave28` の review maps / review reports、および親の `discussion/implementation/_map.md` と `discussion/implementation/orchestration/_map.md` です。Wave 16/22 の不足 map は、ディレクトリ内の実在ファイルと Git tree も照合しました。

実施した read-only 検証:

- 各既存 `_map.md` と Wave 0–28 plan の Markdown 相対リンクを解決。既存 map 内のリンク切れは 0 件。
- `Get-ChildItem` で wave/review artifact の存在を確認。Wave 16 の completion/final/review artifact と Wave 22 の completion/final/review artifact は存在するが、下記 3 map は存在しない。
- `discussion/implementation/orchestration/_map.md:9-37` の Wave 0–28 plan status と各 final report / clean review を突合。
- `git rev-parse HEAD`、`git status --short -uall -- discussion/implementation`、Wave 16/22/28 の final report と clean review の status/verdict を確認。
- 現在 source の境界確認として `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:419-537`（Wave 16/17/28 由来 operation catalog）、`packages/authoring-core/src/binary-byte-registration.ts:25-78`（Wave 22 binary metadata registration）、`discussion/design/module-contracts/validator-contract.md:164`（Wave 13 の duplicate-key severity）を read-only で確認。

歴史的な wave map は、後続 wave があることだけでは stale としません。完了 wave の map/report は `historical-evidence-index` として判定し、当時の artifact 索引・当時の non-goal・当時の next action をそのまま証拠として扱いました。

## 2. Map inventory and verdicts

### Parent maps

| Map | 種類 | 判定 | 根拠 |
|---|---|---|---|
| `discussion/implementation/orchestration/_map.md` | `living-index` | **Current** | Wave 0–28 の plan path が `:9-37` に全件あり、status は全て `Completed / implementation-proven`。相対リンク検査も in-scope では切れなし。 |
| `discussion/implementation/_map.md` | `living-current-state` + `living-index` | **Partially stale** | Wave 0–28 の完了要約 (`:93-123`) は final reports と整合する。一方、子 map 索引が Wave 0 map / Review map を欠き、Wave 17–19 review map を欠き、Wave 16 は final report のみ (`:202-237`, `:283-312`)。Wave 28 review map を「placeholder」と記述する `:311` は、実在する pass 済み clean review を表す現在の索引文として不正確。 |

### Wave maps (`discussion/implementation/waves`)

以下の 27 実在 map はすべて `historical-evidence-index / Intentionally historical`。各 map の表に列挙された artifact は存在し、map 内相対リンクは全件解決した。Wave 0–4 は top-level status ではなく artifact table の `Pass` を根拠にした古い形式、Wave 17 は pass 表＋review-map link の形式であり、形式差は判定を変えない。

| Map path | 判定 |
|---|---|
| `discussion/implementation/waves/wave0/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave1/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave2/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave3/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave4/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave5/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave6/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave7/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave8/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave9/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave10/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave11/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave12/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave13/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave14/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave15/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave16/_map.md` | **Stale — missing expected map** |
| `discussion/implementation/waves/wave17/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave18/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave19/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave20/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave21/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave22/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave23/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave24/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave25/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave26/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave27/_map.md` | Intentionally historical |
| `discussion/implementation/waves/wave28/_map.md` | Intentionally historical |

Wave 16 is not an empty or abandoned wave: `discussion/implementation/waves/wave16/wave16-final-report.md:4-5` says `pass` / `Completed / implementation-proven`; the six completion/integration artifacts in that directory are present. The missing `_map.md` is therefore an index defect, not a wave-status defect.

### Review maps (`discussion/implementation/reviews`)

The 27 existing review maps below are `historical-evidence-index / Intentionally historical`; every listed review link resolves and the listed final verdict is pass (including recorded fix/escalation loops where the map explicitly records the final pass).

| Map path | 判定 |
|---|---|
| `discussion/implementation/reviews/wave0/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave1/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave2/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave3/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave4/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave5/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave6/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave7/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave8/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave9/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave10/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave11/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave12/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave13/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave14/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave15/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave16/_map.md` | **Stale — missing expected map** |
| `discussion/implementation/reviews/wave17/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave18/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave19/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave20/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave21/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave22/_map.md` | **Stale — missing expected map** |
| `discussion/implementation/reviews/wave23/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave24/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave25/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave26/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave27/_map.md` | Intentionally historical |
| `discussion/implementation/reviews/wave28/_map.md` | Intentionally historical |

Wave 16 review evidence exists (`discussion/implementation/reviews/wave16/` has six review artifacts), but no review `_map.md`. Wave 22 review evidence exists (`discussion/implementation/reviews/wave22/` has seven review artifacts including `wave22-clean-integration-review.md`), but no review `_map.md`.

## 3. Plans checked and plan metadata

All 29 plan paths were checked for existence and relative-link resolution; each plan has zero broken links:

`discussion/implementation/orchestration/wave0-plan.md`, `wave1-plan.md`, `wave2-plan.md`, `wave3-plan.md`, `wave4-plan.md`, `wave5-plan.md`, `wave6-plan.md`, `wave7-plan.md`, `wave8-plan.md`, `wave9-plan.md`, `wave10-plan.md`, `wave11-plan.md`, `wave12-plan.md`, `wave13-plan.md`, `wave14-plan.md`, `wave15-plan.md`, `wave16-plan.md`, `wave17-plan.md`, `wave18-plan.md`, `wave19-plan.md`, `wave20-plan.md`, `wave21-plan.md`, `wave22-plan.md`, `wave23-plan.md`, `wave24-plan.md`, `wave25-plan.md`, `wave26-plan.md`, `wave27-plan.md`, `wave28-plan.md`.

There is stale planning-document metadata that must not override the orchestration map or final reports:

- `wave7-plan.md:3` says `Draft / ready for execution request`, while `orchestration/_map.md:16` and Wave 7 final/review artifacts record completion/pass.
- `wave10-plan.md:5` says `Draft`, and `wave11-plan.md:7`, `wave12-plan.md:8`, `wave13-plan.md:8`, `wave14-plan.md:8`, `wave15-plan.md:8` say `Planned`, while `orchestration/_map.md:19-24` and their final reports record completion/pass.
- `wave19-plan.md:8` through `wave28-plan.md:8` say `Planned`, while `orchestration/_map.md:28-37` and the corresponding final reports record completion/pass.

These are plan-header snapshots, not authoritative current status. The authoritative status for Waves 0–28 is the orchestration map plus the final report and clean integration review for each wave. No final report or clean integration review in this scope contradicts the completed/pass gate. Examples: Wave 16 final report (`waves/wave16/wave16-final-report.md:4-5`), Wave 22 final report (`waves/wave22/wave22-final-report.md:6-12`, clean review `:44-46`), and Wave 28 final report (`waves/wave28/wave28-final-report.md:9-17`).

## 4. Historical evidence and current-fact boundaries

### Information type separation

- **Repository fact:** `orchestration/_map.md:9-37` indexes Wave 0–28 plans as completed; the final reports/reviews provide the wave-gate evidence. Current source still exposes the relevant operation catalog entries (`packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:419-537`) and binary metadata registration (`packages/authoring-core/src/binary-byte-registration.ts:25-78`).
- **Design/policy decision:** Wave 13’s accepted diagnostic authority is `keyform.grid2dDuplicateKey` severity `error`, strict/acceptance fail (`discussion/design/module-contracts/validator-contract.md:164`). Wave 13 artifacts explicitly say the earlier pre-resolution escalation is historical/superseded; later planning must use the aligned decision, not the old escalation text.
- **Experiment/verification result:** Wave 22 clean review records a pass after full unit/e2e/source/dependency checks (`discussion/implementation/reviews/wave22/wave22-clean-integration-review.md:48-84`). Its line 94 says integration was still pending from that reviewer’s handoff context; the final report/map already record the integrated pass (`waves/wave22/wave22-final-report.md:42-46`). Treat line 94 as a historical handoff note, not current gate status.
- **Historical scope/non-goal:** Wave 20–22 maps’ parser/decode/file-picker/binary claims are snapshots of those waves. Later waves may implement portions of those boundaries; do not use the old “future scope” sentence as a current capability claim without consulting later wave maps (outside this assignment).

### Parent-map facts to retain

1. Preserve the orchestration map’s completed/pass status for every Wave 0–28, independent of stale `Planned` labels in older plan headers.
2. Preserve the bounded progression and non-goal distinctions: Wave 13 diagnostic alignment; Wave 19 texture-backed metadata preview; Wave 20–21 parser-free structured PSD profile; Wave 22 metadata/in-memory binary boundary; Wave 23 dynamics semantic slice; Wave 24 private viewer semantic surface; Wave 25–26 rig-control evidence; Wave 27 semantic mask/composition; Wave 28 semantic part/texture/layer workflow.
3. Preserve Wave 28’s closure sequence: Domain C/F `needs_changes` loops and Domain G escalation were cleared by remediation/rerun; final clean integration review is `pass` (`discussion/implementation/reviews/wave28/_map.md:15-29`, `:31-35`). Do not treat the “initial escalate” rows as the final gate.
4. Add/restore explicit child-map links for Wave 0, Wave 17–19 review maps, and Wave 22 review map when the user authorizes map repair; record Wave 16’s two missing maps rather than implying their existence.

## 5. Findings, unresolved items, and user decisions

### Findings

1. **Three missing map files:**
   - `discussion/implementation/waves/wave16/_map.md`
   - `discussion/implementation/reviews/wave16/_map.md`
   - `discussion/implementation/reviews/wave22/_map.md`
2. **Parent index omissions:** `discussion/implementation/_map.md` omits the existing Wave 0 wave/review maps and existing Wave 17–19 review maps from its child-map index; Wave 16 can only be represented by its final report because its maps do not exist (`:202-237`, `:283-312`).
3. **Incorrect current index wording:** `discussion/implementation/_map.md:311` calls the Wave 28 review map a “clean integration review placeholder”, but the map and clean review are complete/pass.
4. **Plan-header drift:** 17 plan headers remain `Draft`/`Planned` after their waves completed; these should be treated as historical plan metadata until a user-approved documentation update.

### User decisions

- Whether to create the three missing map files and repair parent child-map links now or in a later documentation pass.
- Whether to normalize old plan `Status` headers to an explicit historical label, or leave them immutable as execution-time snapshots.

### Not audited

- Waves 29 onward, runtime-player maps, model-authoring/mesh/performance/Electron/AI-cohost domains, and non-implementation `discussion/**/_map.md` files.
- No new full typecheck/unit/e2e run was required for this historical-index audit; source checks were limited to the targeted current facts above.
- Existing maps/source/tests were not modified, and no commit/stage/checkout/reset was performed.

## 6. Verdict summary

- `Current`: 1 map (`discussion/implementation/orchestration/_map.md`)
- `Partially stale`: 1 map (`discussion/implementation/_map.md`)
- `Intentionally historical`: 54 existing Wave/review maps
- `Stale`: 3 expected-but-missing map paths (Wave 16 wave/review; Wave 22 review)
- `Unverifiable`: 0
