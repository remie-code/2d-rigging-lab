# AI Cohost model identity inventory — integrated report

> 調査日: 2026-08-08。`inventory-contract.md` と一次報告 `01`–`04` を統合した実装前 inventory である。既知のユーザー希望（Claude 系=`コーディ`、GPT 系=`チャッピー`）を記録するが、系列/個別 model、registry/user、swap、履歴、prompt/persona/TTS の採用判断は行わない。

## 1. Scope and entry points

- 必須入力: `discussion/reports/ai-cohost-model-identity-inventory/inventory-contract.md`、一次報告 `01-fixed-name-and-identity-flow.md`、`02-brain-registry-and-model-selection.md`、`03-memory-prompt-voice-persistence.md`、`04-ui-contracts-and-tests.md`。
- 対象: `apps/soul/agent` の brain/provider/model registry、起動/切替、prompt/ASR/scheduler、transcript/SSE/UI、memory、TTS、settings、運用開示、tests/accepted docs。
- 対象外: Runtime Player/Editorのmodel package identity、provider仕様の再調査、実SDK/実マイク/TTS/YouTube/Electron/スクリーンリーダー実射、identity設計の採択。
- 境界分類: `apps/soul` 特区は accepted policy として対象を閉じる。current source の直接 boundary guard 結果は §7 の verification として別記し、policy acceptance や identity semantics の受入とは分離する。
- 一次報告間の検証差（selected import 360/360、全体/12-file `spawn EPERM`、brain build/testの履歴値）は証拠種別を保ったまま併記した。
- 所有ファイルは本reportのみ。source、test、map、既存report、stage、commitは変更していない。

## 2. Executive findings

1. **現在の魂名は固定値である。** `FIRE_SYSTEM_PROMPT` の「あなたの名前はコーディ（Cody）です。」、Whisper初期prompt、音声/コメント呼びかけ集合、Cockpit title/header、運用開示に分散し、brain registryから解決されない（01,03,04）。
2. **GPT系希望名は未実装である。** `チャッピー/Chappy` は `apps/soul` と `discussion/ai-cohost` の bounded searchで0件。GPT系brainは現行で3行あるが、technical model labelとSoul名は別契約（01,02,04）。
3. **brain registryとsoul identityは別物である。** `BRAINS` は `id/label/create/credentialPath` のflat frozen registryで、providerはfactory、modelはadapter/wrapperで解決され、identity/persona/voice fieldやactive provider/model snapshotはない（02,03）。
4. **現行選択経路はbrainChoice→currentBrain→factoryである。** UI/HTTPは4 IDを重複検証し、成功時に保存・currentBrain更新・現session dispose/null、次のFireでlazy再生成する。accepted brain-swap v0は配信前選択が主線で、in-flight attributionは厳密契約でない（02,04）。
5. **名前はtranscript/SSE/memoryへ構造化伝播しない。** transcriptは`you|soul|viewer`、viewerだけdisplayNameを持ち、soul wireはbrain ID/latency/usageをbroadcast時点で付加する。memoryはviewer名を落としtimestamp-only Markdownを保存する（01,03,04）。
6. **promptはsession生成時snapshot、wire表示はdynamicである。** Claudeはnative system prompt、Codexはfirst-turn prefix。brain/nameを変えてもsessionを再生成しない限りpromptは旧値を保持する一方、SSE brain札はcurrentBrainを読むためin-flight mismatchが既知である（02,03,04）。
7. **TTS/voice/personaはbrain identityに接続していない。** TTSはnumeric speaker（既定`888753760`）、settingsはbrainChoice/memoryEnabled等のみ。声・persona・S9の確定時期は別の人間/製品gateである（01,03,04）。
8. **既存の拡張seamはあるが一元registryではない。** registry entry、session prompt合成、scheduler/Whisper options、settings store、SSE additive fields、TTS depsを差し替えられるが、health labelとserver validationはregistryをimportせず複製される（01,02,04）。
9. **repoで閉じるのは構造と機械検証までである。** selected worker-free testsは360/360 pass（01）。一方、12-file/全体Node runnerは`spawn EPERM`で開始前に停止し、実マイク・発話・配信・privacy・personaの受入は未確認（01,02,04）。

## 3. Current data/control flow

### 3.1 音声・発話・表示

