# Domain C — Cockpit Settings modal design review

- ループ: 3（targeted identity-authority re-review）
- 判定: **PASS（BLOCKING 0件）**
- 対象: Domain C conversation-instruction editor、同一 dialog 統合、Domain A API 消費

## 結論

Loop 2 後の identity projection は除去され、canonical active identity authority が復元された。現行 `conversationBrainIdentity()` は、editor の technical brain が active technical brain と一致し、かつ既存 server/registry の identity pair が well-formed な場合だけ `{id, displayName}` を表示する。非 active profile では identity を推測せず `非アクティブ（identity は表示しません）` と明示する。

従って、technical label と表示 identity の不一致を引き起こす brain→Cody/Chappy の重複表はなく、API/state/identity boundary を拡張せずに「表示できる canonical fact」と「表示できない非 active fact」を区別している。前回の dirty keyboard guard、per-brain async race protection、同一 dialog/accessibility、memory本文非表示にも退行はない。

**判定: PASS — blocking 0。**

## レビュー基準・範囲

- `.agents/skills/implementation-orchestration/SKILL.md`（Orch/Gnome/Review 分離、fake-only、指定 report のみ書く規約）
- `discussion/_conventions.md`
- `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md`
- Domain A/B/C completion reports と A/B/C loop-2 design context
- 現行 C source/test/diff: `settings-drawer.mjs`, `conversation-instruction-editor.mjs`, `view-logic/conversation-instruction.mjs` と test、`cockpit-ui.test.mjs`, `app.mjs`, `styles.mjs`

この report 以外の source/test/report は変更していない。共有 dirty worktree の unrelated paths は保持した。

## Loop-2 findings の targeted closure

### C-DESIGN-01 — keyboard dirty guard: PASS / CLOSED

`settingsModalKeyboardCategoryAction()` は tab 遷移先と focus callback を計算するだけで、直接 state を変更しない。dialog key handler (`settings-drawer.mjs:401-422`) は `requestCategory(nextId, after, "category-keyboard")` を呼び、`requestCategory()` は click tab と共通の `runGuardedNavigation()` → `settingsModalEventRoute()` → `settingsModalGuardedNavigation()` を通る。

- clean: category state を更新し、遷移後 callback で target tab を focus
- dirty: pending action と inline discard/continue prompt を設定し、state/focus を保留
- discard: selected draft を discard して pending action と focus callback を実行
- continue: editor/category/focus を維持

ArrowLeft/ArrowRight/Home/End、click category、back、brain select、Escape、backdrop、header gear は同じ guard seam に入る。worker-free tests は4 keyboard directionsと全 dirty event typesを通過させている。Loop-1 の keyboard-only bypass は再発していない。

### C-DESIGN-02 — canonical selected-brain identity authority: PASS / CLOSED

Loop 2 の `CONVERSATION_BRAIN_IDENTITY_PROJECTIONS` と同等の handwritten brain→Cody/Chappy mapping は現行 `view-logic/conversation-instruction.mjs` から除去されている。source-level tests は次を固定する。

- canonical active fact: 各4 technical brain IDについて `brainId === activeBrainId` のとき、注入された `{id, displayName}` をそのまま返す
- non-active fact: active brain と editor target が異なる場合、identity は `null`（推測値を返さない）
- no duplicate authority: sourceに `CONVERSATION_BRAIN_IDENTITY_PROJECTIONS` および brain ID→Cody/Chappy handwritten map がない

UI は active/non-active を明示的に区別する。`ConversationInstructionEditor` は technical label を editor-selected brain ID から表示し、identity は `conversationBrainIdentity()` の結果だけを使用する。non-active target は `非アクティブ（identity は表示しません）` と表示され、active Cody/Chappy を別 brain に誤帰属しない。

これは既存 server/registry identity pair を唯一の authority として消費する設計であり、Domain A API、`/api/state`、SSE、identity registry、prompt resolver/session lifecycle の変更を追加していない。非 active brain の identity を表示する必要がある場合は別の product/API decision が必要だが、現行の accepted boundary では suppression が最も truthful な read-only behavior である。

## 設計適合（PASS）

### API consumption and authority

- `createConversationInstructionController()` は injected fetch と固定4-ID validationを持ち、専用 `GET/PUT/DELETE /api/conversation-instructions/:brainId` のみを消費する。
- prompt body/default、identity line composition、memory composition、session creation、revision lifecycle は持たない。Domain A が sole profile/runtime authority のまま。
- per-brain map と monotonic `requestSeq` により stale response を同一 brainにも別 brainにも適用しない。
- server baseline 更新と現在 draft を分離し、GET/save/reset 中の edit を失わない。

### Draft/save/reset と race

