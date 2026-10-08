# 多頭化(頭脳差し替え) Domain C レビュー — レーン: spec（契約適合・スコープ・無退行・docs 義務）

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: 実装報告 [../../waves/brain-swap/domain-c.md](../../waves/brain-swap/domain-c.md)。
> 基準: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain C + §4 blocking 基準。
> 正本: [../../../soul/brain-swap.md](../../../soul/brain-swap.md)（実パス = `discussion/ai-cohost/soul/brain-swap.md`。domain-c.md 内の相対リンク `../../../soul/brain-swap.md` は誤りで `discussion/soul/brain-swap.md` に解決される＝存在しないパス。non-blocking §1 参照）。
> 方式: Gnome の報告を鵜呑みにせず、実ファイル Read + grep + git 実行 + 独立 `node --test`（全体 + touched 7 ファイル個別）で全項目を裏取りした。

## 総合判定: **PASS**

blocking 基準（wave-plan §4 #2 無退行・#4 資格情報・#5 昇格予約 3 箇所・#6 additive）に反する事実は見つからなかった。昇格予約 3 箇所は実在を確認、既存テスト改変（settings.test.mjs / cockpit-ui.test.mjs）は純粋な additive 追随でアサーションの弱化は無い、credentialHealth は boolean の文言化のみで中身・パスはどこにも露出しない、ワイヤは additive のみ（SSE 13 種不変・新規 HTTP エンドポイントなし）。`node --test` は全体 827/827・touched 7 ファイル個別実行も全て報告書の数値と完全一致（Domain B レビューで見つかった「個別ファイルのテスト件数の自己申告水増し」問題は Domain C には無い）。

---

## 検証項目（結果）

### 1. 設定「頭脳」区画 — ○
`src/cockpit/ui/settings-drawer.mjs:470-488` に「声の出力先」行（:435-452）と同型の第 4 drawer-section を確認。`BRAIN_OPTIONS`（:71・`BRAIN_LABELS` から機械生成）を積んだ `SettingsSelect` + `onBrainSet` ハンドラ（:337-355・`onAudioSet` の写経で POST /api/brain → `brainPostErrorText` → 成功時 `applySnapshot`）+ `brainLabel`/`brainCredentialHealthLabel` の状態表示（:484-485）。ラベルは `view-logic/health.mjs:93-96` の `BRAIN_LABELS = {claude: "Claude (Opus 4.8)", codex: "Codex (GPT-5.6 Terra)"}` で委任文の期待文言と完全一致。`app.mjs:75-91` の `settingsFromSnapshot` が `brain: (s && s.brain) ?? null` を additive 追加し、`settings.brain`（`{brain, credentialHealth}`）が `SettingsDrawer` props 経由で消費されることを確認。

### 2. 観測（latencyMs + brain 札） — ○
- soul 行: `fire-orchestrator.mjs:456-463`（自然完了パスのみ）で `asked.elapsedMs` を `{...appended.entry, latencyMs}` として additive に emit → `cockpit-server.mjs:1186-1199`（`broadcastSoulTranscript`）が `entry.latencyMs`（number のときのみ・それ以外 null）と `brainStatusImpl()?.brain ?? null` を transcript イベントへ additive 追加 → `view-logic/transcript.mjs:64-68`（`latencyLabel(latencyMs, brain)`）が `"(1.5s · claude)"` 形を生成 → `ui/rows.mjs:78-80`（`feedWithTranscript`）で `d.brain` を additive に渡す。
- usage 表示: `cockpit-server.mjs:1222`（`onUsage` フック）が `{...info, brain: brainStatusImpl()?.brain ?? null}` を additive 追加 → `view-logic/usage.mjs:22-28`（`usageNoteText`）が `"usage[claude]: input=... output=..."` 形の `[brain]` タグを追加。
- いずれも `latencyMs`/`brain` 未指定時は従来どおりの文字列（後方互換）を fixture テストで固定済み（transcript.test.mjs / usage.test.mjs / cockpit-ui.test.mjs の新規テストを個別に確認）。

### 3. 【blocking #5】昇格予約 3 箇所 — ○（3 箇所とも実在確認）
brain-swap.md §5 の義務: 「(1) 本節が正本 (2) Codex アダプタのモジュールヘッダに一文 (3) README の provider 追加手引きに同旨」。