```text
microphone/ffmpeg → VAD/Whisper
  (DEFAULT_WHISPER_PROMPT: こーでぃー、コーディ。)
  → transcriptBuffer(speaker=you)
  → fire-scheduler(NAME_VARIANTS_V0)
  → fire-injection(you/soul/viewer、viewer displayName)
  → session.ask(FIRE_SYSTEM_PROMPT + optional memory)
  → expression-tag removal → speechText
       ├─ speak(TTS numeric speaker → WAV temp → player)
       └─ transcriptBuffer.append(speaker=soul, speechText)
             → SSE transcript/usage (brain=currentBrain at broadcast)
             → Cockpit rows (soul + raw brain badge)
```

主要ownerは `ear-pipeline.mjs:115-196`、`fire-scheduler.mjs:183-218`、`fire-orchestrator.mjs:333-465`、`cockpit-server.mjs:1277-1333`（01,03,04）。この経路にidentity fieldはなく、本文中に名前が出るかはLLM出力次第である。

### 3.2 Brain selection / swap

```text
SettingsDrawer(BRAIN_LABELS keys)
  → POST /api/brain { brain } (server hardcodes 4 IDs)
  → cockpit.mjs onSetBrain
      save cockpit-settings.local.json.brainChoice
      currentBrain = choice
      current session.dispose(); session = null
  → next Fire: BRAINS[currentBrain].create(...)
```

`brainChoice` is a local string; absent/unknown values fallback to Claude. Snapshotは`{brain, credentialHealth}`のみで、provider/model/identity/name/voiceは運ばない（02,04）。KILL stateはbrain swapを跨ぐ共通orchestrator stateである。

### 3.3 Stream-memory

```text
transcript buffer (full)
  → formatTranscriptForDigest (viewer displayName除去)
  → disposable session using current brain factory
  → memories/<startedAtMs-derived>.md (plain text, no brain/name/voice metadata)

startup/ON: newest 3 md → composeSystemPrompt(FIRE_SYSTEM_PROMPT, memory)
```

OFF時は注入・生成・checkpointを止め、ON復帰時にmemory再読込とsession再生成を行う。checkpoint/manual/SIGINTは同一timestamp fileを上書きする（03）。

### 3.4 Browser/UI identity surfaces

- viewer `displayName` はYouTube authorName由来で、viewer prompt/SSE/diagnosticsには残り得るがmemory digestでは除去される。Soul identityと共用してはいけない（01,03）。
- Header/titleは固定の「こーでぃー」。SettingsDrawerはtechnical brain labels、latency/usageはraw brain ID、feed speakerはliteral `soul`。3つの意味軸は現在同じschemaにない（04）。
- 運用開示、kill checklist、README、Terra spike、benchmark/wave文書には固定名の重複・stale文言が残る（01,03,04）。

## 4. Exact fixed values and owners

### 4.1 Current Soul/name surfaces

| Surface | Fixed value | Current owner | Meaning |
|---|---|---|---|
| Fire self-recognition | `あなたの名前はコーディ（Cody）です。` | `src/mind/fire-orchestrator.mjs:137-154` | Session system prompt; all current brains |
| Whisper lexical bias | `こーでぃー、コーディ。` | `src/ears/whisper-inference.mjs:40-50` | Request-form vocabulary bias only |
| Audio call variants | `コーディ/コーディー/コーティ/コーティー` | `src/mind/fire-scheduler.mjs:204-218` | Voice call matching |
| Comment call variants | `Cody/cody/CODY/コーディ/コーディー/コーティ/コーティー/こーでぃー` (8 values) | `src/mind/fire-scheduler.mjs:183-202` | Text/comment matching; includes one hiragana form and is asymmetric with the 4-value audio set |
| Cockpit title/header | `こーでぃー — Soul Cockpit` / h1 `こーでぃー` | `src/cockpit/cockpit.html:1-6`, `ui/header.mjs:43-56` | Static UI; brain-independent |
| Stream disclosure | `AI の相方「コーディ(Cody)」` | `discussion/ai-cohost/operations/pre-stream-checklist.md:6-38` | Draft operational wording |
| TTS speaker | numeric `888753760` default | `src/voice/tts-client.mjs:25-27,94-110` | Voice synthesis ID; no name mapping |

