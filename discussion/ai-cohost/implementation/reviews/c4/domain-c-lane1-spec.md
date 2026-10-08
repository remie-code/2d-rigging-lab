# C4 Domain C レビュー (Lane1: spec/UX 突合)

> Review-Sylph → Orch-Sylph。対象=`cohost-c4-channel-page-degraded`。
> レーン=spec/UX 突合(UX定義 c4-channel-diagnostics + wave-plan と実装の適合)。design品質・テスト網羅は他レーン。
> 判定基準=`screens/c4-channel-diagnostics.md`(主)/`orchestration/c4-wave-plan.md`/`architecture/c4-control-channel-v0.md §3.3`。
> **判定: 合格**(blocking差分なし。non-blocking のmockup忠実性差2件のみ)。

## 各UX観点の評価

### 1. Channelページ (UX §1, blocking) — 適合
`channel-page.tsx` を mockup と1つずつ突合:
- **Status**: `Closed` / `Open — no client connected` / `Connected (protocol N)`(`formatConnectionLabel`)。mockup の3状態と一致。「Connected (protocol 1)」の版数表示も `protocol ${protocolVersion}` で満たす。✓
- **`[Open Channel]` / `[Close]`**: `isOpen` で描き分け(closed→Open Channel primary、open/connected→Close secondary)。起動時Closed→Open導線。✓
- **Endpoint URL + `[Copy Channel URL]`**: `endpointUrl !== null`(Open/Connected のみ)で表示。Copyボタン併設。mockup の「(Open後)URL表示」と一致。✓
- **Active overlays**: `Live` パネルに `slotId = value (ttl Nms)`。UX の「スロット+値+残TTL」に一致。空時は「No active overlays…」の一文。✓
- **Recent Events**: `✓ intent.set` / `✗ rejected` / `✓ connected` / `• disconnected`。受理・拒否+コード・接続を表示。✓(内容差は下記2)
- **トラッキングホスト空状態**: 「This host has no control channel; the body is driven by tracking.」— UX §1 line 39 と**逐語一致**。✓
- 追加の `null`(Checking channel)状態は UX に無いが無害な描画ガード。

### 2. Recent Events の内容 (mockup 突合) — non-blocking 差
- **accepted 行**: mockup `✓ intent.set face.angle.x 0.4` に対し impl `✓ intent.set ${slotId} ${value}`。slotId+値あり。✓
- **rejected 行**: mockup `✗ rejected slotValueOutOfRange eye.l.open`(**slotId あり**)に対し impl `✗ rejected ${code}`(**slotId なし**)。Gnome §10-3 の申告どおり。
- **connected 行**: mockup `✓ connected client 127.0.0.1`(**IP あり**)に対し impl `✓ connected client`(**IP なし**)。報告に未記載の追加差(私が発見)。loopback専用なので値は常に127.0.0.1で秘匿性はなく実害は小。

**見解**: UX §1 のゲート要点「契約違反が拒否され**コードつきで人間に見える**」(line 38)は code 表示で満たされる。rejected 行の slotId・connected 行の IP は mockup の**例示的忠実性**であり、ゲート本質ではない。rejected slotId 取得は dispatch/validation(Domain A)拡張を要し、v0スコープに対し過剰との Gnome 判断は妥当。よって**両差は non-blocking**。ただし複数スロットを同時駆動する魂が入る段階(C5)では「どのスロットが弾かれたか」の欠落が診断性を落とすため、follow-up での dispatch `logSlotId` 追加を推奨する(既に `domain-f-followup.md` が存在し追跡余地あり)。

### 3. 秘匿露出境界 (UX §4, blocking) — 適合(contract shape 上)
`channel-bridge-contract.ts`(renderer に渡る全型)を精査:
- 露出は `available`(bool data)/ `connection` / `endpointUrl`(token は URL構成要素として**この面のみ**)/ `activeOverlays` / `recentEvents` / `revision` / `updatedAtIso`。
- **seed・rawスロット・token以外の秘匿は型に存在しない**。✓
- **Active overlays は `remainingTtlMs`(相対)のみ**。絶対 `expiresAtMs`(壁時計)は型に無い。✓ UX §4「絶対壁時計を出さない」規律を型で担保。
- **recentEvents は `id/kind/slotId?/value?/code?`** のみ。永続化しない旨は contract コメント(session-only ring buffer)。データ形として秘匿なし。✓
- endpointUrl は Closed/tracking で null(裁定7)。✓
※ 実行時に seed 等が実際に載らないことの最終担保は main handler の挙動(Lane2/handler test 領域)だが、**renderer 契約の型サーフェス自体は clean**。

