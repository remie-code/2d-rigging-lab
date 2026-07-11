# C5 Domain A レビュー (lane1: spec適合) — スロット曲線状態機械

> Review-Sylph (lane1=spec適合) → Orch-Sylph。読み取り専任。対象=作業ツリー未コミット差分 + 新規 `slot-curve-state.ts`。
> 規範突合: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §3/§4/§6/§8/§9/§10・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §1/§3/§4/§7・[c5-planning-inventory.md](../../orchestration/c5-planning-inventory.md) §2.1-2.3/§2.7。
> 自分で git diff / Read / vitest 実行して確認（Gnome報告は鵜呑みにせず突合）。

## 判定: **合格**

本waveの規範（設計裁定3件+派生2原則+実装裁定4件+命名規律+責務境界）が実装に忠実に落ちている。blocking観点8件すべて適合。要修正なし。

---

## spec適合（blocking観点ごと）

### 1. 単一曲線状態機械への統合（裁定3）— 適合

- 各スロットは1本の `SlotCurveState`（`slot-curve-state.ts:46-56`）。set/envelope を二重状態で持たない（store は `Map<string, SlotCurveState>` 単一、`control-channel-overlay-store.ts:65`）。
- `intent.set` が退化エンベロープとして同一機械に畳まれている: `setOverlay` が `attackMs:0 / sustainMs:expiresAtMs-startAtMs / decayMs:0 / releaseMs:既定` を生成（`control-channel-overlay-store.ts:85-96`）。`sampleSlotCurve` は attackMs=0 のとき attack相（`e < attackEnd=0`）を素通りし即 sustain=peak（`slot-curve-state.ts:112-120`）→ C4「TTL中の値は同一」外面互換。
- 外部シグネチャ不変: `setOverlay(slotId, value, expiresAtMs)` は C4 のまま（`:85`）。契約の外面は2 kind（envelope は Domain B が `setEnvelope` 経由で配線する境界のみ追加、契約 JSON は無変更＝後述7）。

### 2. 実効値フィードバック=案B（裁定1）— 適合

- 心臓が前tick `resolvedActivations` を `lastResolvedActivations` として1本 retain（`autonomous-frame-heart.ts:187-191`, `:242`「Retain the合成後 effective values for the NEXT tick」）し、provider の第3引数 `prevResolved` として供給（`:236`, `input-subsystem.ts:244-245`）。
- **マージseam不変**: `const overlay = getChannelOverlay(wallNowMs, activations, lastResolvedActivations)` の直後 `overlay === null ? activations : { ...activations, ...overlay }`（`autonomous-frame-heart.ts:236-238`）。`{ ...activations, ...overlay }` の**位置・順序が C4 と同一**（新引数追加のみ、評価点は動いていない）。純度テスト（heart-overlay.test.ts:328-358「never mutates the generator sample()」）と null-provider byte-identical テスト（`:360-388`）が緑で機械保証。

### 3. release=動く基底へのblend（裁定2）— 適合

- 既定400ms: `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS=400`（`slot-curve-state.ts:25`）、store が constructor で採用（`:74-77`）。
- **基底凍結でない**: release相は `lerp(livingBase, releaseFrom, w)`, `w = 1 - smoothstep(rel/releaseMs)`（`slot-curve-state.ts:101-103`, `:133-134`）。`livingBase` は `sampleSlotCurve` の第3引数で**毎tick供給される pure 生成器基底**（`baseValues` → `#livingBase(slotId)`, `control-channel-overlay-store.ts:171`, `:224-227`）。resolved の循環ではない（`#livingBase` は `#lastBaseValues`=pure `activations` のみ参照、`:70` / `:225`）。store層テスト「blends to the MOVING base and never re-snaps at the terminal」（store.test.ts:163-182、base を 0.1→0.2→0.3 と動かし終端が凍結0でなく生きた基底へ収束）が機械保証。
- TTL失効・切断が同機構: 失効はエントリ削除でなく自然タイムライン上の release相（`slot-curve-state.ts:129-135`）。切断は `releaseAll(nowMs)` が全 live エントリを現在実効値からの forced release へ一斉遷移（`control-channel-overlay-store.ts:134-148`, `slot-curve-state.ts:96-104`）。
- **切断→全スロット同時release**: `channel-server.ts:199`（close）/ `:318`（disconnect）が `clearAll()`→`releaseAll(this.#nowMs())` に置換。`#nowMs` は intent 受理 `receivedAtMs`（`:283`）と同一壁時計源で、heart の `wallNowMs` 評価と一貫。heart-overlay.test.ts:236-277（disconnect で両眼が中間値を経て400ms後基底）が保証。

