# C5 Domain C レビュー (lane1: spec 適合) — Stage Presence を合成後実効body信号へ差し替え

> Reviewer: Review-Sylph (opus, lane1=spec 適合)。Orch-Sylph からの委任。
> 対象: `cohost-c5-stage-presence-effective`（裁定1「体は一つ」）。
> 判定基準: c5-wave-plan.md §3/§6/§8/§9/§10・c5-composition-and-envelopes.md §1-1・c5-planning-inventory.md §2.4。
> 実装報告はクロスチェック用（鵜呑みにせず git 差分・実テストで裏取り）。

## 判定: **合格**

Domain C の核心（Stage snapshot をマージ後 `resolvedActivations` へ差し替え・裁定1）は忠実に実装され、C3 挙動の無退行・二重適用手当て維持・責務境界を全て満たす。要修正なし。報告書 §8 の記述に 1 点の事実不一致があるが Domain C の spec 適合には無影響（下記「質問/注記」）。

---

## blocking 観点ごとの検証（自分で git 差分・テスト確認）

### 1. 追従（裁定1・blocking）→ 適合
`autonomous-frame-heart.ts`（git diff HEAD で確認）。`latestStageMotionSignal` の snapshot が `resolvedActivations[BODY_X_SLOT_ID]` / `resolvedActivations[BODY_Z_SLOT_ID]` を読むよう移設され、`lastResolvedActivations = resolvedActivations;`（案B retain）の**直後**、resolver 呼び出しの手前に配置。裁定1「合成後の実効body信号に追従」を満たす。
- merge 評価seam `resolvedActivations = overlay === null ? activations : { ...activations, ...overlay }` は**無変更**。Domain C は BODY_X/BODY_Z の読み出し元を pure `activations` → `resolvedActivations` へ変えただけ。
- `getChannelOverlay` の 3 引数化（`nowMs, baseValues, prevResolved`）と `lastResolvedActivations` retain は**Domain A（案B feedback・裁定1/§7）の変更**であり Domain C の責務外。委任前提（同ファイルに A/C が混在）どおりで、Domain C はこの feedback ロジックに手を入れていない。

### 2. 無退行（blocking）→ 適合
- `overlay === null` 時は `resolvedActivations === activations`（同一参照）。よって snapshot が resolved を読んでも pure を読んでも byte-identical。
- 既存 C3 Stage テスト（`autonomous-frame-heart.test.ts`）は git 変更リストに**現れず＝無変更**。実行で 15 件全 pass（posture 0.4/-0.2 追従・blink-only→null を含む）。アサーション書き換えなしで通過。
- 新規追従テスト（`autonomous-frame-heart-channel-overlay.test.ts` に追加）を diff で精読：pure generator が body-x=0.4/body-z=-0.2 を一定 emit → channel 無し時 `{horizontal:0.4, depth:-0.2, ts:16}`（C3 baseline）→ store が body-x を **generator が出さない 0.9** に駆動 → sustain 中 `{horizontal:0.9, depth:-0.2, ts:32}`。horizontal が実効値 0.9 に追従し、無関係 slot body-z は -0.2 のまま。実 store→heart resolved 合成→snapshot→`getLatestStageMotionSignal()` の end-to-end 経路で追従を機械証明。設計 §6「overlay ハーネスを使う」と整合。

### 3. 二重適用手当て維持（§2.4・blocking）→ 適合
- `deriveStagePresenceStageMotionSettings`（strength 凸ゲイン）を含む `apps/runtime-player/src/main/presence/stage-presence-drive.ts` は git diff HEAD で**変更ゼロ**（機械確認）。strength→settings 写像は入力信号の出所（pure/resolved）に非依存のため、pure→実効の差し替えで二重適用は再破綻しない。
- `stage-presence-drive.test.ts` 7 件無変更 pass。

### 4. 責務境界（git 機械確認）→ 適合
- physiology/ 配下・`headless-slot-resolver.ts`・schema・lockfile・package.json：git diff HEAD で**変更ゼロ**。
- Domain A store 曲線ロジック（`control-channel-overlay-store.ts`・`slot-curve-state.ts`）・Domain B 契約（`contract/*`・`channel-*.ts`）・`reference-driver.mjs`：変更ありだが**すべて Domain A/B 由来**。Domain C の Stage snapshot 移設とは別。
- Domain C 自身が触ったのは `autonomous-frame-heart.ts`（Stage snapshot 移設 + コメント3箇所）と `autonomous-frame-heart-channel-overlay.test.ts`（追従テスト1件 + import 追加）に限定。Stage 消費seam `getStageMotionDrive` の配線（`input-subsystem.ts` の該当行）は diff に現れず無変更で、消費者インタフェース `AutonomousStageMotionSignal` の形は不変（値の意味のみ pure→実効に精緻化）。波及なし＝escalate 不要の報告に同意。

### 5. Subagent Contract（§9）→ 適合
- Domain C 差分に実行時 role 分岐の追加なし（snapshot 読み出し元の変更のみ）。
- 拒否コード列挙は Domain B 領域で Domain C は不介入＝列挙不増殖。
- 検証は `npx vitest` のみ。`pnpm install` 不使用（既存 node_modules）。

---

## 差分・要修正
なし。

## テスト結果（自分で実行）
- 対象スイート `autonomous-frame-heart input-subsystem stage-presence-drive stage-motion-runtime`：**5 files / 55 tests 全 pass**（channel-overlay は追従テスト追加で 10 件）。
- 全体 `npx vitest run`（runtime-player）：**136 files / 857 tests のうち 855 pass / 2 fail**。fail 2 件は `browser-source-server.test.ts` と `browser-source-server-message.test.ts` の `effectiveDynamicsTuning` schema drift = **既知 Wave21 baseline**、Stage/Domain C と無関係。Domain C 由来の新規 fail ゼロ。報告書 §7 の主張と一致。

## 質問 / 注記（Orch-Sylph 向け）
- **報告書 §8 の事実不一致**（要修正ではないが記録）: 報告書 §8 は「`input-subsystem.ts`（Stage 消費者 `getStageMotionDrive` の配線）は未変更（Gnome の diff なし）」と記すが、`git diff HEAD` では同ファイルに +6/-5 の変更がある。ただしその内容は **Domain A/B 由来**（`getChannelOverlay` の 3 引数化への追随＝`(nowMs, baseValues, prevResolved) => store.snapshot(...)`、および `clearAll`→`releaseAll` のコメント/呼称更新）で、**Stage 消費経路 `getStageMotionDrive` そのものは無変更**。Domain C の spec 適合には無影響。報告書は「本セッションで Gnome が Edit したのは 2 ファイル」の傍証として §8 を書いた際、HEAD 差分（A/B/C 混在）と本セッション Edit を取り違えた記述と見られる。Domain D の最終棚卸しで文言修正が望ましい。
