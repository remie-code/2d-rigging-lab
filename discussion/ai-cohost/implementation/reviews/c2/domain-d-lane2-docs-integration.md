# C2 Domain D レビュー(Review-Sylph, レーン②): docs 正確性 / 統合健全性 / 手動ゲート手順

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph(最終 clean review)。日付: 2026-07-11。読み取り専任。
> レーン: docs 更新の正確性・統合健全性・手動ゲート手順の技術的正しさ(他2レーン=AC/contract, monorepo検証は別 Review-Sylph)。
> 判定根拠: c2-wave-plan §9、c2-planning-inventory 末尾「ドキュメント間の不整合」節、実 docs の `git diff`、実コード。

## 判定

**合格(PASS)。blocking ゼロ。**

Domain D が更新した docs 7 ファイルはいずれも実装事実を正確に反映し、未合意の新方針を発明せず、既存設計方針を無断で書き換えていない。手動ゲート手順(§4)は role 指定機構・build/dist scripts・Browser Source port/URL・「必ずパッケージ版」の理由まで、すべて実コードと一致することを確認した。map の新規/更新エントリは実在成果物を正しく指す。触れてはならないファイルへの変更なし。非 blocking の裁量注記・継承質問を末尾に記す。

---

## 1. docs 正確性の検証(ファイルごと)

対象は tracked M の docs 7 ファイル(`git diff` で変更前後を確認)。以下いずれも実装事実と一致。

### 1.1 `architecture/c2-blink-and-generator-skeleton.md`
- Status ブロック追記(実装=C2 wave 完了 / 機械ゲート green / 3レーン PASS / 手動美的ゲート待ち)+実装成果物リンク。**正確**。
- §3.3「実装事実」ブロックの各主張を実コードで裏取り:
  - Option B / 頭無しリゾルバ `resolveSemanticSlotParameterValues` → `live-mapping/headless-slot-resolver.ts` に実在。`runtime-parameter-frame.ts` から呼ばれる(= トラッキング経路も同一リゾルバ)。**一致**。
  - 「等価性 golden(代表 TrackingFrame 20シナリオの完全一致)」→ `runtime-parameter-frame-equivalence.golden.json` は top-level 20 キー。**一致**。
  - 「既存 frame テスト19件の無変更全通過」→ `runtime-parameter-frame.test.ts` は 19 `it/test`。同ファイルは git 上 unmodified(=無変更)。**一致**。
  - 生成器骨格 physiology/、フレーム心臓 `autonomous-frame-heart.ts`、autonomousHost composer 差し替え、実行時 role 分岐ゼロ → いずれも実在・整合(下記参照)。**一致**。
  - 「既存本文の設計意図は不変」→ diff は §Status と §3.3 追記のみ、本文改変なし。**遵守**。

### 1.2 `architecture/physiological-layer-and-envelope.md`
- §2 繰延注記への「実装事実」追記:
  - 「physiology を `apps/runtime-player/src/main/physiology/` に置いた(裁定2どおり)」→ 実ディレクトリに `physiology-generator.ts` / `blink-behavior.ts` / `behavior-class.ts` / `deterministic-hash.ts` すべて実在(加えて index.ts / golden / test)。**一致**。
  - 「packages 移設は未実施=第二段繰延」「`pnpm install`・lockfile・`pnpm-workspace.yaml` 無変更」→ Domain D 報告および git status と整合(packages/lockfile に diff なし)。**一致**。
  - 頭無しリゾルバ新設(棚卸し不整合2 の解消)を Option B の非破壊抽出として記録。**正確**(不整合2 の解消と対応)。
- §5(等価性検証)への「実装事実(C2)」追記:
  - 「Editor↔Player 等価性契約は第二段繰延」「Player 内決定論は fixture(16ms×900frame)で機械固定」→ `blink-behavior-fixture.test.ts` に `STEP_MS = 16` / `FRAMES = 900` を確認。**一致**。
  - **「本節の将来方針(packages 等価性文化)自体は変更しない」を明記し、diff 上も §5 本文は不変で追記のみ。将来方針の無断改変なし**。**遵守**(重要観点2 クリア)。
