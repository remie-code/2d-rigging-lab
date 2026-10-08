# AI Cohost Model Identity Inventory — Final Review

調査日: 2026-08-08 (JST)。`inventory-contract.md`、一次 `01`–`04`、統合 `10`、同ディレクトリ `_map.md` を全件照合した。source、maps、一次/統合reportは編集せず、所有ファイルは本reportのみ。stage/commitはしていない。

## 1. Verdict

**PASS（blocking 0、nonblocking 0）。**

現行固定名のflow、brain registry、memory/prompt/voice persistence、UI/API/SSE、tests、user decisionは整合している。前回レビューで記録した2件の統合表の根拠・固定値表記は、owner correction後の再照合で解消を確認した。

## 2. Review matrix

| 検査 | 判定 | 根拠 |
|---|---|---|
| 固定名 owner / flow | PASS | Prompt、Whisper、voice/text matcher、header/title、disclosureの主要ownerと伝播は10:3–4で網羅。comment matcherは正確な8値を明記（10:88; N-01 closed）。 |
| Registry / model / identity | PASS | 4 brain ID、provider adapter、model ID、brainChoice→currentBrain→lazy factory、snapshot/SSEのraw brainは整合（02:1–7, 3.1–3.4; 10:2–4, 4.2）。Sol `effort=none` はwrapper設定と公式妥当性未検証（inference）を分離（10:100,127,176,182; N-02 closed）。 |
| Memory / prompt / voice / persistence | PASS | session promptは生成時snapshot、memoryはviewer名除去・timestamp-only Markdown、TTSはnumeric speaker、Claude/Codex retention差、履歴snapshot欠落を3:2–6, 3.4, 6; 10:3,6–7, 6で分離。 |
| UI / API / SSE / test coverage | PASS | 4 option、4-ID API、snapshot/SSE raw brain、settings roundtrip、header/name/ASR/matcher/memory/TTS fixturesと未固定の直接interaction・a11y・attributionを4:2,5–10, 7; 10:3.4, 7で記載。 |
| repo fact / inference / user decision | PASS | 系列対個別model、registry対user-editable、swap timing、履歴、prompt/persona/TTS scopeは10:8–10で未決として扱う。Sol effortの「wrapper設定」と「公式妥当性推定」の境界も明示済み（10:127,176,182; N-02 closed）。 |
| `apps/soul` boundary | PASS | インベントリはRuntime Player/Editorのidentityを対象外とし、魂のprovider/modelを特区に閉じる方針を維持（02:1, 10:1）。追加の境界guard `node scripts/check-soul-zone-boundary.mjs` は **PASS: 1,389 files、器→魂/魂→器 code importなし**。 |
| 過剰な実装設計 | PASS | 10:5,8はregistry metadata、resolver、snapshot、user-editable等を成立可能な選択肢/trade-offとして提示するだけで、採用判断・実装順序を決めていない。 |
| 件数 / 主張 / evidence class | PASS | 01のworker-free selected 360/360、02/04のNode runner `spawn EPERM`、02のwave 827→835は実行経路/歴史 evidenceとして10:1,7,9,11で分離。full-run greenやhuman identity acceptanceへ昇格していない。 |

## 3. Findings and owner-correction state

### N-01 — Comment-call variant set is underspecified in the integrated fixed-value table

- **Initial claim (now closed):** Before owner correction, the integrated fixed-value row used `Japanese variants + Cody/cody/CODY` without enumerating the exact hiragana form. Primary `04-ui-contracts-and-tests.md:4` and source `apps/soul/agent/src/mind/fire-scheduler.mjs:183–202` define eight values: `Cody`, `cody`, `CODY`, `コーディ`, `コーディー`, `コーティ`, `コーティー`, `こーでぃー`. `01-fixed-name-and-identity-flow.md:4` also describes the sets but does not preserve the complete literal list in its summary.
- **Risk:** A follow-up inventory/implementation could infer that only the four katakana forms plus three Cody spellings are supported, dropping `こーでぃー` or mis-scoping tests. This is a coverage/wording issue; current source and primary evidence are correct.
- **Owner / correction:** `10-inventory-integration.md` owner. **Closed:** line 88 now lists all eight values and the exact source span, while retaining the separate four-value audio set.

### N-02 — Sol `effort=none` inference is flattened into an unqualified current table value

- **Initial claim (now closed):** Before owner correction, the integrated row presented `codex-56-sol` as `gpt-5.6-sol / none` without an uncertainty marker. Primary `02-brain-registry-and-model-selection.md:3.1,8.5,11` states that the wrapper currently forces `none`, but Sol's official effort validity is inferred from Terra measurements and the first `400` is treated as a safe failure shape; it is not an official enumeration.
- **Risk:** A later identity/model inventory could treat provider acceptance of Sol `none` as a settled fact. The repository fact is only “wrapper configured `none`”; validity is inference/uncertainty.
- **Owner / correction:** `10-inventory-integration.md` owner. **Closed:** line 100 annotates “wrapper sets `none` (official validity unverified; inference)” and lines 127, 176, and 182 retain the unresolved boundary in limitations/qualification text. No identity mapping decision follows from this correction.

Both findings were wording/classification corrections only; neither was blocking. Re-review below confirms no residual issue.

## 4. Coverage ledger

