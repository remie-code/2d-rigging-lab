# C2 Domain D 完了報告: 最終統合 / モノレポ検証 / docs / 手動ゲート手順

> 実装: Gnome(opus)。委任元: Orch-Sylph。日付: 2026-07-10。ブランチ: feature/2d-rigging-eco-system。対象アプリ: apps/runtime-player。
> Domain D はコード実装をしない(検証と docs のみ)。A/B/C の source 成果には不接触。

## 判定

**completed**

Escalate 条件(分離不能・実装事実と設計方針の裁定不能な食い違い)には該当せず。モノレポ検証は全て証拠つきで green(既知 baseline 2 件を除く)、無変更確認クリア、docs/map は実装事実の反映に留めて更新済み。手動美的ゲート(§9 の 5 項目)はユーザー実施待ちのため、下記に dev/パッケージ版起動方法つきの手順を全項目分記載した。ブロッカーなし。軽微な質問 2 件を末尾に記す(いずれも C2 の合否を止めない)。

---

## 1. モノレポ検証結果(証拠つき)

### 1.1 runtime-player app(`apps/runtime-player`)

| 検証 | コマンド | 結果 |
|---|---|---|
| typecheck | `npx tsc --noEmit -p tsconfig.json` | **exit 0(エラーゼロ)** |
| アプリ回帰(run 1) | `npx vitest run -c vitest.config.ts` | **606 pass / 2 fail(608 中)** |
| アプリ回帰(run 2) | 同上 | **606 pass / 2 fail** |
| アプリ回帰(run 3) | 同上 | **606 pass / 2 fail** |

- **3 連続ランすべて 606 pass / 2 fail で完全一致。フレークなし。** 過去ドメイン報告(Domain C 時点 606 pass / 2 fail)と一致。
- C2 wave の全テスト(`src/main/live-mapping/` の頭無しリゾルバ・等価性 golden、`src/main/physiology/` の生成器・fixture、`src/main/role-composition/` の心臓・合成)は 606 pass の内側に含まれ、すべて pass。

#### 既知 baseline fail の分類(2 件、当方変更と無関係)

いずれも Wave21 Dynamics Tune 由来の `effectiveDynamicsTuning: null` フィクスチャドリフト。3 ラン全てで同一の 2 件のみが fail:

1. `src/main/broadcast-source/browser-source-server.test.ts` > "Runtime Player Browser Source server > serves current Runtime Export payload to authorized Browser Source clients"
2. `src/stage/browser-source/browser-source-server-message.test.ts` > "readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape"

両者の diff は `+ "effectiveDynamicsTuning": null,`(期待 4 key に対し受信 5 key)のみ。C2 wave の変更範囲(live-mapping / physiology / role-composition)とは無関係・不接触。Domain A/B/C 各報告が記録した既知 2 件と同一。

### 1.2 ルート(monorepo 整合)

| 検証 | コマンド | 結果 |
|---|---|---|
| ルート typecheck | `pnpm run typecheck`(= `tsc --noEmit` 全体) | **exit 0** |
| packages 回帰 | `pnpm run test:unit`(= `vitest run packages …`) | **240 files / 1492 tests 全 pass、exit 0** |

- ルート typecheck 通過 = runtime-player の型も含め monorepo 全体が整合。
- packages 回帰は本 wave の非対象(変更は runtime-player 配下のみ)だが実行し、**packages 側に退行ゼロ**を確認した(時間はかかったが完走)。

### 1.3 `pnpm install` 不実施

- **`pnpm install` は一切実行していない。** 回避工作(手動 symlink 等)もなし。既存 `node_modules` のツール(tsc / vitest / electron)のみを使用。

---

## 2. 無変更確認結果(証拠つき)

`git status --porcelain` / `git diff --stat` で確認。

### 2.1 変更フットプリント(全体)

- **tracked 変更(M)= 3 source + 6 docs**:
  - source(Domain A/C の成果、当方不接触): `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`、`apps/runtime-player/src/main/role-composition/input-subsystem.ts`、`apps/runtime-player/src/main/role-composition/input-subsystem.test.ts`
  - docs(当方が Domain D で更新): §3 の 6 ファイル(下記)
