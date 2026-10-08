# C3 Domain C レビュー: レーン1 spec compliance

> Reviewer: Review-Sylph(spec compliance / opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> basis: [c3-physiology-profile.md](../../screens/c3-physiology-profile.md)(UX全面)/ [c3-wave-plan.md](../../orchestration/c3-wave-plan.md)(§4.3/§6/§9/裁定4)/ [c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §6。
> Gnome報告: [domain-c-physiology-page-profile.md](../../waves/c3/domain-c-physiology-page-profile.md)(検証済み)。

## 判定: **合格(pass)**

spec レーンの blocking 観点8点すべてを満たす。要修正なし。裁量注記のみ(いずれも非 blocking)。

---

## blocking 観点の検証結果

### 1. UX 語彙規律(§3) — ✓ 合格
`control/physiology-page.tsx`。スライダーは全て `type="range" min=0 max=1 step=0.01`、値の数値 readout・`<output>`・数値入力欄・波形/グラフは一切なし。表示されるのは質感語ラベルのみ(Frequency/Calmness/Crispness/Quirk, Camera Focus/Restlessness/Dwell, Sway/Follow, Drift/Restlessness, Strength)。UI 語彙は英語。工学数字(ms/Hz/確率)は UI に露出しない。`physiology-page.test.ts:73-87` が Hz/probability/内部スキーマ値の非露出を固定。
- 注記(非 blocking): `PhysiologyStatus.statusLabel`(state.ts:310)は `"Physiology sections N / 5 tuned"` を持つが、これは工学数字ではなくセクション調整数のカウントで、かつ `physiology-page.tsx` では**描画に使われていない**(Profile 行は `profileStatus.label`)。実害なし。

### 2. UX 画面構造(§2) — ✓ 合格
5 セクション(Blink/Gaze/Head/Posture/Stage Presence)+ セクション別 Reset(override 無しは `disabled`)。Stage Presence のみトグル+Strength、既定 Off(`DEFAULT_STAGE_PRESENCE_ENABLED=false`, tone-config.ts:46)。プレビューボタン不在、生理全体 OFF スイッチ無し。`Persistence: Automatic` 行で Save ボタン不在を明示。nav 配置は `Dynamics Tune` の隣(shell.tsx: dynamics-tune → physiology → stage)で UX §1 どおり。

### 3. 永続化 / 裁定4(§4) — ✓ 合格
- 自動保存(`physiology-profile-save-controller` を bridge が scheduleSave、debounce)。Save ボタン無し。retry は save-failed 時のみ。
- スロット userData 配下: `<userData>/physiology-profiles/<safePackageId>/<fingerprint>.json`(store.ts:58-73)。userData は既に main.ts:129 でスロット配下へリダイレクト済み。
- **stale = fingerprint パス分離 + schemaVersion reject + fingerprint identity mismatch reject のみ**。`dynamicsSignatureHash`/`parameterSignatureHash` 相当は**持ち込んでいない**(identity.ts はコメントで model 非依存を明記、fingerprint は packageHash 由来)。stale プロファイルは適用せず普遍既定へフォールバック(state.ts:363-376、overrides は `{}` のまま)。裁定4 完全準拠。

### 4. 空状態2つ(§6) — ✓ 合格
`physiology-page.tsx:145-179`。①Runtime Export 未ロード(`status==="unavailable"`)→「Physiology comes alive once a Runtime Export is loaded.」②trackingHost(`available:false`)→「This host has no physiology; the body is driven by tracking.」の一文ページ。**nav からページを消していない**(shell の配列に常設=C1 劣化ページ方式)。優先順位は available(host) を先に見るため trackingHost では常に②。`physiology-page.test.ts:21-48` が両状態を固定。

### 5. provider 既定 = full(Domain B Q1) — ✓ 合格
`physiologyOverridesToConfig`(tone-config.ts:232)は空 override でも常にフル4系統(blink+gaze+head+posture)+ stagePresence を構築(anchoredLerp の t=0.5 が普遍既定に厳密写像)。main.ts が `physiologyConfigProvider: () => physiologyState.getPhysiologyConfig()` を autonomous composer にのみ配線。autonomousHost は設定なしで gaze/head/posture が生きる。

### 6. 質感語→内部素子写像(§6) — ✓ 合格
tone-config.ts の写像が §6 対応表どおり:
- Blink: Frequency→meanBlinkIntervalMs(逆)/ Calmness→intervalJitterRatio(逆)/ Crispness→close+openDuration 共通係数/ Quirk→doubleBlinkProbability。露出しない定数(minRefractory/hold/closeDepth)は既定保持=UI に漏れない。
- Gaze: cameraFocus/restlessness/dwellMs。Head: sway/follow。Posture: drift/restlessness。Stage Presence: strength。
すべて baseline のみ(modulation=恒等)。写像層は Electron/時計/乱数なしの純データ変換。

### 7. 責務境界 / 純度 / sanitization(§9) — ✓ 合格
- blink golden 2本不変(`git diff --stat -- '*golden*.json'` 空。blink-default/blink-alt-config golden はトラック済み・無変更)。
- `headless-slot-resolver.ts`/`semantic-slot-definitions.ts`/schema/`pnpm-lock`/`package.json`/`body-follow-state` すべて無変更(git status で該当なし)。新規依存なし。
- 実行時 role 分岐なし: availability は subsystem の `providesPhysiology` data marker(static=true/tracking=false)由来、bridge・renderer とも `if(role===)` 不在。
- sanitization: preload(runtime-player-bridge.ts)は質感語 status/config と action result のみ露出。シード・raw スロット・私的パスを流さない。`PhysiologyStatus` の runtimeExport ref は packageId/revision/loadedAtIso/modelDisplayName のみ(Dynamics Tune と同等で私的パス無し)。

### 8. Stage Presence の Domain 境界 — ✓ 合格
`PhysiologyConfig.stagePresence` は optional additive。`createPhysiologyBehaviorsFromConfig`(physiology-config.ts:147)の fan-out はこのフィールドを**完全に無視**(コメントで Domain D 駆動と明記)。stagePresence の consumer は index.ts の型 export と preload の setter API のみで、**姿勢信号→Stage transform の駆動は存在しない**(Domain D 先食いなし)。DEFAULT 群不変で Domain A/B・golden を保全。

---

## 裁量注記(非 blocking、Orch 判断用)

1. **profileStatus="stale" のラベル再利用**: 正常ロードだが一部フィールドが無効で無視された場合(state.ts:381-388)、kind を `"stale"`(label「Profile restored with warnings」)にしている。厳密には「部分復元」であり真の stale(別 export/schema 不一致で不適用)と同じ kind に集約されている。UX は微細状態を定義していないため spec 違反ではないが、意味的にはやや過負荷。将来 kind 分離の余地あり。
2. **状態優先順位**: `null(checking) → available:false(②) → status unavailable(①) → 通常` の順。trackingHost で export ロード済みでも available:false が優先され②が出る(spec の意図どおり=トラッキングホストは常に一文ページ)。適切。

## 質問
- なし。

## 総評
UX 定義(Physiology ページ全面)と wave plan 永続化/bridge/provider 仕様・裁定4・責務境界に忠実。spec レーンとして合格。
