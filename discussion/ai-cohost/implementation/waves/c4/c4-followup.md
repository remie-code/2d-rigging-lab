# C4 v0 繰延事項 follow-up 記録

> 記録者: Gnome(Domain E 最終統合、`cohost-c4-final-integration`)→ Orch-Sylph。
> 根拠 = [c4-wave-plan.md](../../orchestration/c4-wave-plan.md) §3.2(Out of Scope)/ Domain A〜D 報告 + 3レーンレビューの non-blocking・繰延・soft question。
> 性格: **C4 の合格を妨げない**、v0 で意図的に据え置いた事項の棚卸し。C5 以降または「実物の魂が繋がる日」に回収する。各項目に発生源(ドメイン/レビュー)と回収の目安を付す。

## 1. Recent Events の rejected 行 slotId

- **内容**: Channelページの Recent Events で、拒否(rejected)行は現状 **code のみ**(例 `✗ rejected slotValueOutOfRange`)を表示し、どのスロットが拒否されたかの slotId を出していない。mockup([../../screens/c4-channel-diagnostics.md](../../screens/c4-channel-diagnostics.md) §1)は `✗ rejected slotValueOutOfRange eye.l.open` の形で slotId を含む。
- **なぜ繰延**: accepted 行は dispatch の overlay 結果から slotId+value を持てるが、rejected の slotId は `dispatchControlChannelRequest` / validation の**拒否経路に slotId を持ち回る拡張(logSlotId)**を要し、これは Domain A の決定核の再変更になる。v0 は「rejected + code」で契約違反が人間に見える要点を満たすと判断し、slotId 省略で閉じた。
- **発生源**: Domain C(報告§10-3・裁量3)、Domain C Lane3(繰延として明記)。
- **回収目安**: C5 の Channelページ精緻化。`channel-request-dispatch` の rejected 結果に `logSlotId?`(パース可能だった slotId)を additive で足し、bridge の `toRendererEvent` が拾う。read-only 観測面の拡張で契約意味論は不変。

## 2. Recent Events の connected 行 client IP

- **内容**: connected 行は現状クライアントのアドレスを出していない。mockup は `✓ connected client 127.0.0.1` の形。
- **なぜ繰延**: server event(`RuntimePlayerControlChannelServerEvent`)の connected emit に peer アドレスを載せる拡張が要る。loopback 専用なので値は実質常に `127.0.0.1` で診断価値が低く、v0 では省いた。token 以外の秘匿露出境界(§4規律)にも配慮し、peer 情報は最小に留めた。
- **発生源**: Domain C Lane1(mockup 忠実性の繰延)、Domain C(報告 末尾「繰延」)。
- **回収目安**: C5(複数接続サポートと同時が自然)。複数接続を区別して表示する必要が出た時に、per-connection の識別子(IP:port など)を connected/disconnected event に additive で載せる。

## 3. 複数接続のフルサポート(per-connection overlay 帰属・優先規則)

- **内容**: v0 は複数接続を**許容するが**、overlay は単一 store に混ざり、**いずれか1接続の切断で全 overlay を clearAll**(fail-safe)する。2魂が同時接続すると片方の切断でもう片方の overlay も消える。Connected 表示も単数。
- **なぜ繰延**: v0 は単一参照ドライバ(単一疑似魂)前提([c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md) §7)。per-connection の overlay 帰属・優先規則・2本目の扱い(拒否/併合)は v0 スコープに対し過剰で、意味論を破らずに単一ドライバで機能する据え置きを選んだ。
- **発生源**: Domain A(裁量6)、Domain A Lane1(soft question §11)、Domain C(報告§7)、Domain C Lane2(non-blocking観察3)。
- **回収目安**: C5 以降。per-connection overlay 帰属(接続ごとの sub-store)・優先規則(後勝ち/明示 priority)・切断時は当該接続分のみ失効、へ拡張。

## 4. 封筒 `v`(protocol版)検証の所在