### 4.2 Current brain registry / technical owners

| Selection ID | UI label | Adapter/provider | Model/effort | Credential path |
|---|---|---|---|---|
| `claude` | Claude (Opus 4.8) | `createLlmSession` / Anthropic | `claude-opus-4-8` / SDK default | `~/.claude/.credentials.json` |
| `codex` | Codex (GPT-5.6 Terra) | `createCodexSession` / OpenAI Codex | `gpt-5.6-terra` / `none` | `~/.codex/auth.json` |
| `codex-55` | Codex (GPT-5.5) | same | `gpt-5.5` / `none` wrapper | same |
| `codex-56-sol` | Codex (GPT-5.6 Sol) | same | `gpt-5.6-sol` / wrapper sets `none` (official validity unverified; inference) | same |

Registry owner is `src/mind/brains.mjs:26-33,47-90`; Claude/Codex defaults are in `llm-session.mjs:48` and `codex-session.mjs:71`; UI `BRAIN_LABELS` and `/api/brain` IDs are duplicated in `health.mjs:89-110` and `cockpit-server.mjs:1051-1080` (02,04).

## 5. Existing extension points

These are repository seams, not adopted implementation designs.

| Seam | Current behavior | If identity is connected, affected surfaces |
|---|---|---|
| `BrainEntry` / registry | `id/label/create/credentialPath`; frozen table; provider inferred by factory | Add metadata or a separate resolver; update registry tests, brain labels, server IDs, and compatibility policy |
| Session creation | `composeSystemPrompt(FIRE_SYSTEM_PROMPT, memory)` at lazy session creation; Claude native prompt vs Codex first-turn prefix | Prompt self-name/persona scope, session snapshot, dispose/recreate boundary, model-specific behavior |
| Scheduler / Whisper | `nameVariants`/`commentNameVariants` options; Whisper `options.prompt` | Series/model vocabulary, Japanese/English forms, false-positive/precision policy, ASR human sweep |
| Settings | `brainChoice` read-modify-write; unknown fallback Claude | Registry vs user-editable authority, new key/schema/migration, fallback semantics |
| HTTP/SSE/UI | server validates 4 IDs; health labels duplicate; snapshot/SSE additive raw brain ID | UI header, SettingsDrawer, latency/usage/feed labels, ARIA, `/api/state` and unknown/null compatibility |
| Transcript/history | immutable entries with `speaker/displayName/text`; memory plain Markdown | Additive provenance fields, old-entry `unknown` handling, snapshot vs dynamic history resolution |
| TTS/playback | numeric speaker injected via deps; WAV temp path; no brain mapping | Voice registry/mapping, restart persistence, in-flight speaker semantics, cleanup/retention |
| Disclosure/docs | pre-stream checklist, README, Terra spike, wave/benchmark copies | Operational name/voice/kill language, stale-copy audit; historical text must not be rewritten blindly |

## 6. Persistence and compatibility implications

### Current storage and wire facts

- `cockpit-settings.local.json` persists `brainChoice` (and `memoryEnabled`/other settings), not Soul name, persona, identity schema/version, model snapshot, or TTS speaker. Unknown/old brain values fall back to Claude (02,04).
- `TranscriptEntry` stores sequence/times/text/speaker/displayName; Soul name, provider/model, voice, and generation brain are absent. SSE transcript/usage carries additive raw `brain` at broadcast time, so in-flight attribution may be wrong. Old entries remain structurally readable only because identity is absent (01–04).
- Memory files are timestamp-derived Markdown, viewer names are removed, and no brain/name/voice metadata is stored. Existing text may contain a spoken name, but that is not structured attribution; previous files cannot be deterministically re-resolved to a historical model/name (03).
- Codex rollout can persist provider-side session material and only its own thread-id sidecar cleanup is attempted; Claude uses `persistSession:false`. TTS writes short-lived WAVs under OS temp and the current path does not explicitly remove them. These are separate privacy/retention surfaces (03).
- The `codex-56-sol` wrapper currently sets `effort: none`; primary evidence treats official provider validity of that setting as unverified/inferred, not as a settled provider contract. Identity mapping does not resolve this uncertainty (02).

### Compatibility/migration risks

