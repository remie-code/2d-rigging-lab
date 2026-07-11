# C5 Domain C 実装報告: Stage Presence 入力を合成後実効body信号へ差し替え

> Domain: `cohost-c5-stage-presence-effective`（裁定1「体は一つ——誰が体を動かしても画面はついてくる」）
> 実装: Gnome（opus）。Orch-Sylph からの委任。ブランチ `feature/2d-rigging-eco-system`、コミットなし。
> Status: 完了。対象テスト・typecheck パス。既知baseline以外の退行なし。

---

## 1. 作成/変更ファイル一覧

このセッションで **Gnome が編集したファイルは 2 つのみ**:

1. `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts`（source; Stage snapshot 移設 + コメント3箇所更新）
2. `apps/runtime-player/src/main/role-composition/autonomous-frame-heart-channel-overlay.test.ts`（test; 追従テスト1件新規 + import 追加）

新規作成ファイルなし。`git status` に並ぶ他の変更ファイル（`control-channel-overlay-store.ts`・`slot-curve-state.ts`・`contract/*`・`channel-*.ts`・`input-subsystem.ts`・`reference-driver.mjs` 等）は **Domain A/B の未コミット成果であり、Gnome は一切触っていない**（本セッションの Edit は上記2ファイルのみ）。

---

## 2. Stage snapshot 移設の要点

`autonomous-frame-heart.ts` の `tick()` 内。

- **移設前**（merge の手前・pure `activations` を読む）:
  ```ts
  const activations = heartbeat.generator.sample(logicalTimeMs);
  latestStageMotionSignal = {
    horizontal: readSignedActivation(activations[BODY_X_SLOT_ID]),
    depth: readSignedActivation(activations[BODY_Z_SLOT_ID]),
    timestampMs: wallNowMs
  };
  // …overlay merge → resolvedActivations …
  ```
- **移設後**（merge の後・`resolvedActivations` を読む）:
  ```ts
  const activations = heartbeat.generator.sample(logicalTimeMs);
  // …overlay merge → resolvedActivations …
  const overlay = getChannelOverlay(wallNowMs, activations, lastResolvedActivations);
  const resolvedActivations =
    overlay === null ? activations : { ...activations, ...overlay };
  lastResolvedActivations = resolvedActivations;
  latestStageMotionSignal = {
    horizontal: readSignedActivation(resolvedActivations[BODY_X_SLOT_ID]),
    depth: readSignedActivation(resolvedActivations[BODY_Z_SLOT_ID]),
    timestampMs: wallNowMs
  };
  ```
- snapshot を `lastResolvedActivations = resolvedActivations;`（案B retain）の**直後**へ配置。`resolvedActivations` 確定後に読むので裁定1を満たす。merge の評価seam（`overlay === null ? … : { ...activations, ...overlay }`）は**無変更**——Domain A/B のロジックには触れていない。BODY_X_SLOT_ID / BODY_Z_SLOT_ID を pure `activations` ではなく `resolvedActivations` から読むよう変えただけ。
- **コメント更新 3 箇所**:
  1. snapshot 直上のコメント: 「pure activations を読む（C3 Domain D）」→「合成後の実効body信号（resolvedActivations）に追従する（C5 Domain C・裁定1「体は一つ」）。誰が体を動かしても画面はついてくる。チャネル無し時は `resolvedActivations[BODY_*] === activations[BODY_*]` で C3 と byte-identical（無退行）。strength 凸ゲイン手当ては入力出所非依存で二重適用は再破綻しない（§2.4）」。
  2. merge ブロックのコメントから「The Stage Presence snapshot above intentionally reads the PURE `activations`」「still reads the PURE `activations`」の 2 文を削除（snapshot がもう "above" でなくなり、pure でもなくなったため）。
  3. 型 doc（`AutonomousStageMotionSignal`）と getter doc（`getLatestStageMotionSignal`）: 「pure read of the last sampled body-x/body-z」→「合成後 EFFECTIVE body-x/body-z（channel curves included）」へ更新。

---

## 3. 追従テストの内容（新規・blocking）

`autonomous-frame-heart-channel-overlay.test.ts` に追加（実storeを配線する既存 `storeProvider` ハーネスを使用、end-to-end）:

**"Stage Presence follows the合成後 effective body signal when a channel drives body (C5 Domain C, 裁定1)"**

- generator は pure posture を**一定値** `{ body-x: 0.4, body-z: -0.2 }` で emit。
- チャネル無しの最初の tick（wall 16）: `getLatestStageMotionSignal()` = `{ horizontal: 0.4, depth: -0.2, timestampMs: 16 }`（overlay null なので resolved === activations = C3 baseline）。
- `store.setOverlay("body-x", 0.9, 100000)` で **generator が決して出さない値 0.9** を body-x に立てる（set curve = attack≈0、sustain 保持）。
- 次 tick（wall 32・sustain 中）: `getLatestStageMotionSignal()` = `{ horizontal: 0.9, depth: -0.2, timestampMs: 32 }`。
  - **horizontal が合成後の実効値 0.9（チャネル駆動）に追従**——pure generator 値 0.4 ではない。→ 裁定1の追従を機械証明。
  - **depth は -0.2 のまま**（body-z にチャネル無し → resolved === activations）——無関係slotの無退行も同一テストで示す。

実storeの `snapshot(nowMs, baseValues, prevResolved)` → heart の resolved 合成 → snapshot → `getLatestStageMotionSignal()` の実経路を通す。

---

## 4. 無退行の証拠