- **内容**: `parseControlChannelRequestEnvelope`(`channel-protocol-messages.ts`)は入力の `v` を検査せず常に `1` を stamp する(`v` 欠落・`v:2` でも v1 扱いで受理)。envelope schema の request は `v: {const: 1}` required を宣言しており、パーサはこれより寛容。
- **なぜ繰延**: v0 は protocol version 1 のみ存在し、バージョン不整合の拒否コードが契約に無い。additive extension 方針(新 kind は supportedKinds と payload schema の追加で載る)の下では、版検証は実物の魂が複数版を送り分ける日まで不要。spec 違反ではない(schema 宣言との厳密性ギャップに留まる)。
- **発生源**: Domain A Lane1(non-blocking 2)。
- **回収目安**: 実物の魂が版を送る日(C5 以降、または protocol v2 導入時)。`v` の const:1 チェックを parser に足すか、schema 側に「v0 は版を検査せず tolerant」と意図を明文化する。

## 5. 契約 JSON の物理配置の昇格(packages/contracts 等)

- **内容**: 契約の家(envelope schema / intent-set payload schema / exchange examples の純JSON + 隣接 TS 型)は現状 `apps/runtime-player/src/main/control-channel/contract/` に置かれ、特区(`apps/soul`)の参照ドライバは `readFileSync`(`import.meta.url` 相対)で読んでいる。
- **なぜ繰延**: 裁定8 で「packages/contracts 昇格は実物の魂の日に検討」と繰延。器側配置で v0 は問題なく、参照ドライバは相対参照 + フォールバックで昇格時も追随容易。今 packages 化すると lockfile importer が増え install 儀式を呼ぶ(裁定4 の回避対象)。
- **発生源**: 裁定8、Domain A(報告§9-4)、Domain D(報告§10-3)。
- **回収目安**: 実物の魂が別ツールチェーン(Python サイドカー等)で契約を消費し、器側 src 相対参照が破綻する日。`packages/contracts` 等の中立配置へ昇格を検討。

## 6. Stage Presence とチャネルの結合可否(C5 精緻化)

- **内容**: 現状、チャネルオーバーレイは resolver 手前で `activations` にマージされるが、**Stage Presence signal(C3 Domain D)は pure `activations`(マージ手前)を読む**位置のままで、チャネルが body-x 等を上書きしても Stage transform は生成器の body-x に従う(チャネルは Stage を摂動しない)。
- **なぜ繰延**: Domain B は「resolver に渡す Record へのマージ」のみをスコープとし、Stage Presence への波及は C3 挙動を変える範囲外 concern として非結合にした。粗いオーバーレイの範囲では許容で、精緻化は C5。
- **発生源**: Domain B(報告§8-1・裁量1、質問1)。
- **⚠ Undine の方向確認事項**: 「チャネルが body-x を上書きしたら Stage も動くべきか」は設計判断であり、Domain B が Undine への方向確認として明示的に上げている(報告§8 質問1)。C4 は非結合で閉じたが、**C5 の精緻化に入る前に Undine の裁定**を要する(結合するなら heart で `resolvedActivations` から Stage snapshot を取る配線に変わる)。
- **回収目安**: C5(合成の精緻化: 滑らかな立ち上がり・減衰・優先規則と同じ波)。Undine の方向確認を得てから着手。

## 7. 参考: C4 の non-blocking で Domain E が回収済みの事項(繰延ではない)

以下は繰延ではなく **Domain E(本統合)で解消済み**。記録の完全性のため併記:

- **exchange-examples の note 実語彙化**(Domain A Lane1 non-blocking 1): `channel-exchange-examples.json` happyPath の note `face.angle.x` → `head-horizontal` に修正済み(note 文言のみ、payload/schema/TS 型は不変)。
- **normalizedRanges の JSON↔TS 同期テスト**(Domain A Lane3 non-blocking 1): `contract/channel-protocol-contract.test.ts` に `normalizedRanges` ↔ `semanticSlotNormalizedRange()` の同期テスト2本を追記済み(スロット registry で完全性も固定)。
- **degraded data源の等価性不変条件の記録**(Domain C Lane2 non-blocking / 質問2): [../../screens/c4-channel-diagnostics.md](../../screens/c4-channel-diagnostics.md) §3 に構成不変条件と回帰防止メモを注記済み。
