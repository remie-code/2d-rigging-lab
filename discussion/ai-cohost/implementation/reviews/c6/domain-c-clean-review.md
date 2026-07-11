# C6 Domain C clean review: 最終統合 + C6 wave 全体の整合

> レビュー担当: Review-Sylph(Orch-Sylph からのサブエージェント委任、clean review)。2026-07-12。
> 焦点: Domain C の統合作業(モノレポ検証・無変更確認・docs更新・比較ゲート手順)の正しさと、C6 wave 全体(A+B+C)が整合して閉じているかの検証。読み取り専任(ソース無変更、検証コマンドのみ実行)。

## 判定: **合格**(blocking なし)

Domain C の統合作業は全観点で実装事実に忠実。C6 wave 全体は整合して閉じており、**残るオープン項目は後着置換 direction(a) の Undine 裁定のみ**(Domain C は横取りせず、正しくオープンとして明記)。機械ゲートは充足、比較ゲート(人間)は未実施として正確に切り分けられている。過剰主張は無い。

---

## 観点別の適合

### 1. モノレポ検証の裏取り(自分で再実行) — 適合

Domain C 報告の数値を自分の実行で完全再現した。

| 検証 | Domain C 報告 | 自分の再実行結果 | 一致 |
|---|---|---|---|
| `pnpm run typecheck`(runtime-player) | 0 error | **pass, 0 error**(`tsc --noEmit -p tsconfig.json` 出力にエラー行なし) | ✓ |
| `pnpm run test:unit`(runtime-player) | 137 files pass / 2 fail、904 tests pass / 2 fail | **Test Files 2 failed \| 137 passed (139) / Tests 2 failed \| 904 passed (906)**、Duration 9.53s | ✓ |
| `pnpm run check:source`(root) | physiology/index.ts の C3 既存1件のみ | **`apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint` の1件のみ** | ✓ |
| `node scripts/check-soul-zone-boundary.mjs`(root) | pass | **pass**(`1248 source files scanned; no 器→魂 imports and no 魂→器 code imports`) | ✓ |

`pnpm install` は実行していない(検証は既存依存で成立、escalate 不要)。

### 2. 既知 baseline 分類の正しさ — 適合(新規退行ゼロ)

test:unit の失敗2件を**自分の実行ログで名前を列挙して確認**:
1. `src/main/broadcast-source/browser-source-server.test.ts` > "accepts the not-loaded response shape"
2. `src/stage/browser-source/browser-source-server-message.test.ts` > `readBrowserSourceRuntimeExportResponse` > "accepts the not-loaded response shape"(216:9)

両者とも差分は `+ "effectiveDynamicsTuning": null` の1キー増のみ(`- Expected / + Received` を実ログで確認)。**browser-source 系・`effectiveDynamicsTuning` 由来で control-channel/speech 経路と完全無関係**。control-channel・speech-timeline の全テストは pass(139 files 中、失敗はこの browser-source 2件のみ)。check:source も physiology barrel の C3 既存1件のみで、control-channel の追加4本・変更13本は違反ゼロ。**C6 差分は新規 fail も新規違反も1件も生んでいない**。

### 3. 無変更確認の正しさ — 適合(git で機械確認)

`git diff --stat` を保護対象へ限定して自分で実行し、全て空(diff ゼロ)を確認:
- `apps/runtime-player/src/main/physiology/`(生理 golden・生成器純度)→ **無変更**
- `apps/runtime-player/src/main/live-mapping/headless-slot-resolver.ts`(リゾルバ)→ **無変更**
- `apps/editor/`(Editor)→ **無変更**
- `pnpm-lock.yaml`(lockfile)→ **無変更**
- 心臓 seam `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts` / `input-subsystem.ts` → **無変更**
- package-format / Runtime Export schema → 変更ファイル一覧に不在=**無変更**
- `apps/soul/package.json` → `Test-Path` で **ABSENT**(不在)
- C6 差分の実行時 role 分岐: `git diff | grep "role ===|if (role|role==="` → **0 件**

C6 の変更は control-channel(tracked 12 + untracked 4)+ `reference-driver.mjs`(1)+ discussion のみに限局(`git status --short` で確認)。

### 4. docs 更新の正確性(過剰主張の不在) — 適合

`git diff` で両 docs の追記内容を精査。

