# Map Update Contract

> 2026-08-08 にユーザー承認された、`discussion/**/_map.md` 更新作業の所有権、順序、検証契約。

## 1. Basis

- Audit HEAD: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`
- Audit basis: `audit-contract.md` と調査・統合レポート 19 本
- Final root basis: `90-root-map-integration.md`
- 更新対象は `_map.md` と、このディレクトリ内で各 Sylph に割り当てた更新・レビューレポートだけである。

監査開始前から存在する次のユーザー変更を変更・削除・復元しない。

- `.codex/agents/gnome.toml`
- `.codex/agents/sylph.toml`
- `.codex/skills/context-check/DESIGN.md`
- `.codex/skills/context-check/SKILL.md`
- `discussion/expo.zip`

既存の `discussion/reports/map-freshness-audit/**` と `discussion/reports/_map.md` の audit 登録は、今回の作業基盤として保持する。

## 2. Ordering

1. Leaf / single-topic maps
2. Topic parent maps
3. Mechanical and semantic review
4. Owner correction loop
5. `discussion/_map.md`
6. Final mechanical and semantic review

親 map は必要な子 map が更新される前に変更しない。

## 3. Ownership

各 map は一体の Sylph だけが所有する。レビュー担当は map を編集せず、所見を固有レポートへ書く。修正は元の所有 Sylph が行う。

### Phase 1

| Report | Exclusive map ownership |
|---|---|
| `110-product-map-update.md` | `concept/_map.md`, `acceptance-criteria/**/_map.md`, `scenarios/**/_map.md`, `demo/_map.md`, `proposal/_map.md` |
| `111-design-ui-map-update.md` | `design/module-contracts/_map.md`, `design/mvp-authoring-runtime/_map.md`, `design/screen-design/**/_map.md`, `development_convention/_map.md` |
| `112-mesh-render-perf-map-update.md` | `design/canvas-evaluation/_map.md`, `design/mesh-generation/_map.md`, `design/mesh-rendering/_map.md`, `design/texture-atlas/_map.md`, `mesh-generation/**/_map.md`, `render-performance/_map.md`, `reports/editor-render-performance/_map.md` |
| `113-runtime-leaf-map-update.md` | `runtime-player/implementation/waves/**/_map.md`, `runtime-player/implementation/reviews/**/_map.md`; missing current evidence maps may be created when backing artifacts exist |
| `114-model-authoring-map-update.md` | `model-authoring/**/_map.md` |
| `115-electron-map-update.md` | `editor-electron-migration/**/_map.md` |
| `116-ai-cohost-map-update.md` | `ai-cohost/**/_map.md` |
| `117-expo-archives-map-update.md` | `expo/**/_map.md`, `reports/*/_map.md` except `reports/_map.md` and `reports/editor-render-performance/_map.md` |
| `118-editor-history-000-080-update.md` | `implementation/waves/wave0..80/_map.md`, `implementation/reviews/wave0..80/_map.md` |
| `119-editor-history-081-109-update.md` | `implementation/waves/wave81..109/_map.md`, `implementation/reviews/wave81..109/_map.md` |

### Phase 2

| Report | Exclusive map ownership |
|---|---|
| `120-design-parent-update.md` | `design/_map.md` |
| `121-implementation-parent-update.md` | `implementation/_map.md`, `implementation/orchestration/_map.md` |
| `122-runtime-parent-update.md` | `runtime-player/_map.md`, `architecture/_map.md`, `backlog/_map.md`, `implementation/_map.md`, `implementation/orchestration/_map.md`, `research/_map.md`, `screens/_map.md` under `runtime-player/` |
| `123-reports-parent-update.md` | `reports/_map.md` |

### Review and root

| Report | Role / ownership |
|---|---|
| `130-map-update-mechanical-review.md` | Review only; no map edits |
| `131-map-update-semantic-review.md` | Review only; no map edits |
| `140-root-map-update.md` | Exclusive ownership of `discussion/_map.md` |
| `141-root-map-mechanical-review.md` | Review only; no map edits |
| `142-root-map-semantic-review.md` | Review only; no map edits |

## 4. Update Rules

- Accepted Private baseline, four tracks, and Wave102 Editor mainline stop remain decisions.
- Specialized Waves103-109 are indexed separately; their existence does not silently reopen Editor mainline.
- Repository facts, accepted decisions, experiments, assumptions, and unresolved gates remain distinct.
- Human, device, external acceptance, legal, price, and product-scope gates must not be marked complete without evidence.
- Historical maps are not rewritten merely because later waves exist. Misleading current wording may be time-qualified.
- Missing map files are created only when the artifact directory exists and the index is useful. Purged Wave51-55 artifacts are not recreated.
- Parent maps remain lightweight; detailed evidence stays in child maps and audit reports.
- Non-map design docs, AC bodies, source, tests, config, and generated product artifacts are out of scope.
- Use `apply_patch` for edits. Do not stage or commit.

## 5. Each Updater Report

Every updater records:

1. Owned maps actually inspected
2. Maps changed, created, and intentionally unchanged
3. Claims replaced and their audit evidence
4. Decisions and gates intentionally preserved
5. Link and diff verification commands/results
6. Remaining issues outside ownership

Final chat responses must be terse; durable detail belongs in the report file.