### 4. 自律版Overview (UX §2, blocking) — 適合
`overview-page.tsx`:
- `providesPhysiology` で分岐 → Model / Physiology / Channel カード。role問い合わせなし(`providesPhysiology = physiologyStatus?.available === true`、`providesChannel = channelStatus?.available === true` の data 派生)。✓
- Channel カードは `providesChannel` で描画、Status鏡写し+overlays件数+`Open Channel`(channelページ導線)。操作本体はページ側。UX §2 の「鏡写しの状態表示+ページへの導線」と一致。✓
- **トラッキングホスト**: 両フラグ false → 既存4パネル(Model/Input Source/Input Profile/Mapping・Live)を維持。Channel カード非出現。✓ 退行なし。

### 5. degraded 6面 (UX §3, blocking) — 適合(文言逐語一致)
UX §3 と逐語照合:
- **Input**(`input-page.tsx`)/ **Mapping**(`mapping-page.tsx`): 「This host has no tracking input; the body is driven by physiology and the channel.」— UX §3 line 53 と**一致**。✓
- **Motion Safety**(`live-controller-page.tsx`): 「Stage presence is driven by Physiology on this host.」+ `Open Physiology` 誘導 — UX §3 line 54 と**一致**。✓
- **Stage Motion**(`stage-motion-panel.tsx`, `stage-page.tsx` 経由): 同文言 — **一致**。✓
- **Header**(`control-window-app.tsx`): 自律で `Drive: Physiology`(tone teal)、tracking で従来 `getInputStatusPillLabel`。UX §3 line 55 の例と一致。✓
- **data源**: すべて `drivenByPhysiology`(=`providesPhysiology`=physiology availability data)。tracking では false → **従来UI完全保持**(各page の分岐前 return で degraded gate、以降は無改変)。退行なし。✓
- 6面カバレッジ: Input/Mapping/Motion Safety/Stage Motion/Header + Channelページ空状態(UX §1)で網羅。

### 6. nav位置 (裁定9・UX §1) — 適合
`control-window-shell.tsx` の静的 `controlWindowPages`: `…physiology, **channel**, stage…`。Physiology **直後**。✓

### 7. 複数接続の扱い (報告§7) — 破綻なし
UX §1 の Connected 表示は単数(`Connected (protocol N)`)。実装は `connections.size > 0` で connected を単一ラベル表示。複数接続でもラベルは「connected」で矛盾せず、切断で全 clearAll の fail-safe と整合。v0 として UX と破綻しない。✓(per-connection 帰属・優先規則は C5、当ドメインは配線のみ)

### 8. 実行時role分岐の不在 (blocking) — 適合
`control/` 全体を grep。`if (role === …)` 等の**挙動分岐は皆無**。role の使用は2箇所のみ:
- `control-window-shell.tsx` の `roleBadgeAccentClassName`(role.id → 静的スタイル lookup。c1-role-skeleton §7.2 で明示許可の表示専用)。
- `ControlWindowRoleBadge` への role 受け渡し(バッジ表示)。

描き分けはすべて `providesPhysiology` / `providesChannel` / `drivenByPhysiology` の data 経由。✓

## 差分まとめ

### blocking
- なし。

### non-blocking
1. **Recent Events rejected 行に slotId なし**(mockup は `slotValueOutOfRange eye.l.open`)。Gnome §10-3 申告済み。ゲート本質(code表示)は充足。C5前に dispatch `logSlotId` の follow-up 推奨。
2. **Recent Events connected 行に client IP なし**(mockup は `client 127.0.0.1`)。報告未記載の追加差。loopback専用で実害小。忠実性を厳密に取るなら `127.0.0.1` 付与、または UX mockup 側を「client」表記へ更新のいずれかで整合を取れる。
3.(軽微・要修正でない)overlay 値整形 `0.4`→`0.40`(`toFixed(2)`)。mockup は `0.4`。判読性はむしろ向上。記録のみ。

## 判定
**合格。** UX §1〜§4 の全 blocking 観点(Channelページ表示要素・秘匿露出境界・自律Overview・degraded 6面文言・nav位置・role分岐不在)に適合。残差は mockup の例示的忠実性に関する non-blocking 2件のみで、いずれもゲート本質を損なわない。

## 質問(Orch/UX 判断)
1. **connected 行の client IP**(non-blocking差2): mockup 忠実に `127.0.0.1` を出すか、UX mockup を「client」表記へ寄せるか。どちらでも spec 整合。現状(IP省略)を許容とするなら UX 側の mockup 更新が望ましい(mockup と実装の乖離を残さないため)。
2. **rejected 行 slotId**(non-blocking差1): v0 は code のみで確定(Gnome 判断)を追認するか、C5前 follow-up として `domain-f-followup.md` に明記して閉じるか。私の推奨は後者(追跡ありで v0 は現状維持)。