1. **正本**: `discussion/ai-cohost/soul/brain-swap.md:44-45`（§5・「昇格予約のドキュメント義務」節）。
2. **codex-session.mjs モジュールヘッダ**（Domain A の既存成果物・削除/改変されていないことを確認）: `apps/soul/agent/src/mind/codex-session.mjs:28-34`——「この base64→一時ファイル→local_image→即削除の橋渡しは Codex アダプタ内部の私事である。第二の『ローカルファイルしか読めない頭』が現れた時点で、この橋渡しは共有ヘルパへ昇格できる（discussion/ai-cohost/soul/brain-swap.md §5 参照・昇格予約はドキュメント 3 箇所義務の 1 つ）。」
3. **README provider 追加手引き**（Domain C の新規成果物）: `apps/soul/README.md:427-429`（「第三の頭を足すとき」節・項目 5）——「ローカルファイルしか読めない頭（画像を `local_image` でしか受けない等）を足す場合、Codex アダプタ（`codex-session.mjs`）の base64→一時ファイル橋渡しは共有ヘルパへ昇格できる（`discussion/ai-cohost/soul/brain-swap.md` §5 参照）。」

3 箇所とも文言・参照先が一致し、将来の実装者が第二の頭を足す際に必ず目に入る場所（正本・アダプタ内部・README 手引き）に揃っている。

### 4. 【blocking #2】無退行 — ○
- `git diff --stat apps/soul/agent/src/mind/llm-session.mjs` → 無出力（Claude 頭は 1 バイトも無変更）。
- Domain A/B ファイルへの追加変更なし: `git diff --stat` を Domain A/B の各ファイルに対して個別実行し、Domain B 自身の報告書（domain-b.md §5・domain-b-spec.md）が記録した diffstat と**完全一致**することを確認——`cockpit.mjs`(110+)・`cockpit.test.mjs`(143+)・`cockpit-settings-store.mjs`(13+)・`cockpit-settings-store.test.mjs`(83+) の 4 ファイルは Domain B 完了時点の行数のまま 1 行も増減していない（Domain C が触っていれば行数が変わるはずだが変わっていない）。`env-guard.mjs`/`env-guard.test.mjs`/`brains.mjs`/`codex-session.mjs` 等（Domain A）も `git status --short` で Domain C の変更ファイル一覧（README 1 + soul zone 16）に含まれないことを確認。
- **既存テスト改変の可否判定（重要）**: `git diff` を自分で実行し、以下 additive 追随のみであることを確認した。
  - `settings.test.mjs`: import 文へ `brainPostErrorText` を追加・既存の `for (const fn of [...])` 配列へ `brainPostErrorText` を追加（既存 3 関数のアサーションは変更なし・新規関数への同一アサーションの適用のみ）・`requestErrorText` テストへ 1 行追加。既存アサーションの削除・弱化は無い。
  - `cockpit-ui.test.mjs`: `settingsFromSnapshot(null)` の期待値 deepEqual オブジェクトへ `brain: null` フィールドを追加（他フィールドは無変更）・入力 snapshot `s` へ `brain: {...}` を追加し `assert.deepEqual(settingsFromSnapshot(s), s)` で丸ごと比較（既存フィールドの比較粒度は変わらず、むしろ deepEqual なので緩めようがない）。新規 `test()` は 2 本（brain 札 latText・SettingsSelect 頭脳区画の vnode）で報告書の「既存 deepEqual 更新・新規テスト 2 本追加」と一致。
  - 両ファイルとも既存アサーションを緩めて回帰を隠す操作は見当たらない。
- `fire-orchestrator.mjs` の diff は 2 hunks のみ（JSDoc 追記 + `emit(onSoulTranscript, appended.entry)` → `emit(onSoulTranscript, {...appended.entry, latencyMs})` の 1 行）。`killed` 判定・`containsNgWord` 判定には一切触れていない（diff にそれらの行は登場しない）。

### 5. 【blocking #4】資格情報の不可侵 — ○
`view-logic/health.mjs:116-119`（`brainCredentialHealthLabel`）は `typeof brainStatus.credentialHealth !== "boolean"` を弾いたうえで boolean → 「ログイン確認済み」/「未検出（codex login してや）」/「unknown」の 3 分岐のみ。`grep -rn "credentialHealth|credentialPath|existsSync|\.credentials\.json|auth\.json" apps/soul/agent/src` を実行し、`credentialPath`（資格情報ファイルの絶対パス文字列）は `brains.mjs`（Domain A・`existsSync` チェック用の内部利用のみ）にのみ登場し、Domain C の UI/view-logic/cockpit-server のいずれにもパス文字列・ファイル内容を扱うコードは存在しないことを確認。`cockpit-server.mjs:368-369` の JSDoc も「credentialHealth は資格情報ファイルの存在確認のみ（中身は読まない）」と明記。