### 4. START/TARGET の分離 — 適合

- re-attack START = resolved実効値: 新intent受理時 `startValue = #effectiveStart(slotId)` = `#lastResolved[slot] ?? #livingBase(slot)`（`control-channel-overlay-store.ts:89`, `:113`, `:214-220`）。`#lastResolved` は `prevResolved`（案B）由来（`:167`）。
- release TARGET = pure基底: `sampleSlotCurve` の `livingBase` = `#livingBase` = `#lastBaseValues`（pure `activations`）。
- 混同なし: store は毎tick両信号を**別フィールド**で受領（`#lastBaseValues` / `#lastResolved`, `:70-72`）。resolved を release対象に使わない（循環回避）。store.test.ts:142-159（re-attack が prevResolved 起点、0や新peakへ跳ねない）が機械保証。

### 5. 命名規律 — 適合

- 器内部の曲線モジュール/型は curve系: `slot-curve-state.ts` / `SlotCurveState` / `SlotCurvePhase` / `SlotCurveSample` / `sampleSlotCurve` / `slotCurveDriveEndMs`。モジュール内で「envelope」語を一切使わない（コメントも curve 統一、`slot-curve-state.ts:9-17`）。
- 「envelope」は封筒側（C4 `channel-envelope-schema.json`）と契約kind `intent.envelope`（Domain B）に譲っている。store の `RuntimePlayerControlChannelEnvelopeSpec`（`:39-44`）のみ envelope 語を含むが、これは Domain B が `intent.envelope` payload を配線する**境界の入力型**（契約kind名に対応）で、規律の趣旨（曲線器の内部命名を curve に）に反しない。

### 6. 責務境界（§3.2 out of scope 不侵犯）— 適合