| Surface | Covered owner/evidence | Remaining decision or gate |
|---|---|---|
| Self-name / ASR / call match | `fire-orchestrator.mjs`, `whisper-inference.mjs`, `fire-scheduler.mjs` | Chappy variants and precision/recall envelope |
| Brain registry / provider / model | `brains.mjs`, `llm-session.mjs`, `codex-session.mjs` | Series vs model identity; Sol effort validity annotation |
| Selection / swap | `cockpit-settings-store.mjs`, `cockpit.mjs`, `/api/brain` | Next-Fire vs immediate/in-flight attribution |
| Transcript / SSE / usage | `transcript-buffer.mjs`, `cockpit-server.mjs`, view-logic | Snapshot vs dynamic history semantics |
| Memory / privacy | `memory.mjs`, stream-memory contract, Codex ledger | Historical metadata, provider retention, viewer-name boundary |
| UI / disclosure | header/title, health/settings drawer, pre-stream checklist, cockpit redesign | Fixed name vs technical label vs persona/voice scope |
| TTS / playback | `tts-client.mjs`, `speak.mjs`, `audio-player.mjs` | Numeric speaker mapping, persistence, WAV cleanup |
| Tests | registry, prompt, ASR, scheduler, UI/API/settings, memory, TTS fixtures | Identity mapping, direct SettingsDrawer, a11y state, in-flight attribution, end-to-end name sweep |
| Soul boundary | direct guard command above; accepted `apps/soul` policy | No boundary violation found; future identity work must remain contract-only across Runtime Player |

## 5. Evidence classification check

- **Current repository facts:** fixed literals, four registry IDs, adapter/model wrappers, settings key, session lifecycle, transcript fields, memory file shape, TTS numeric speaker, duplicate UI/server owners.
- **Accepted decisions:** Claude/GPT naming wish, brain-swap v0 pre-stream mainline, stream-memory viewer-name removal/local Markdown/three-entry reload, `apps/soul` special zone.
- **Historical evidence:** 827→835 brain-swap counts, 724/724 verbosity wave, prior wave plans/README two-choice prose, stale Terra inline prompt and disclosure text.
- **Inference:** identity synchronization drift, in-flight misattribution consequences, Sol `none` validity, migration/retention impacts. N-02 requires this last boundary to remain explicit.
- **User decisions:** series/model granularity, registry/user authority, swap timing, history semantics, prompt/persona/voice coupling, Chappy variants, technical ID visibility, privacy/retention.

## 6. Verification boundary

The selected worker-free imports in `01-fixed-name-and-identity-flow.md:7` are 360/360. `04-ui-contracts-and-tests.md:7.3` attempted 12 files with `node --test`; all stopped before assertions because of `spawn EPERM`, and `02` records the analogous 53-file runner limitation. These are different execution modes, not contradictory counts. No real provider, microphone, Whisper, TTS, YouTube, Electron UI, screen reader, or end-to-end identity attribution run was performed.

The direct `node scripts/check-soul-zone-boundary.mjs` check performed during this review passed (1,389 files). This closes only import-direction verification; it does not accept identity semantics, privacy, provider retention, human persona/voice, or public disclosure.

## 7. User-decision boundary

The integration correctly leaves unresolved: Claude/GPT series vs per-model naming; registry-defined vs user-editable authority; immediate vs next-Fire switch; transcript/SSE/memory snapshot vs dynamic history; prompt/persona/TTS/UI/disclosure coupling; Chappy spelling/ASR false-positive envelope; technical raw-ID visibility; and Codex/WAV/viewer-name retention requirements. No implementation design is authorized by this review.

## 8. Evidence index

- Contract: `inventory-contract.md:1–24`
- Fixed-name/flow: `01-fixed-name-and-identity-flow.md:2–11`
- Brain registry/swap: `02-brain-registry-and-model-selection.md:1–11`
- Memory/prompt/voice: `03-memory-prompt-voice-persistence.md:1–11`
- UI/contracts/tests: `04-ui-contracts-and-tests.md:1–11`
- Integrated claims: `10-inventory-integration.md:1–11`
- Primary source anchors: `apps/soul/agent/src/mind/{brains,fire-orchestrator,fire-scheduler,memory}.mjs`, `src/ears/whisper-inference.mjs`, `src/cockpit/{cockpit-server.mjs,cockpit-settings-store.mjs}`, `src/voice/{tts-client.mjs,speak.mjs,audio-player.mjs}`.
- Boundary verification: `node scripts/check-soul-zone-boundary.mjs` → 1,389 source files, no direction violations.

## 9. Limitations

This is an inventory consistency review, not implementation or provider acceptance. Existing reports/maps were not edited; only this report is owned. The two findings were wording/classification corrections for `10-inventory-integration.md`, not source failures or product decisions; both are now closed.

## 10. Re-review after owner corrections (2026-08-08)

- Re-read `01-fixed-name-and-identity-flow.md:278–297`; the current-source soul-zone guard evidence remains explicit (exit 0, 1,389 files) and fixture-wrapper `spawnSync` limitations remain separated from source-boundary status.
- Re-read `10-inventory-integration.md:88`; comment-call variants enumerate the exact eight values, including `こーでぃー`, with a source anchor and explicit asymmetry to the four-value audio set. N-01 is closed.
- Re-read `10-inventory-integration.md:100,127,176,182`; `codex-56-sol` records the wrapper’s `effort: none` separately from official validity, which remains unverified/inferred. N-02 is closed.
- No blocking or nonblocking findings remain. No maps, source, or existing reports were edited by this re-review.

**Final verdict: PASS — 0 blocking, 0 nonblocking findings.**