- §6 未決事項:「生成器の置き場所となる package の特定」項に、C2 では当面保留=第二段の宿題、C2 で解消された論点ではない旨を追記。原文を残した追記であり、**繰延の記録として整合的**。**遵守**。

### 1.3 map 4 ファイル(`architecture/_map.md` / `implementation/_map.md` / `implementation/orchestration/_map.md` / `ai-cohost/_map.md`)
- 各 Status の更新(C1 完全閉鎖 + C2 wave 実装完了・機械ゲート green・レビュー全PASS・手動美的ゲート待ち)は実態と一致。
- `implementation/_map.md` の新規 waves/c2 行・reviews/c2 行 → 下記 map 正確性で実在確認。
- リンク・索引に誤りなし(下記 §4)。

### 1.4 `orchestration/c2-wave-plan.md`(§1 Status のみ)
- `git diff --stat` = 1 insertion/1 deletion。**§1 Status 1 行のみ**の変更で、他節(裁定・Domain 定義・§9 Manual Check Notes 等)は不変。**遵守**。
- 「最終『完全閉鎖』判定は L0 の領分として残す」= C1 先例に沿う。手動ゲート前に閉鎖宣言をしていない。**適切**。

---

## 2. 未合意の新方針発明の有無(重要観点)

**発明なし。** 棚卸しの不整合1/2/3 の docs 反映は、いずれも「既に裁定/実装で解消された事実の記録」に留まっている:

- **不整合1(生成器の置き場: physiological §5 vs Player スコープ)** → 裁定2(apps/ 配置・packages 移設は第二段繰延)の実装事実として記録。§5 の将来方針(packages 等価性文化)は**変更せず**、C2 が繰延であることの記録に徹している。§5 将来方針と実装事実(繰延)は矛盾せず整合。
- **不整合2(意味スロット受け口の不在)** → Option B 頭無しリゾルバ新設の実装事実として記録。設計方向(§3)は既決、具体シームが実装で埋まった、という正しい因果で記述。
- **不整合3(フレーム心臓の空白)** → フレーム心臓 60Hz 実装の事実として記録(棚卸しも「設計判断ではなく事実の補足」と位置づけ)。

official facts(実装済み=fact、「リポジトリ事実」と明示ラベル)と assumption(将来方針=既存記述維持)の分離が全ファイルで守られている(観点5 クリア)。

---

## 3. 手動ゲート手順の技術的裏取り(重要観点)

Domain D 報告 §4 の 5 項目手順を実コードに照合。**すべて技術的に正しい。**

- **role 指定機構(§4.0)**: `profile-slots/role-launch-resolution.ts` の `parseRuntimePlayerRoleArguments` が `--role=<role>` / `--profile=<slot>` を `process.argv` からパース。`--role=trackingHost` / `--role=autonomousHost`、profile 省略時は `defaultSlotNameForRole` = `tracking-default` / `autonomous-default`。手順記述と**完全一致**。`--profile` は `--role` 必須(コード上も profile-only は error)まで記述と整合。
- **dev 起動(§4.1)**: `pnpm exec electron-vite dev -- --role=autonomousHost`。package.json の `dev` script(`electron-vite dev --watch`)は role を渡せないため、electron-vite を直接叩き `--` 後方を electron へ転送する記述は**技術的に妥当**(C1 で確立した機構)。dev 引数なし=黒画面の既知制限は C1 wave-plan / black-screen-investigation を参照する事実引用で、C2 が新たに主張する誤りはない。
- **build/dist コマンド(§4.2)**: `pnpm run build`(= typecheck + electron-vite build → out/)、`pnpm run dist:win`(= build + electron-builder --win --x64 → dist/)は package.json scripts と**逐語一致**。electron-builder 設定は `target: portable / x64`、`productName: "Runtime Player"`、`directories.output: dist`、version `0.0.0`。→ portable 単一 exe「Runtime Player 0.0.0.exe」、出力先 dist/ の記述は**一致**。
- **Browser Source port / URL(§4.3 項目3・5)**: `host-role.ts` で `tracking-default` = 17308(`runtimePlayerBrowserSourceDefaultPort`)、`autonomous-default` = 17308+1 = **17309**。`browser-source-url.ts` の `createBrowserSourceStageUrl` = `http://127.0.0.1:<port>/stage?token=<token>`(bind 127.0.0.1、token query key "token")。→ 「autonomous-default の Browser Source = `http://127.0.0.1:17309/stage?token=<token>`」「二体並走 = 17308/17309」は**完全一致**。token per-slot 生成の記述も port テーブルが slot 名キー(role 分岐なし)である事実と整合。
- **項目5「必ずパッケージ版」の理由**: dev の二重起動で userData / renderer dev server を共有=二体並走に無効、という C1 と同一の理由付け。技術的に正しく、C1 で確立済み。**妥当**。