- **既存 C3 Stage テスト 2 件（`autonomous-frame-heart.test.ts:479-532`）は無変更で通過**:
  - "exposes the latest posture activation as a Stage Presence signal"（posture 0.4/-0.2 追従）
  - "reports null posture signal when the config carries no posture (blink-only)"（body slot 無し → null）
  - 両者とも `getChannelOverlay` を注入しない（既定 null provider）ため `overlay === null → resolvedActivations === activations`。よって snapshot が resolved を読んでも pure を読んでも **byte-identical**。実際、アサーション（horizontal:0.4/depth:-0.2/timestamp、null 系）は一切書き換えず通過。
- **channel-overlay テストの "with the default (null) overlay provider … byte-identical" ガードも無変更通過**。
- 対象スイート全 55 件 pass（下記 §7）。

---

## 5. 二重適用手当て維持の確認

- `deriveStagePresenceStageMotionSettings`（`presence/stage-presence-drive.ts:82-102`、`gain = strength²` の凸ゲイン）は **本セッションで一切変更していない**（git 上も未変更＝Domain 由来の diff なし）。
- この関数は `strength → settings` の写像のみで、Stage の**入力信号の出所（pure か resolved か）に依存しない**。入力を pure→実効に替えても strength 導出は不変なので、C3 が手当てした二重適用は再破綻しない（§2.4）。この不変性はソースコメントにも明記した。
- `stage-presence-drive.test.ts`（7件）無変更通過。

---

## 6. C4 テスト置換の有無

**置換なし（該当テスト不在）**。「チャネル駆動下でも Stage が pure body に従う」ことを固定した C4 テストは存在しない。確認方法:

- `getLatestStageMotionSignal` / `getStageMotionDrive` を参照するテストは 2 ファイルのみ（`autonomous-frame-heart.test.ts`・`input-subsystem.test.ts`）。
- `autonomous-frame-heart.test.ts` の Stage テストはチャネル overlay を注入しない純 C3 テストで、pure/resolved の区別を固定していない。
- `input-subsystem.test.ts:337-347` は heart の signal（mock）を `getStageMotionDrive` が読むことを確認するのみで、pure vs resolved を固定しない。

よって Domain C の追従テストは**既存テストの書き換えではなく純粋な新規追加**。Orch-Sylph の事前調査（該当テスト見当たらず）と一致。

---

## 7. テスト結果（pass/fail・既知baseline分離）

- **対象スイート**: `npx vitest run -c vitest.config.ts autonomous-frame-heart input-subsystem stage-presence-drive stage-motion-runtime`
  → **5 files / 55 tests 全 pass**（channel-overlay は追従テスト追加で 9→10 件）。
- **typecheck**: `pnpm run typecheck`（tsc --noEmit）→ **pass（クリーン）**。
- **全体退行チェック**: runtime-player 全 vitest → **136 files / 857 tests のうち 855 pass / 2 fail**。
  - fail 2 件は **既知 Wave21 baseline のみ**:
    - `src/main/broadcast-source/browser-source-server.test.ts`（1件）
    - `src/stage/browser-source/browser-source-server-message.test.ts`（1件）
    - いずれも `effectiveDynamicsTuning` schema drift（`+ "effectiveDynamicsTuning": null`）。Stage Presence / Domain C とは無関係。
  - **Domain C 由来の新規 fail はゼロ**。
- 既知 `check:source` の C3 既存 1 件は vitest 対象外の別スクリプトのため未実行（既知として不介入）。

Domain A/B のテスト（overlay store・contract・sustained-drive 等）も全体スイートに含まれ、browser-source 2件を除き全 pass＝無退行。

---

## 8. 触っていないことの確認

本セッションの Edit は `autonomous-frame-heart.ts` と `autonomous-frame-heart-channel-overlay.test.ts` の 2 ファイルのみ。以下は**未変更**（Gnome の diff なし）:

- Domain A store: `control-channel-overlay-store.ts`・`slot-curve-state.ts`（曲線ロジック）
- Domain B 契約: `contract/*`・`channel-intent-validation.ts`・`channel-request-dispatch.ts`・`channel-server*.ts`
- `deriveStagePresenceStageMotionSettings`（strength 導出、`stage-presence-drive.ts`）
- `input-subsystem.ts`（Stage 消費者 `getStageMotionDrive` の配線）
- `physiology/` 配下・`headless-slot-resolver.ts`
- Editor / package-format / Runtime Export schema / lockfile / `apps/soul`
- `pnpm install` 不使用（既存 node_modules で検証）。

---

## 9. escalate 条件チェック（波及なし）

- `latestStageMotionSignal` の唯一の消費者は `getStageMotionDrive`（`input-subsystem.ts:262-273` が `heart.getLatestStageMotionSignal()` を読む）。snapshot を resolved から取るよう移しても、この消費者のインタフェース（`AutonomousStageMotionSignal` の形）は不変で、値の意味だけが「pure→実効」に精緻化される。**他経路への予期せぬ波及なし**（`input-subsystem.test.ts` の Stage/overlay テストも無変更通過）。→ escalate 不要。

---

## 10. 裁量判断 / 質問 / escalate

- **裁量1（テスト配置）**: 追従テストを `autonomous-frame-heart.test.ts` の Stage セクションでなく `autonomous-frame-heart-channel-overlay.test.ts` に置いた。理由: 後者は実 `RuntimePlayerControlChannelOverlayStore` を配線する `storeProvider` ハーネスが既にあり、store curve → resolved 合成 → snapshot の**実経路を end-to-end** で通せて追従の証拠が強い。前者は overlay を注入しない純 C3 テスト群で、store 依存を持ち込むと純度が下がる。仕様（§6「overlay ハーネスを使う」）とも整合。
- **裁量2（コメント削除）**: merge ブロックの「Stage snapshot above reads PURE activations」2 文を削除。snapshot がもう "above" でも "pure" でもないため、残すと誤りになる。
- **質問・escalate**: なし。設計に曖昧点なく、局所差し替え1点で完結。