- **`c6-wave-plan.md` §1**: `Status: Ready to launch` → `実装完了(Domain A/B 合格、Domain C 統合)`。**「機械ゲートは実装・検証済み / 最終審=比較ゲートはユーザー人間ゲート待ち」と明示的に切り分け**。Domain C の検証数値(typecheck 0 / 904 pass / baseline のみ)を正確に転記。**比較ゲートを「合格」とは書いていない**(「人間ゲート待ち」と明記)。
- **`c6-mouth-phoneme-timeline.md` §7.1(新規追記、既存 §7 は改変なし)**: 機械ゲート(凸恒等・再調音ディップ・undershoot・512拒否・無退行)が満たされた事実を記録しつつ、**「比較ゲート(§5 二体並置)は未実施——ユーザーの人間ゲート待ちが正しい状態」と明記**。「機械が保証できるのは性質までで、最終審は依然として §5 の比較ゲート」と限界を正直に述べている。
- **後着置換 direction(a)**: 両 docs とも **「オープン項目(Undine 裁定待ち)」として明記**し、`setSpeech` 時の口 per-slot 曲線 delete vs release を「実装は現状 delete、裁定が済むまで現状維持」と記す。**Domain C は設計裁定を横取りしていない**(勝手に決着させていない)。

過剰主張・偽りの「合格」表記は無い。

### 5. 比較ゲート手順の実コード整合 — 適合(全参照を実コードと突合)

`c6-comparison-gate.md` の参照を実コードと1点ずつ照合、全て一致:

| 手順の記述 | 実コードでの確認 |
|---|---|
| dry-run `--scenario=speech --print-timeline` | `reference-driver.mjs`:101-102(`--print-timeline` で `buildTimeline` を stdout・exit 0)、453-458(`scenario==="speech"` → `speechSections()`) ✓ |
| live 送信 `... "<ws-url>" --scenario=speech` | 281-282(`parseScenarioFlag` が `speech` を返す)、565-586(`speechTimelineMoras` → `sendSpeech(timeline)` → speechSpanMs+600ms 観測 → close) ✓ |
| WS URL 形 `ws://127.0.0.1:<port>/channel?token=<token>` | `channel-url.ts`:3・9・11・13(bindAddress=127.0.0.1、path=/channel、tokenQueryKey=token)、`createControlChannelWebSocketUrl` 実在 ✓ |
| Channel ページ「Open Channel」→「Endpoint」行→「Copy Channel URL」 | `channel-page.tsx`:79(`label="Open Channel"`)、87(`StatusRow label="Endpoint"`)、91-92(`label="Copy Channel URL" onClick={onCopyChannelUrl}`) ✓ |
| Mapping ページの「Vowel lipsync」トグル(`vowelLipsyncSupported` 時に出現) | `mapping-page.tsx`:169-171(`group.label === "Mouth" && vowelLipsyncSupported` で `VowelLipsyncToggle`)、203(ラベル `Vowel lipsync`) ✓ |
| テストモデル前提(`mouth.vowel.*` + `mouth.open` の external-input 保有) | 設計 §7 裁定7と一致。手順 §1.1 が `slotNotWritable` の理由も正しく説明 ✓ |
| fixture モーラ列 15 モーラ「これじっさいのところどうなってるの」 | `reference-driver.mjs`:413-447(`speechTimelineMoras`)、契約 examples と手写し同一の注記も一貫 ✓ |
| 観察4点(並置・「のところど」再調音ディップ・終端 release・kill releaseAll) | 設計 §5 比較法・wave計画 §7 Manual Check Notes と対応(§7 の3点+切断 kill を1点足した4点、いずれも §5/§7 に根拠あり) ✓ |

ユーザーがこの手順で実際に二体並置を実施できる粒度(起動コマンド・URL 取得の click 手順・トグル所在・観察点の合否基準)が揃っている。

### 6. wave 全体の整合(A+B+C が閉じているか) — 適合

`intent.speech` の縦貫が差分に実在することを確認: `git diff | grep "intent.speech|setSpeech|speechTimeline|readIntentSpeech"` = **78 ヒット**(契約 schema・validation・dispatch・server・overlay-store の setSpeech・speech-timeline-state に横断)。新規 untracked も `channel-intent-speech-payload-schema.json`・`speech-timeline-state.ts`・その test・`reference-driver-speech-timeline.test.ts` が存在。契約→validation→dispatch→server→setSpeech→グループ評価器→6スロットの縦貫が配線され、test:unit で全 pass。