- Stage snapshot（`autonomous-frame-heart.ts:205-209`相当）**無変更**（git diff 上、Stage snapshot 位置に変更なし。コメント「The Stage Presence snapshot above still reads the PURE `activations` (Domain C's concern, untouched here)」`:239-240`）。Domain C 領域に踏み込んでいない。
- `intent.envelope` 契約 JSON・dispatch・参照ドライバ・supportedKinds は**無変更**（`git diff --stat contract/` 空、後述7）。Domain A は store の `setEnvelope` 受け口（曲線器側）のみを用意し、契約/dispatch は Domain B に残している。
- 評価seam（`:222-224`相当の `{ ...activations, ...overlay }`）位置不変（観点2で確認）。

### 7. Subagent Contract（§9）— 適合（git diff 機械確認）

`git diff HEAD --stat` で touched は9ファイルのみ（source 4 + test 5）+ 新規 `slot-curve-state.ts`（未追跡）。以下すべて**無変更**を機械確認:

- physiology/ 配下・`headless-slot-resolver.ts`: diff 空。
- `contract/`（schema JSON・Runtime Export schema）: diff 空。
- `pnpm-lock.yaml`: diff 空（`pnpm install` 未実行・回避工作なし）。
- `apps/soul`: diff 空（package.json 追加なし）。
- Editor ソース・package-format: touched に含まれず。
- 拒否コード列挙: `channel-protocol-contract.ts` touched でない（Domain A は拒否に触れていない、不増殖）。
- 実行時 role分岐: 新設なし（heart の変更は provider 引数追加と retain 1本のみ、`if(role===…)` なし）。
- smoothstep: physiology から import せず写経。`slot-curve-state.ts:66-69` は `blink-behavior.ts:207-209` と**byte一致**を確認。`grep physiology` は両 curve ファイルで**コメント言及のみ**（import 行ゼロ）。

### 8. 受け入れ基準（§8）Domain A 該当項目 — 適合

- set/envelope 単一曲線状態機械（内部）・契約2 kind（外面）: 観点1で確認。
- 連続性: 全遷移点で導出bound内。store層（store.test.ts:206-242）+心臓層（heart-overlay.test.ts:279-326）の両方で「全隣接tick差 ≤ bound」を性質テスト化。bound は `|amplitude|/duration × RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE(1.5) × frameInterval` で**全因子が曲線パラメータ**（マジックナンバー不使用、`slot-curve-state.ts:27-33` に slope の導出根拠 `6x(1-x)@x=0.5=1.5` を明記）。
- release: 動く基底収束・既定400ms・set失効も同機構: 観点3で確認。
- C4後方互換: 即時スナップ固定テストのみ意図的置換（§4 の10件、release挙動へ）。それ以外（activeOverlays 診断・channel-bridge-handlers 等）は無変更で通過。
- 命名規律・拒否列挙不増殖・lockfile無変更: 観点5/7で確認。

---

## 差分・要修正

**なし。**

---

## 裁量判断の妥当性評価（Gnome報告 §7 の6件 × 設計突合）

1. **decay と release の関係**（envelope: decay peak→0 → release 0→livingBase / set: decayMs=0 で release peak→livingBase 直接）— **妥当**。設計§3.2「release一般化＝動く基底へ滑らかに返す」に忠実。envelope の decay 終端は固定0だが、livingBase が非0（呼吸）でも終端スナップが出ないよう release尾部を常に付す設計は、裁定2「終端スナップ再生産を防ぐ」の要求そのもの。相境界は値連続（`slot-curve-state.ts:129-136`、decay終端0＝release開始 w=1 で値0）。
2. **案Bの供給形**（heart が retain・第3引数供給）— **妥当**。設計§7-1「心臓が resolvedActivations を保持・供給」の mental model に literal。store 自己計算でも等価だが設計文書に忠実な配線を選択、責務が明快。
3. **set の startAtMs = #lastNowMs**（`setOverlay` 外面維持のため受理時刻を取れず直近 snapshot nowMs を採用）— **妥当**。`sustainMs = expiresAtMs - startAtMs` で **driveEnd = expiresAtMs は startAtMs 非依存**（`slotCurveDriveEndMs` = startAtMs+0+sustainMs+0 = expiresAtMs）。最大1tick陳腐化は attackMs=0 ゆえ観測値に影響ゼロ。C4「TTL中の値同一」を厳密維持。
4. **activeOverlays remainingTtlMs = driveEnd - nowMs**（release尾部を診断から除外）— **妥当**。set では driveEnd=expiresAtMs で C4 の `expiresAtMs - nowMs` と一致。既存 activeOverlays/channel-bridge-handlers テストが無変更通過（`activeOverlays(nowMs)` signature 不変）。Domain C read model への波及ゼロ。§3.2「Domain C 領域不侵犯」とも整合。
5. **snapshot 後方互換**（`baseValues`/`prevResolved` 任意引数 既定`{}`）— **妥当**。既存 `snapshot(nowMs)` 配線が型・実行時とも維持。base欠如時 release→0 は本番では起きない（heart が常に base 供給）テストシム上の縮退。
6. **clearAll 存置**（model unload / runtime-export teardown は hard clear、disconnect のみ releaseAll）— **妥当かつ正しく実配線**。`runtime-player-main.ts:560/602`（onRuntimeExportUnload / onRuntimeExportCleared）が `clearAll()` を保持（Domain A 差分外＝C4既存を正しく温存）。これらの経路はモデル teardown で**生きた基底＝heart tick が無い**ため、release は完了せず hard clear が唯一正しい。disconnect（heart 継続稼働・生きた基底あり）のみ `releaseAll` に置換。clearAll は孤児化しておらず、区別の理路が正しい。

---

## テスト結果（自分で実行）

- `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay channel-server input-subsystem` → **45 passed / 5 files**（store 13 / heart-overlay 7 / channel-server 8 / channel-server-events 1 / input-subsystem 16）。
- Gnome報告の全体 828 passed / 2 failed（browser-source系 `effectiveDynamicsTuning` schema drift＝既知baseline Wave21、Domain A の overlay/曲線と無関係・当該ファイル無変更）の分離は妥当。今回 lane1 では Domain A 直接関連テストの緑を確認（全pass）。
- 型: 別途 typecheck は Gnome報告の pass を採用（lane1 は spec 突合が本務、機械回帰は lane2/Domain D）。

---

## 質問

なし。設計裁定4件（実効値経路=案B / release=動く基底400ms / set-envelope単一機械 / 拒否は既存列挙）はいずれも実装に忠実に落ちており、spec レーンで疑義なし。lane2（test adequacy）側で、意図的置換した10件のテストが「中間値の存在」だけでなく「導出bound内の各tick単調性」まで十分に締めているかの網羅性判定を委ねたい（本レーンでは連続性性質テストの導出bound健全性は確認済み）。