- trim-empty save は local assertive error で拒否し API を呼ばない。
- Save/reset failure は現在 draft を維持する。
- PUT→DELETE、DELETE→PUT の overlap は最新 sequence の response だけを採用する。
- 異なる brain の reverse-order PUT は draft/baseline/revision を cross-clobber しない。
- UI editor select/reset/save は busy 中に適切に disable され、navigation guard と request sequence は独立している。

### Single dialog, navigation, accessibility

- `settings-drawer.mjs` は labelled `role="dialog" aria-modal="true"` を一つだけ emitし、editor は同じ content pane 内で表示される。nested dialog/alertdialog はない。
- 4 category tab/panel、inactive panel `hidden`、roving tab index、keyboard navigation、Tab containment、focus entry/return が保持される。
- dirty warning は同一 dialog の inline `role="status"` であり nested confirmation dialog ではない。
- Fire / Fire+visual / self-fire / barge-in / verbosity / KILL-revive は modal 外で既存 handler/API のまま。
- immediate setting inputs は mounted component の local state と既存 endpoint/save/status semantics を維持する。

### Identity/memory/privacy boundary

- identity は read-only display のみ。technical label、identity pair、非 active suppression 文言は textarea/draft/API PUT payload に入らない。
- memory は `memoryStatusLabel()` の enabled/count/time structure status のみ。memory body/transcript/history は描画しない。
- C UI/view-logic に credentials/provider/network/session/prompt composition の新規 consumption はない。
- dedicated instruction response 以外の `/api/state`, SSE, transcript, usage, diagnostics, memory surfaces は C から触らない。

## Non-blocking observations

1. 非 active profile の Cody/Chappy identity は表示せず、active identity authority を守る。将来「非 active profile の identity も表示する」要件が出る場合は、registry/API の canonical seam を別途設計する必要がある。現 wave の omission は誤帰属を避ける明示仕様であり blocker ではない。
2. `domain-c.md` の loop-3 completion はこの suppression behavior と整合している。旧 loop-2 wording が残る別文書があれば closeout 時に現行 authority/suppression 表現へ揃える。
3. Browser-mounted focus entry/containment/return、Escape/backdrop、dirty prompt、実 session save/reset→next-Fire は wave human gate に残る。今回の event seam は fake-only routing の証拠であり、DOM mount/provider behavior の証拠ではない。
4. `SettingsDrawer` compatibility export と legacy `.settings-drawer` CSS aliases は Domain B shared migration に残るが、現行 UI は drawer surface を emitしない。

## Verification evidence（fresh, fake-only）

All commands ran against the current worktree. No provider, external network, microphone, TTS, chat, credential-content, or user settings-file read was performed; observed external/credential consumption: **0**.

### Syntax / guard / diff

```text
node --check on settings-drawer.mjs, conversation-instruction-editor.mjs,
  styles.mjs, app.mjs, conversation-instruction.mjs, conversation-instruction.test.mjs
exit 0 (6/6)

node scripts/check-soul-zone-boundary.mjs
exit 0 — 1,394 source files scanned; no boundary violations

git diff --check -- [Domain C target files]
exit 0 — only existing LF→CRLF normalization warnings
```

### Worker-free assertions

```text
node --test --experimental-test-isolation=none \
  view-logic/conversation-instruction.test.mjs \
  cockpit-ui.test.mjs cockpit-page.test.mjs cockpit-static-assets.test.mjs \
  view-logic/settings.test.mjs
exit 0 — 88/88 passed, 0 failed/skipped/cancelled

node --test --experimental-test-isolation=none \
  cockpit-ui.test.mjs view-logic/conversation-instruction.test.mjs
exit 0 — 57/57 passed

node --test --experimental-test-isolation=none --test-concurrency=1 \
  view-logic/control.test.mjs view-logic/status.test.mjs view-logic/health.test.mjs
exit 0 — 34/34 passed
```

The focused 57 includes keyboard/event routing, canonical active-identity pass-through, non-active suppression, duplicate-map source guards, and overlapping PUT/DELETE/cross-brain race coverage.

### Normal worker runner (kept separate)

```text
node --test --test-concurrency=1 \
  view-logic/conversation-instruction.test.mjs \
  cockpit-ui.test.mjs cockpit-page.test.mjs cockpit-static-assets.test.mjs \
  view-logic/settings.test.mjs
exit 1 — 5 files, 0 pass, 0 assertions; all failed before assertions at
ChildProcess.spawn with EPERM
```

This is the managed environment’s worker limitation, not assertion evidence and not mixed into worker-free PASS counts.

## Disposition

Domain C DESIGN **PASS — loop 3, blocking 0**. Canonical identity authority is preserved after duplicate-map removal; active profile identity is shown only from the existing server/registry fact, non-active profile identity is explicitly suppressed, and no API/state/identity boundary expansion was introduced. Previous dirty-navigation and async-race closures remain intact. No Gnome source fix is required by this design lane.