AC §8 各項目の充足:
- 縦貫(モーラ列→口が話す): ✓(差分に配線・speech テスト pass)
- 凸恒等 Σvowel=s=mouth.open: ✓(§7.1 全tick性質テスト、Domain A レビュー合格済み)
- 非静止(再調音ディップ「のところど」): ✓ / undershoot: ✓(性質テスト)
- 512拒否・時刻単調・拒否語彙不増殖: ✓(`invalidPayload`/`slotValueOutOfRange` のみ、新 rejection code なし)
- 後着置換・終端/切断 release(閉口): ✓(実装済み。direction(a) の delete vs release のみオープン)
- C4/C5 後方互換・physiology 純度・golden・リゾルバ・トラッキング経路 無退行: ✓(diff ゼロ + test pass)
- 実行時 role 分岐ゼロ: ✓(grep 0 件)
- Editor/package-format/Runtime Export schema/lockfile 無変更・新規依存なし・`pnpm install` なし・`apps/soul` package.json 不在: ✓

**残る唯一のオープン項目 = direction(a)(delete vs release)の Undine 裁定**。これのみが未決で、正しくオープン扱い。他は全て閉じている。

---

## 検証の生結果(要点)

- typecheck: `tsc --noEmit -p tsconfig.json` エラー出力なし(pass)。
- test:unit: `Test Files 2 failed | 137 passed (139) / Tests 2 failed | 904 passed (906)`、Duration 9.53s。失敗=browser-source `effectiveDynamicsTuning: null` 2件のみ。
- check:source: 違反1件 `physiology/index.ts: index.ts must remain a barrel-only entrypoint`(既知 C3)のみ。
- check:soul-zone: `Soul zone boundary guard passed: 1248 source files scanned`。
- 保護対象 `git diff --stat`: 全て空。`apps/soul/package.json` ABSENT。role 分岐 grep 0 件。

## docs の正確性評価

両 docs とも実装事実に忠実で、機械ゲート充足と比較ゲート(人間)未実施の切り分けが正確。比較ゲートを「合格」と偽っていない。direction(a) を勝手に決着させず「Undine 裁定待ちのオープン項目」として明記——設計裁定の横取りは無い。§7.1 は既存 §7 を改変せず追記のみ。

## 比較ゲート手順の実コード整合

観点5の表の通り、起動コマンド形(`--scenario=speech`/`--print-timeline`)・WS URL 形・Open Channel/Endpoint/Copy Channel URL・Vowel lipsync トグルの所在(`vowelLipsyncSupported` ゲート)・テストモデル前提・15モーラ fixture・観察4点、いずれも実コード/設計 §5・§7 と一致。ユーザーが実施できる粒度。

## wave 全体の閉じ具合

A+B+C は整合して閉じている。intent.speech の縦貫が実在し全 pass。機械ゲート(AC §8 の性質項目・無退行・無変更・install 無し・role 分岐ゼロ)は全充足。**未決は direction(a) の Undine 裁定 1 点のみ**で、これはコード修正ではなく設計判断であり、docs にオープンとして正しく記録済み。

## blocking の有無

**blocking なし。** 要修正事項なし。

## 質問(Orch-Sylph へ)

1. **Domain C 報告 §3・§5 が挙げた「Wave21 ラベル不確実」問題**: wave計画 §8 AC の既知 baseline を "Wave21 browser-source系2件" と表記しているが、実測では失敗2件は `effectiveDynamicsTuning: null` 差分(dynamics-tuning 由来、コミット `4627bbd` 疑い)。分類「browser-source 系 baseline」自体は確定だが "Wave21" ラベルは不正確な可能性。これはレビュー合否には無関係(実害なし)だが、§8 の表記を正すか("dynamics-tuning 由来" 等)、または "browser-source 系 baseline" のみに簡略化するかは命名の正の問題として Orch-Sylph/Undine の判断領分。**本レビューでは修正しない**(読み取り専任 + 命名裁定は横取りしない)。
2. **direction(a)(delete vs release)の Undine 裁定とコミット順**: 唯一のオープン項目。裁定を取り込んでからコミットするか、現状 delete で一旦コミットし裁定を別 wave 送りにするかは Orch-Sylph の判断待ち。docs は既に現状維持で整合しているため、どちらの順でも矛盾は生じない。