- **untracked(新規)**: `headless-slot-resolver.ts` / `.test.ts`、`runtime-parameter-frame-equivalence.test.ts` / `.golden.json`、`physiology/`、`autonomous-frame-heart.ts` / `.test.ts`(A/B/C の新規 source、当方不接触)、`discussion/ai-cohost/implementation/reviews/c2/`、`.../waves/c2/`。
- **スコープ確認**: `git status --porcelain` を `apps/runtime-player/src/main/(live-mapping|physiology|role-composition)/` と `discussion/ai-cohost/` で除外フィルタ → **残りゼロ(ALL IN SCOPE)**。本 wave の変更は要求スコープ内に収まる。

### 2.2 保護対象の無変更

- **Editor ソース(`apps/editor/` 等)**: 無変更(porcelain にエントリなし)。
- **package-format(`packages/package-format/` 等 packages 全域)**: 無変更。
- **Runtime Export schema**: 無変更(packages / schema ファイルにエントリなし)。
- **lockfile(`pnpm-lock.yaml`)・`pnpm-workspace.yaml`**: 無変更。
- **新規依存なし**: `apps/runtime-player/package.json` は無変更(dependencies / devDependencies 群も含め diff ゼロ)。

### 2.3 実行時 role 分岐ゼロ

`role-composition/` を grep(`if (role ===`、`switch (role)`、`=== "autonomousHost"`、`=== "trackingHost"` 等):
- ヒットは `role-selection-stub.ts:43` の `if (role === null)`(= no-role スタブの入口ガード。autonomousHost/trackingHost の挙動分岐ではない)と、`input-subsystem.ts` の 2 件のコメント(`if (role === ...)` 分岐の**不在**を記す docstring)のみ。
- **autonomousHost/trackingHost を実行時に判定する挙動分岐は存在しない。** 役割差は C1 の合成テーブル一点(`runtimePlayerInputSubsystemComposers`)のまま。

### 2.4 既存の無関係 discussion ファイルへの不接触

- タスクが「触れるな」と指定した `discussion/_conventions.md` / `discussion/_map.md` / `discussion/runtime-player/_map.md` は**当方が触れていない**(porcelain にエントリなし)。
  - 補足(リポジトリ事実): これら 3 ファイルは委任時スナップショットでは M と表示されていたが、現 HEAD では未変更状態(セッション間でコミット済みと思われる)。いずれにせよ当方は不接触。

---

## 3. 更新した docs / map の一覧(絶対パス)と各変更の要旨

**新方針は発明せず、既に裁定/実装済みの事実の反映に留めた。** official facts(実装済み=fact)と assumption(将来方針=既存記述維持)を分離して記述。

1. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\architecture\c2-blink-and-generator-skeleton.md`
   - Status ブロックに「実装=C2 wave 完了(A→B→C→D)、機械ゲート green・3レーンレビュー全 PASS、手動美的ゲート待ち」+実装成果物リンクを追記。
   - §3.3 に「実装事実(C2 wave 完了)」ブロックを追記: **Option B が実装された**事実(頭無しリゾルバ `headless-slot-resolver.ts` の非破壊抽出、トラッキング経路も同一リゾルバ、構造ギャップ=意味スロット受け口の解消、等価性 golden で退行ゼロ固定)、生成器骨格が physiology/ に実装された事実、フレーム心臓 60Hz と autonomousHost composer 差し替え・role 分岐ゼロの事実、ゲート状態。既存本文の設計意図は不変。

2. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\architecture\physiological-layer-and-envelope.md`
   - §2 の繰延注記に「実装事実(C2 wave 完了)」を追記: **裁定2(C2 は `apps/runtime-player/src/main/physiology/` に置き、packages 移設は第二段繰延)が実装された事実**(ファイル名列挙、純度担保、packages 移設は未実施=繰延のまま、lockfile/workspace 無変更)。加えて**頭無しリゾルバ(棚卸し不整合2: 意味スロット値を受ける口)が Option B で新設された事実**を記録。
   - §5(等価性検証)に「実装事実(C2)」を追記: C2 は Player 側のみで **Editor↔Player 等価性契約は第二段繰延**、Player 内決定論は fixture で機械固定済み、第二段への接続土台は満たす旨。**§5 の将来方針(packages 等価性文化)自体は変更せず**、現状が繰延であることの記録に留めた。
   - §6(未決事項)の「生成器の置き場所となる package の特定」項に、C2 裁定2/実装で当面保留=第二段の宿題として残る旨を追記(C2 で解消された論点ではないことを明示)。

3. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\architecture\_map.md`
   - c2-blink-and-generator-skeleton 行の Status に「実装=C2 wave 完了(手動美的ゲート待ち)」を追記。
   - physiological-layer-and-envelope 行の Status に「§2/§5/§6 に C2 実装事実を追記(physiology は apps/ 配置=裁定2 実装済み、packages 移設・等価性は第二段繰延、将来方針不変)」を追記。

4. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\_map.md`
   - orchestration 行に「C2 wave 実装完了」状態を追記。
   - **waves/c2/ 行・reviews/c2/ 行を新規追加**(実在成果物 = Domain A/B/C/D 実装報告、Domain A/B/C 各 3 レーンレビュー)。
   - 「次の行動」の C2 項を「wave 実装完了・機械ゲート緑・残=ユーザー手動美的ゲート(手順は Domain D 報告)」に更新。

5. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\orchestration\_map.md`
   - c2-wave-plan.md 行の Status を「Ready to launch」→「wave実装完了・機械ゲート green・3レーンレビュー全 PASS・手動美的ゲート待ち」に更新、実装報告/レビューへのリンク追加。

6. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\_map.md`(トピック入口)
   - Directory Map の implementation 行 Status を C1 完全閉鎖 + C2 wave 実装完了に更新。
   - §4 Current State に C2 wave 実装完了の bullet を追加(成果の要点と残=手動美的ゲート)。
   - §5 Next Actions の C2 項を「次の一手 = C2 のユーザー手動美的ゲート、合格で完全閉鎖 → C3」に更新。

**加えて**(C1 の Domain C が c1-wave-plan §1 Status を更新した先例に倣い):

7. `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\orchestration\c2-wave-plan.md`
   - §1 Status を「Ready to launch」→「wave実装完了(Domain A→B→C→D)、手動美的ゲート待ち」に更新(機械ゲート結果・無変更確認・実装報告リンクを含む。初稿 Status は括弧で保持)。**最終「完全閉鎖」判定は L0 の領分**として残す(手動ゲート合格後)。

---

## 4. ユーザー手動ゲート手順(C2 wave-plan §9 Manual Check Notes、5 項目)

> これは C2 の**美的ゲート本体**(機械では判定できない「生きて見えるか」)。Orch-Sylph → Undine → ユーザーへ渡す本体。dev 版とパッケージ版の両起動方法を添える。

### 4.0 role 指定の仕組み(dev / パッケージ版 共通)

役割は **`--role=<role>` CLI 引数**で指定する(`role-launch-resolution.ts` が composition root 入口で `process.argv` を一度パース。`--role=trackingHost` / `--role=autonomousHost`)。dev もパッケージ版も同一機構——パッケージ版特有の別手段は不要(portable exe が CLI 引数をそのままアプリへ通す)。`--profile=<slotName>` で既定スロット以外も選べる(2 窓運用では不要。省略時は `<role>-default` = `tracking-default` / `autonomous-default`)。

### 4.1 dev 起動

リポジトリの `apps/runtime-player` から:

```powershell
cd apps/runtime-player

# 自律ホスト(まばたきゲート本体)
pnpm exec electron-vite dev -- --role=autonomousHost

# トラッキングホスト(項目4/5 用)
pnpm exec electron-vite dev -- --role=trackingHost
```