---

## 4. map 正確性

追加/更新 map エントリが実在成果物を指すことを確認:

- `implementation/_map.md`: waves/c2/(4 ファイル: domain-a〜d)・reviews/c2/(9 ファイル: domain-a/b/c × lane1/2/3)実在。「Domain A/B/C とも 3 レーン PASS」の索引は実ファイル構成と一致(Domain D の lane レビューは本レビュー群として今生成中で、未索引は正しい)。domain-d-final-integration.md へのリンク実在。
- `orchestration/_map.md` / `architecture/*`: `../waves/c2/`・`../reviews/c2/`・`../implementation/orchestration/c2-wave-plan.md` いずれも実在パス。
- `ai-cohost/_map.md`: `implementation/waves/c2/domain-d-final-integration.md` 実在。
- **リンク切れ・誤索引なし。**

---

## 5. 触れてはならないファイルへの不接触(観点6)

- `discussion/_conventions.md` / `discussion/_map.md` / `discussion/runtime-player/_map.md` は現 git status の working tree 変更に**現れない**(= Domain D 不接触)。委任時スナップショットでは M だったが、現 HEAD では未変更(セッション間でコミット済み。ブランチに新規コミット履歴あり)。Domain D 報告 §2.4 の説明と整合。**違反なし。**
- Domain D の docs 変更は C2 に直接関係する 7 ファイルのみ。無関係 discussion ファイルへの波及なし。

---

## 6. blocking 差分

**なし。**

---

## 7. 裁量注記(非 blocking)

- **N1**: physiological-layer §2 の physiology ファイル列挙(4 ファイル)は実在するがディレクトリ内容の網羅ではない(index.ts / golden / test を含まない)。文脈上「主要ソースの例示」であり誤りではない。修正不要。
- **N2**: c2-blink §3.3 の「16ms×900frame」「20シナリオ」「19件」等の具体数値は実装と一致するが、実装リファクタで変動し得る値。将来ドリフト時は docs 追随が要る(通常の設計討議 docs の宿命であり、現時点で不正確ではない)。

## 8. 質問(継承・非 blocking)

- **Q1(Domain D §4.3 項目3 の再掲)**: 自律ホストの Control ページが degraded(C4 で解消予定)な状態で、Stage ページの Browser Source URL コピー UI がユーザーに surface されるかは実機未確認。**port 17309 固定・token per-slot はコードで確定**しているため、UI が出なくても手順は成立する(config から手動取得可能)。docs の hedge 記述(「決定論的に上記」)は技術的に正確で、blocking ではない。ユーザー手動ゲート前に一度の運用確認が望ましい、という Domain D の申し送りに同意。
- **Q2**: 「完全閉鎖」宣言を L0 が下す前提で本レビューは docs/手順の正確性のみを判定した。手動美的ゲート(§9 の 5 項目、ユーザー実施)の合否は本レーンの管轄外。