1. Replacing only the prompt or header creates drift across ASR bias, call matchers, UI, disclosure, tests, and duplicated docs.
2. Adding structured identity fields is additive for new payloads, but old transcript entries/files need `null|unknown` compatibility or a deliberate non-rewrite policy. Rewriting historical text can alter actual utterances.
3. Registry labels, server IDs, UI options, and fallback behavior are independently owned. Partial updates can produce UI unknowns, API 400s, or registry fallback to Claude.
4. Session prompt snapshot and dynamic current-brain wire tags can produce mixed identity during swap; binding a Soul name to the same dynamic source inherits the mismatch.
5. User-editable names would need persistence/version/fallback and disclosure/ASR synchronization; registry-defined names reduce drift but make personalization and per-install overrides unavailable.
6. Sharing viewer `displayName` with Soul identity would cross an existing privacy boundary. Memory’s name removal does not erase live transcript/SSE/diagnostic/provider-retention exposure.
7. Codex rollout and OS temp WAV retention differ from Claude/memory behavior; identity migration must not imply a uniform privacy guarantee.

## 7. Tests and verification surfaces

### Existing machine surfaces

- Registry: 4 IDs, freeze, labels, credential paths, GPT-5.5/Sol model wrappers (`src/mind/brains.test.mjs:16-39,93-128`).
- Session/prompt: Claude systemPrompt/model/options and persistence semantics (`src/mind/llm-session.test.mjs:107-129`), Codex adapter fake SDK/thread/image behavior (`src/mind/codex-session.test.mjs`).
- Identity/name: FIRE prompt includes `コーディ`; Whisper prompt is form-only and does not contaminate transcript; scheduler checks four voice variants, soul self-call exclusion, comment Cody variants (`fire-orchestrator.test.mjs:49-62`, `whisper-inference.test.mjs:95-159`, `fire-scheduler.test.mjs:96-190,520-536`).
- UI/API/wire: fixed header, 4 brain options, `/api/brain` 4-value/400/503, snapshot/SSE raw brain/null compatibility, raw ID latency/usage formatting (`cockpit-ui.test.mjs`, `health.test.mjs`, `cockpit-server.test.mjs`, `transcript.test.mjs`, `usage.test.mjs`).
- Persistence/memory/TTS: brainChoice roundtrip/corrupt/unwritable, viewer-name omission and digest lifecycle, numeric TTS speaker/WAV temp (`cockpit-settings-store.test.mjs:574-655`, `memory.test.mjs:28-74,104-193,339-364`, `tts-client.test.mjs:101-130,148-164`).

### Current verification / evidence boundary

- Primary report 01 records selected worker-free imports **360/360 pass** across orchestrator, scheduler, Whisper, transcript, injection, cockpit, UI, memory, and name-prompt bench modules.
- Primary report 04 attempted a 12-file `node --test` focused run (and a single-file run); all stopped before assertions with child-process `spawn EPERM`. Primary report 02 similarly records the full runner blocked before assertions. Therefore no full-run green result is claimed here.
- No real SDK/network, microphone/Whisper, TTS, YouTube comments, Electron UI, screen reader, or end-to-end provider attribution run was performed.
- Existing brain-swap/verbosity wave counts (724/724, 797→835, etc.) are historical evidence, not rerun identity acceptance.

### Boundary verification (current direct check; separate from accepted policy)

- The accepted `apps/soul` special-zone boundary remains a scope/policy fact: Runtime Player/Editor identity is outside this inventory.
- `pnpm.cmd run check:soul-zone` (underlying `scripts/check-soul-zone-boundary.mjs`) directly scanned **1,389 source files**, exited 0, and found no `器→魂` imports and no `魂→器` code imports. This is current import-direction verification only; it does not accept identity semantics, privacy, provider retention, persona/voice, or disclosure.
- `pnpm.cmd run check:soul-zone:fixtures` exited 1 because its `spawnSync` wrapper returned undefined status/output in this environment. Direct fixture invocations of the same guard separately passed the valid fixture (exit 0) and rejected all four invalid fixtures (exit 1); wrapper failure is therefore retained as an environment limitation, not a current-source violation (01:278-297).

## 8. Risks and ambiguous semantics

The following choices are intentionally left open. Each row gives viable directions and their impact without selecting one.