- **`--role` を必ず明示すること**(既知制限)。**dev の引数なし起動は真っ黒になる**——役割選択スタブの relaunch が electron-vite の dev server と非両立(C1 既知制限、[../../orchestration/c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §1 Status / [../c1/black-screen-investigation.md](../c1/black-screen-investigation.md))。`electron-vite dev -- <args>` の `--`(ダブルダッシュ)が後続を electron へ転送するため、`--role` はこの `--` の後ろに置く。
- **dev は二重起動時に userData / renderer dev server を共有する**ため、**二体並走(項目5)には無効**。項目5 は必ずパッケージ版で実施すること(C1 と同じ理由)。項目1〜4 は dev でも実施可。

### 4.2 パッケージ版起動

**ビルド/パッケージ**(`apps/runtime-player` から。`pnpm install` 不要):

```powershell
cd apps/runtime-player
pnpm run build      # typecheck + electron-vite build → out/
pnpm run dist:win   # build + electron-builder --win --x64 → dist/ に portable exe
```

- 生成物: `apps/runtime-player/dist/` に **portable の単一 exe**(既定命名 `Runtime Player 0.0.0.exe`。正確なファイル名はビルド後 `dist/` で確認)。
- 注意(環境依存): electron-builder は初回に winCodeSign / nsis 等をキャッシュへ**ネットワークダウンロード**する場合あり(オフライン環境では失敗し得る。`pnpm install` ではない)。未署名 exe のため SmartScreen 警告が出る可能性あり(ゲート実施には支障なし)。

**role 指定つき起動**(PowerShell、または exe のショートカットに引数を付す):

```powershell
& ".\dist\Runtime Player 0.0.0.exe" --role=autonomousHost
& ".\dist\Runtime Player 0.0.0.exe" --role=trackingHost
```

- ショートカット運用: exe のショートカットを 2 つ作り、リンク先の後ろに `--role=autonomousHost` / `--role=trackingHost` を付す(C1 で確立した手順、[../c1/domain-c-final-integration.md](../c1/domain-c-final-integration.md) §3.1)。

### 4.3 5 項目の実施手順

**項目1 — ロードで瞬き開始**
1. 自律ホストを起動(dev: `pnpm exec electron-vite dev -- --role=autonomousHost` / パッケージ版: `… --role=autonomousHost`)。
2. Control window から Runtime Export を読み込む(まぶたパラメータを持つモデル= `eye.left.open` / `eye.right.open` にマップできるモデル。auto-mapping がまぶたスロットを解決する)。
3. **設定・チェックボックス・UI 操作なしで**、ロード直後から Native Stage 上でモデルが自発的にまばたきし始めることを確認。
- 期待: ロード直後(t=0)は目開き、以後まばたきが入力ゼロで始まる(「読み込まれた身体は生きて生まれる」)。

**項目2 — 30秒眺めて死体・機械ループでないか(美的ゲート本体)**
1. 項目1 の状態で **30 秒** 眺める。
2. 判定: (a) 完全静止=**死体**に見えないか、(b) メトロノーム的な等間隔まばたき=**機械のループ**に見えないか。間隔のばらつき+最短不応期+たまの二連(ぱちぱち)で「生きて見える」か。
- これが **C2 の合否本体**(機械では判定不能)。負けたら C3 のツマミで拾う(設計 §2)。合否をこの目視で下す。

**項目3 — OBS Browser Source でも同じまばたき**
1. 同じ自律ホストインスタンスで、Control window の **Stage ページの「Browser Source URL をコピー」**から URL を取得(自律ホストの Browser Source サーバは `autonomous-default` スロット= **`http://127.0.0.1:17309/stage?token=<token>`**、token は per-slot 生成)。
2. OBS の **Browser Source** にその URL を貼る。
3. Native Stage と**同じまばたき**が Browser Source 側にも見えることを確認。
- 根拠: 心臓は 60Hz で既存 `publishFrame` を叩き、Stage IPC と Browser Source WS の両方に同一 frame が乗る(新経路を作らない)。
- 注意(質問Q1 参照): 自律ホストの Control ページは C1 時点で入力/マッピング系が degraded(C4 で解消予定)。Stage ページの Browser Source URL コピーはコード上 `browserSourceStatus`(自律ホストでも populate)から取れる想定だが、degraded ページで当該 UI が surface されるかは実機未確認。surface されない場合、URL は決定論的に上記(port 17309 固定、token は per-slot browser-source config)。

**項目4 — トラッキングホストで従来どおり(退行なし)**
1. トラッキングホストを起動(dev: `pnpm exec electron-vite dev -- --role=trackingHost` / パッケージ版: `… --role=trackingHost`)。
2. 顔トラッキング入力(iPhone 等)を接続し、**顔トラッキング由来のまばたき・表情で従来どおり動く**ことを確認(まばたき含め C1 以前と挙動等価)。
- 根拠: 生成器・心臓は trackingHost の合成に**存在しない**(`composeTrackingHostInputSubsystem` 無変更、テストで心臓不在を固定)。トラッキング経路は同一頭無しリゾルバを通るが等価性 golden で出力完全一致=退行ゼロ。

**項目5 — 二体並走で干渉しない(必ずパッケージ版)**
1. パッケージ版 exe を 2 つ起動: 一方 `--role=trackingHost`、他方 `--role=autonomousHost`(別スロット= 別 userData / 別 port / 別 token、C1 で確立)。
2. 自律ホストは自発まばたき、トラッキングホストは顔トラッキング由来まばたき。**互いのまばたきが干渉しない**ことを確認(別プロセス・別フレーム源・別 Browser Source ポート 17308/17309)。
- **必ずパッケージ版で**(dev は userData / dev server 共有のため無効。C1 と同じ理由)。

---

## 5. 裁量判断・質問(ユーザー/上位判断が要る点)

- **docs 不整合でユーザー判断が要る箇所: なし。** 棚卸しが挙げた不整合1(生成器の置き場)・不整合2(意味スロット受け口)は、いずれも**既に裁定/実装で解消済みの事項**であり、docs には「裁定2 が実装された/Option B で新設された」という事実の反映に留めた。既存設計方針(§5 packages 等価性文化)と実装事実(第二段繰延)は矛盾せず、繰延として整合する。勝手な本文書き換えは行っていない。

- **Q1(項目3 の運用確認、非ブロッキング)**: 自律ホストの Control ページが degraded(C4 で解消予定)な状態で、Browser Source URL コピー UI(Stage ページ)がユーザーに surface されるか、実機未確認。コード上は `copyBrowserSourceUrl` / `browserSourceStatus` が自律ホストでも機能する想定だが、degraded ページで当該ボタンが出ない場合、ユーザーは URL(port 17309 固定 + per-slot token)を config から手動取得する必要が生じ得る。項目3 の実施に軽い摩擦になり得るため、手動ゲート前に一度確認いただきたい(C2 の合否は止めない)。

- **Q2(送信タイムスタンプの決定論化、Domain C 申し送りの再掲、非ブロッキング)**: Domain C は `sourceFrameTimestampMs` に壁時計 `now()` を採用(裁定3/7「送信タイムスタンプは決定性境界外」に沿う)。決定論 fixture は生成器の意味スロット列で担保済み。もし統合ゲートで「送信タイムスタンプも決定論固定したい」要望が出れば、注入 `now` で logical time へ切替可能(Domain C 報告 質問2)。現状は設計裁定どおりのため変更不要と判断。

- **c2-wave-plan §1 Status の「完全閉鎖」判定**: 本報告で §1 Status を「wave実装完了・手動美的ゲート待ち」まで更新したが、**最終「完全閉鎖」の宣言は L0(Undine)の領分**として残した(C1 と同じ、手動ゲート合格後に L0 が下す)。

---

## 6. Subagent Contract 遵守確認

- **`pnpm install` 未実施**。回避工作なし。lockfile・`pnpm-workspace.yaml`・新規依存いずれも無変更。
- **Editor ソース / package-format / Runtime Export schema / lockfile 無変更**(§2.2 で grep 確認)。
- **実行時 role 分岐を書いていない**（Domain D はコード実装をしない。変更は docs/map の 7 ファイルのみ、検証はコマンド実行のみ）。§2.3 で role-composition の role 分岐ゼロを再確認。
- **A/B/C の source 成果に不接触**（検証と docs のみ。`runtime-parameter-frame.ts` / `headless-slot-resolver*` / `physiology/` / `autonomous-frame-heart*` / `input-subsystem*` に触れていない）。source に触る必要は生じなかった（escalate 不要）。
- **無関係変更の revert なし**。作業ツリーの既存 discussion ファイル（`_conventions.md` / `_map.md` / `runtime-player/_map.md` 等、本 wave と無関係なもの）に不接触。触れたのは C2 wave に直接関係する docs/map のみ。
- **ドメイン想定外の共有ファイルに触れていない**（更新は C2 の設計討議 2 件と、C2 成果を索引する map 4 件 + wave-plan §1 Status のみ。いずれもタスクが明示した対象範囲内）。
- C1 の成果・Browser Source primary path・Wave10〜21・Wave22/23 vowel lip sync を退行させていない（アプリ回帰 606 pass、packages 1492 pass、既知 baseline 2 件は当方変更外で不変）。
