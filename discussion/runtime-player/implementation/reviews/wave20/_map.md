# Runtime Player Wave20 Review Map

> Review artifacts for Runtime Player Wave20.

## Files

| Path | Status | Content |
|---|---|---|
| [domain-a-spec-compliance-review.md](domain-a-spec-compliance-review.md) | Pass | Domain A spec compliance review |
| [domain-a-design-development-compliance-review.md](domain-a-design-development-compliance-review.md) | Needs changes, fixed by Gnome before recovery | Domain A design/development review; found stale Stage ready/model-visible state after Stage close |
| [domain-a-test-adequacy-review.md](domain-a-test-adequacy-review.md) | Pass | Domain A test adequacy review before stale-status fix |
| [domain-a-design-development-compliance-post-fix-rereview.md](domain-a-design-development-compliance-post-fix-rereview.md) | Pass | Domain A post-fix design/development re-review |
| [domain-a-test-adequacy-post-fix-rereview.md](domain-a-test-adequacy-post-fix-rereview.md) | Pass | Domain A post-fix test adequacy re-review |
| [wave20-final-spec-completion-review.md](wave20-final-spec-completion-review.md) | Needs changes, docs-only | Domain B final spec/completion review; source pass and implementation-scope closeout requested |
| [domain-b-final-integration-test-regression-review.md](domain-b-final-integration-test-regression-review.md) | Needs changes, docs-only | Domain B final test/regression review; source pass and implementation-scope closeout requested |
| [wave20-final-spec-completion-post-docs-closeout-rereview.md](wave20-final-spec-completion-post-docs-closeout-rereview.md) | Pass | Domain B final spec/completion post-docs closeout re-review |
| [domain-b-final-integration-test-regression-post-docs-closeout-rereview.md](domain-b-final-integration-test-regression-post-docs-closeout-rereview.md) | Pass | Domain B final test/regression post-docs closeout re-review |

## Current State

- Domain A source/test review recovery is complete with `pass`.
- Domain B final review lanes found no source blockers.
- Domain B final review lanes requested docs-only updates:
  - create final Wave20 report and maps;
  - update implementation maps from launch state to final state;
  - record stale non-implementation close-hide docs as out-of-scope follow-up.
- Domain B applied implementation-scope docs/map closeout under `discussion/runtime-player/implementation/**`.
- Domain B post-docs closeout re-review lanes passed.
- No additional Gnome source fix was needed during Domain B.

## Manual Review Focus

- Confirm packaged `.exe` or dev Electron Control close exits the app and closes Stage.
- Confirm direct Stage close keeps Control alive and Control shows Stage unavailable.
- Confirm `Focus Stage` reopens and focuses Stage after direct Stage close.
- Smoke Runtime Export restore, Browser Source, local preview suspension, Variant switching, live mapping / Body Follow, Stage Motion, diagnostics, and packaging setup.