| Question | Option A | Option B / additional direction | Main impact to compare |
|---|---|---|---|
| Identity粒度 | **Series-defined:** Claude→コーディ, GPT→チャッピー | **Model-defined:** Opus/Terra/5.5/Sol each own name; a hybrid series default + per-model override is also possible | Series is stable across model upgrades and reduces vocabulary; model-level attribution is precise but increases UI/disclosure/migration surface |
| Authority | **Registry-defined:** identity metadata travels with technical entry/resolver | **User-editable:** per-install settings override; a split registry default + user alias is another viable shape | Registry reduces drift and keeps ASR/disclosure coherent; editable names enable personalization but require schema/version/fallback, privacy, and stale-copy handling |
| Swap timing | **Next Fire:** existing v0 dispose→null, new name/prompt on next session | **Immediate:** cancel/finish in-flight work with generation-scoped attribution; optionally preserve old session snapshot | Next-Fire is compatible with current lifecycle and avoids mixed prompt; immediate feels responsive but requires transactional attribution, cancellation, and UI rules |
| History semantics | **Snapshot:** store generation brain/model/name/voice on new transcript/SSE/memory records | **Dynamic:** resolve historical IDs through current registry/name at display time; old records remain unknown or unchanged | Snapshot improves auditability but adds fields/storage/migration; dynamic follows current labels but can rewrite perceived history and cannot recover old identity |
| Prompt/persona/TTS scope | **Narrow identity:** UI/ASR/disclosure only; prompt/persona/voice remain shared | **Full bundle:** self-recognition/persona/TTS speaker follow identity; or split dimensions (name shared, persona/voice independent) | Narrow scope limits behavior/voice regressions; full bundle improves coherence but couples prompt/session, ASR, persona, TTS persistence, and human/product gates |

Additional unresolved vocabulary choice: Japanese/English `チャッピー` variants, ASR precision/recall and false-positive tolerance, and whether technical raw IDs remain beside a human-facing identity in latency/usage.

Model/provider qualification also remains unresolved: `codex-56-sol` is configured with `effort: none` by the wrapper, while official validity was not verified and is retained as inference rather than a provider fact.

## 9. Facts closable from repo

1. Production self-name is `コーディ（Cody）`; `チャッピー` is absent from source/docs/tests/config under the bounded search.
2. Name surfaces are separately owned by `FIRE_SYSTEM_PROMPT`, Whisper prompt, voice/text call variants, Cockpit title/header, and disclosure copy.
3. Current brain IDs are `claude`, `codex`, `codex-55`, `codex-56-sol`; provider is inferred from factory and model IDs/effort are adapter/wrapper values. For Sol specifically, the wrapper sets `effort: none`, while official validity remains unverified/inferred.
4. UI labels and server validation duplicate registry knowledge; `brainChoice` is the only persisted brain selection and unknown values fallback to Claude.
5. Runtime swap is `dispose→null→next Fire`; KILL is head-independent; the accepted v0 mainline is pre-stream selection, while in-flight attribution is a known approximation.
6. Transcript/SSE use `soul` speaker and broadcast-time raw brain; viewer `displayName` is distinct and memory digest removes it.
7. Memory files have timestamp-derived names and no structured brain/model/name/voice metadata; Claude disables provider session persistence while Codex performs best-effort own-thread cleanup; TTS uses numeric speaker and OS-temp WAV.
8. Existing tests cover fixed values, labels, API, settings, prompt, ASR, call matching, memory privacy, and TTS seams; no identity mapping, history attribution, or direct settings interaction fixture exists.
9. Selected worker-free tests pass 360/360 in report 01; normal Node runner evidence is blocked by `spawn EPERM`; no human identity acceptance was run.

## 10. Premises requiring user decision

These are not closed by repository facts and are not selected here:

1. Apply `チャッピー` to the GPT series as a shared identity, to each GPT model row, or via a hybrid default/override.
2. Make identity authority registry-defined, user-editable, or split between registry default and a user alias; define unknown/fallback and persistence behavior.
3. Switch identity on next Fire (current lifecycle) or immediately during live/in-flight work; define cancellation, old-session attribution, and UI transition behavior.
4. Store generation-time brain/model/provider/name/voice snapshots in transcript/SSE/memory, resolve names dynamically, or preserve old records as `unknown` without rewriting text.
5. Decide whether self-recognition prompt, persona wording, ASR bias/call variants, Cockpit title, transcript/usage labels, TTS voice, and stream disclosure are one identity bundle or independent dimensions.
6. Define Japanese/English/romanized `チャッピー` variants and acceptable precision/recall/false-positive envelope for voice and comment calls.
7. Decide whether technical raw brain IDs/model labels remain visible beside a human identity in latency/usage and diagnostics.
8. Decide privacy/retention requirements for Codex provider-side rollout, OS-temp WAVs, viewer displayName in live/provider paths, and identity metadata in local memory/history.

## 11. Evidence index and limitations

### Primary report index

| Report | Integrated contribution |
|---|---|
| `01-fixed-name-and-identity-flow.md` | Fixed-name locations, voice/comment flow, transcript/SSE boundary, 360/360 selected tests, direct extension seams, closed facts and user decisions. |
| `02-brain-registry-and-model-selection.md` | Four-entry registry/provider/model/credential table, settings→swap lifecycle, duplicated UI/server owners, state snapshot and historical brain-swap evidence. |
| `03-memory-prompt-voice-persistence.md` | Session prompt snapshot, memory digest lifecycle/privacy, Codex/Claude persistence asymmetry, TTS/WAV retention, snapshot-vs-dynamic implications. |
| `04-ui-contracts-and-tests.md` | UI/API/wire fixed values, compatibility/null behavior, existing fixtures, direct interaction/a11y gaps, current `spawn EPERM` test limitation. |

### Key repository evidence

- `apps/soul/agent/src/mind/brains.mjs:26-33,47-90` — registry IDs/labels/factories/credential paths; no identity field.
- `apps/soul/agent/src/mind/fire-orchestrator.mjs:137-154,333-367,455-465` — fixed self-name prompt and Soul transcript append.
- `apps/soul/agent/src/ears/whisper-inference.mjs:40-50,74-89`; `src/mind/fire-scheduler.mjs:183-218` — ASR and call vocabulary seams.
- `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:181-195`; `scripts/cockpit.mjs:518-557,692-721,780-825` — brainChoice/currentBrain/session lifecycle.
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:378-387,530-582,1051-1080,1283-1333`; UI `health.mjs`, `settings-drawer.mjs`, `header.mjs` — API/snapshot/SSE/UI boundaries and duplicated owners.
- `apps/soul/agent/src/mind/memory.mjs:20-34,60-99,144-178,237-253`; `src/voice/tts-client.mjs:25-27,94-110`; `src/voice/audio-player.mjs:165-184,299-328` — privacy, digest, speaker, and retention surfaces.
- `discussion/ai-cohost/soul/brain-swap.md:7-18`; `stream-memory.md:14-25`; `operations/pre-stream-checklist.md:6-38` — accepted swap/memory behavior and stale disclosure copy.
- Tests: `apps/soul/agent/src/mind/{brains,fire-orchestrator,fire-scheduler,memory}.test.mjs`, ears/Whisper tests, cockpit API/UI/settings tests, view-logic transcript/usage tests, TTS tests.
- Verification results: primary report 01 selected worker-free imports `360/360`; primary reports 02/04 Node runner attempts blocked by `spawn EPERM`; no external/device run.
- Boundary verification: primary report 01:278-297 records `pnpm.cmd run check:soul-zone` exit 0 (1,389 files, no cross-boundary code imports), the fixture wrapper exit 1 from environment `spawnSync`, and direct fixture guard results (valid exit 0; four invalid fixtures exit 1). This current check is separate from the accepted `apps/soul` policy boundary.

### Limitations

- This is a bounded repository inventory, not an implementation or identity design decision. No source, tests, map, contract, provider, UI, or documentation was changed.
- External provider model/retention specifications, legal/disclosure wording, TTS voice quality, real ASR false-positive rates, and live-stream behavior were not revalidated.
- Existing historical wave counts and selected test imports are evidence classes only; worker-free 360/360 is not a full runner or human acceptance.
- The direct soul-zone guard verifies import direction only; fixture wrapper limitations and provider/identity semantics remain separate gates.
- Local ignored settings/ledger/memory values were not reproduced in this report; secrets, provider files, and rollout contents were not inspected.