### 6. 【blocking #6】additive — ○
- 新規 HTTP エンドポイントなし: `cockpit-server.mjs` の `pathname === "/..."` 分岐を自分で数えたところ **19 個**（Domain C の diff で新規追加された分岐はゼロ・`/api/brain` は Domain B が追加済み）。
- エンドポイント数コメント「18→19」訂正: `:279` と `:1059` の 2 箇所とも `19` に統一されていることを確認。実測 19 と一致。（Domain B レビュー時点の non-blocking 指摘=「pre-existing の 17 起点が不正確で 18→19 のズレが残っていた」という経緯とも整合。）
- SSE 種別は不変: `broadcast("...")` 呼び出しを全 grep し、`state/diagnostic/vad/transcript/discard/soul/fire/expression/visionCaptured/usage/selfFire/chatStatus/chatDiagnostic` の **13 種**（新規種別なし）を確認。`app.mjs` の `SSE_EVENT_NAMES` も同じ 13 個。
- 器（`apps/runtime-player`）・契約（`channel-*-contract`）・`packages/`・root `pnpm-lock.yaml`・soul package.json/package-lock.json への変更なし（`git diff --stat` 無出力）。

---

## 独立実行した生出力

### node --test（apps/soul/agent 全体、自分で実行）
```
1..827
# tests 827
# suites 0
# pass 827
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1740.9326
```
Gnome 報告の 827/827（fail/cancelled/skipped/todo 全 0）と一致。

### node --test（touched 7 ファイル個別実行、自分で実行）
```
$ node --test src/mind/fire-orchestrator.test.mjs               → tests 66 / pass 66 / fail 0
$ node --test src/cockpit/cockpit-server.test.mjs                → tests 95 / pass 95 / fail 0
$ node --test src/cockpit/view-logic/transcript.test.mjs         → tests 5  / pass 5  / fail 0
$ node --test src/cockpit/view-logic/usage.test.mjs              → tests 4  / pass 4  / fail 0
$ node --test src/cockpit/view-logic/health.test.mjs             → tests 8  / pass 8  / fail 0
$ node --test src/cockpit/view-logic/settings.test.mjs           → tests 11 / pass 11 / fail 0
$ node --test src/cockpit/cockpit-ui.test.mjs                    → tests 38 / pass 38 / fail 0
```
domain-c.md §2 の個別件数（66/95/5/4/8/11/38）と完全一致。Domain B レビューで見つかった「個別ファイルのテスト件数を自己申告で水増しした」種類の問題は Domain C の報告書には見られない。

### git diff --stat（自分で実行）
```
$ git diff --stat apps/soul/agent/src/mind/llm-session.mjs
（無出力）

$ git diff --stat -- apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/brains.test.mjs \
    apps/soul/agent/src/mind/codex-session.mjs apps/soul/agent/src/mind/codex-session.test.mjs \
    apps/soul/agent/src/mind/env-guard.mjs apps/soul/agent/src/mind/env-guard.test.mjs \
    apps/soul/agent/.gitignore apps/soul/agent/scripts/cockpit.mjs apps/soul/agent/scripts/cockpit.test.mjs \
    apps/soul/agent/src/cockpit/cockpit-settings-store.mjs apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs \
    apps/soul/agent/package.json apps/soul/agent/package-lock.json
 apps/soul/agent/.gitignore                                    |   5 +
 apps/soul/agent/scripts/cockpit.mjs                           | 110 +++++++++++++++-
 apps/soul/agent/scripts/cockpit.test.mjs                      | 143 +++++++++++++++++++++
 apps/soul/agent/src/cockpit/cockpit-settings-store.mjs        |  13 ++
 apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs   |  83 ++++++++++++
 apps/soul/agent/src/mind/env-guard.mjs                        |  57 ++++++++
 apps/soul/agent/src/mind/env-guard.test.mjs                   |  61 +++++++++
 7 files changed, 467 insertions(+), 5 deletions(-)
```
（`cockpit.mjs`/`cockpit.test.mjs`/`cockpit-settings-store.mjs`/`cockpit-settings-store.test.mjs` の行数は domain-b-spec.md の記録と完全一致＝Domain C 未改変の裏取り。`package.json`/`package-lock.json` は無出力＝install/lockfile 不変。`brains.mjs`/`codex-session.mjs` 等は untracked のため diff --stat 自体は対象外＝別途 `git status` で Domain C の変更ファイル一覧に含まれないことを確認。）

### git status --short apps/soul/（自分で実行）
```
 M apps/soul/README.md
 M apps/soul/agent/.gitignore
 M apps/soul/agent/scripts/cockpit.mjs
 M apps/soul/agent/scripts/cockpit.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-settings-store.mjs
 M apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
 M apps/soul/agent/src/cockpit/ui/app.mjs
 M apps/soul/agent/src/cockpit/ui/rows.mjs
 M apps/soul/agent/src/cockpit/ui/settings-drawer.mjs
 M apps/soul/agent/src/cockpit/view-logic/health.mjs
 M apps/soul/agent/src/cockpit/view-logic/health.test.mjs
 M apps/soul/agent/src/cockpit/view-logic/settings.mjs
 M apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
 M apps/soul/agent/src/cockpit/view-logic/transcript.mjs
 M apps/soul/agent/src/cockpit/view-logic/transcript.test.mjs
 M apps/soul/agent/src/cockpit/view-logic/usage.mjs
 M apps/soul/agent/src/cockpit/view-logic/usage.test.mjs
 M apps/soul/agent/src/mind/env-guard.mjs
 M apps/soul/agent/src/mind/env-guard.test.mjs
 M apps/soul/agent/src/mind/fire-orchestrator.mjs
 M apps/soul/agent/src/mind/fire-orchestrator.test.mjs
?? apps/soul/agent/src/mind/brains.mjs
?? apps/soul/agent/src/mind/brains.test.mjs
?? apps/soul/agent/src/mind/codex-session.mjs
?? apps/soul/agent/src/mind/codex-session.test.mjs
```
domain-c.md §5 の記載と一致。

---

## non-blocking の気づき

1. **domain-c.md 冒頭のリンク切れ（軽微）**: `domain-c.md:6` の正本リンク `[../../../soul/brain-swap.md](../../../soul/brain-swap.md)` は `discussion/ai-cohost/implementation/waves/brain-swap/domain-c.md` からの相対パスとして `discussion/soul/brain-swap.md` に解決されるが、実ファイルは `discussion/ai-cohost/soul/brain-swap.md`（1 階層足りない）。内容の参照自体（§5 の昇格予約文言等）は実装側で正しく引用されており blocking には該当しないが、報告書のリンクは訂正推奨。委任文中の「正本」リンクも同じ誤りを含んでいたため、Orch 側の委任テンプレートも合わせて確認されたい。
2. **設定引き出し「頭脳」区画のインタラクションテストが構造的に作れない件（domain-c.md §3-5・§7-1）**: 既存の `onAudioSet` 等と同型の構造的制約（hooks 使用コンポーネントを vnode 走査で検証できない・domain-b レビュー §6 申し送り 8 で既出）であり、Domain C 固有の後退ではない。葉部品の vnode 走査 + view-logic fixture による代替は妥当。テスト基盤（jsdom 等）の追加投資は横断的な判断事項であり Orch/L0 裁定に委ねる。
3. **brain select の現況同期を useEffect（chat source 型の編集中ガード無し）にした件（domain-c.md §3-4・§7-2）**: 選択途中で SSE state が到着すると選択がリセットされうる。実運用は「選ぶ→即 Set」の短いフローで実害は小さいという Gnome の判断は妥当に見えるが、人間ゲートでの体感確認が望ましい（followup §C-3 に記録済み）。
4. **usage/latency の brain 札の意匠（区切り文字 `·`・位置）は裁量判断（domain-c.md §3-3・§7-3）**: cockpit-redesign.md に明記がないための Domain C 裁量。人間ゲートでの見た目確認が望ましいが、view-logic 側 1 箇所の変更で閉じる設計になっており技術的リスクは低い。
5. **in-flight 頭切替時の brain 札近似（domain-c.md §3-2）**: 配信中切替直後の応答に旧頭ではなく新頭の札が乗りうる近似。v0 裁定（配信前選択が本線・切替は運用外）の範囲内であり blocking には該当しない。followup §C-1 に記録済み。

## 質問（Orch 宛て）

特になし。今回の検証範囲（spec レーン: 契約適合・スコープ・無退行・docs 義務）において Gnome の報告内容と実ファイルの間に齟齬は見つからなかった。上記 non-blocking §1（リンク切れ）のみ、報告書または委任テンプレートの軽微な訂正を検討されたい。
