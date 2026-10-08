# C6 ホットフィックス Domain F — Physiology Speech セクションの bridge 検証欠落バグ修正

実装者: Gnome（地の精霊・実装担当、別コンテキスト）。本作業は Orch-Sylph からのサブエージェント委任として実施。
リポジトリ状態: 起点 HEAD=ed49b5d、feature/2d-rigging-eco-system。

## 1. 原因の確定（ファイル:行）

**主原因（ユーザー実機で報告されたバグ）**:
`apps/runtime-player/src/main/physiology-bridge-request-validation.ts` の白名単セット
`PHYSIOLOGY_SECTION_IDS`（旧 8-14 行）に `"speech"` が欠落していた。`readSection`（旧 56-62 行）が
このセットに無いセクションを `"Physiology section is not a known section."` で throw するため、
`updateTone`（section:"speech", field:"articulation"）と `resetSection`（section:"speech"）の
両 bridge リクエストがここで拒否されていた。Orch-Sylph のコードレベル確定と一致。

根本メカニズム: `new Set<PhysiologySectionId>([...])` は各要素の型は強制するが、union 全メンバーの
網羅は強制しない。そのため `speech` の欠落がコンパイルを擦り抜け、白名単と contract/state のセクション
一覧が二重管理のまま乖離した。

**私（Gnome）が grep 最終確認で追加発見した第二の穴（persistence 経路）**:
`apps/runtime-player/src/main/physiology-profiles/physiology-profile-parser.ts` の
`parseToneOverrides`（旧 101-145 行）が `value.speech` を一切パースしていなかった。
保存経路（`physiology-state.ts` `createProfileSnapshot` は `overrides: this.overrides` を全量書き出すため
speech もディスクへは保存される）に対し、**再読込時に speech override が黙って捨てられる**潜在バグ。
ユーザーが Articulation を調整→保存→再起動すると設定が無音で失われる。委任の「もし別の穴があれば同時に塞ぐ」
指示に従い同時修正した。

grep で確認した「speech を知る／知らない」他経路（穴なし）:
- `physiology-bridge-contract.ts`（15-21 行）`PhysiologySectionId` に speech あり ✓（無変更）
- `physiology-state.ts`（30-37 行）独立 `PHYSIOLOGY_SECTION_IDS` 配列に speech あり ✓
- `physiology-tone-config.ts` `PHYSIOLOGY_SECTION_TONE_FIELDS`（88-97 行）に speech あり ✓
- `physiology-bridge-handlers.ts` 独自の section 白名単を持たず validation 結果を state へ素通し ✓
- section 白名単・`.has(`・`.includes(` の全ヒットを精査し、上記 2 箇所以外に speech 欠落は無いことを確認。

## 2. 修正内容（変更した各ファイルと変更趣旨）

1. `apps/runtime-player/src/main/physiology-bridge-request-validation.ts`
   - `"speech"` を白名単に追加。
   - さらに**二重管理そのものの再発防止**として、白名単を手書き Set から
     `PHYSIOLOGY_SECTION_ID_PRESENCE: Readonly<Record<PhysiologySectionId, true>>` の
     網羅リテラルから導出する形に変更（`PHYSIOLOGY_SECTION_ID_WHITELIST = new Set(Object.keys(...))`）。
     Record を contract union `PhysiologySectionId` でキーするため、**将来 union に新セクションを足して
     ここへ追記し忘れると TypeScript コンパイルエラー**になる（"Property 'xxx' is missing"）。
     これが今回の型擦り抜けを構造的に封じる核心。白名単は drift-guard テスト用に export した。

2. `apps/runtime-player/src/main/physiology-profiles/physiology-profile-parser.ts`
   - `PHYSIOLOGY_SPEECH_TONE_FIELDS` を import し、`parseToneOverrides` に他の numeric セクションと
     完全対称の `speech = parseNumericFamily(value.speech, PHYSIOLOGY_SPEECH_TONE_FIELDS, "speech", ...)`
     を追加、返却オブジェクトに `speech` を合流。persistence 再読込で speech override が保持される。

契約（contract）ファイルの型定義は変更していない（白名単真実源として import 参照する形のみ採用）。
純度境界（質感語のみ・工学数字を renderer/UI に出さない）に対する影響なし（変更は全て main プロセスの
検証／パース層のみで renderer 出力を一切変えない）。

## 3. 再発防止テストの内容（追加テスト名・場所・何が落ちる形になったか）

**新規ファイル** `apps/runtime-player/src/main/physiology-bridge-request-validation.test.ts`:
- `"whitelists EXACTLY the contract's full section-id set (drift guard)"` — **再発防止の核心**。
  検証白名単 `PHYSIOLOGY_SECTION_ID_WHITELIST` を、contract union `PhysiologySectionId` でキーされた
  網羅 Record `PHYSIOLOGY_SECTION_TONE_FIELDS`（tone-config）のキー集合と完全一致比較。
  将来セクションを contract（＝この Record）に足したのに白名単へ追記し忘れると**この突合が落ちる**。
  （加えて上記コンパイル時ガードもあるため、忘れは実質コンパイル段階で先に落ちる二重防御。）
- `"accepts the Speech section for a tone update (F Domain regression)"` — validation 単体で speech 更新受理。
- `"accepts the Speech section for a reset request (F Domain regression)"` — validation 単体で speech reset 受理。
- `"rejects an unknown section with the known-section error"` — 既存の拒否挙動が保たれることを固定。

**end-to-end（bridge 検証 → state → config 反映）** `physiology-bridge-handlers.test.ts` に追加
（既存 F1 stagePresence テストの形を踏襲、他セクションと同じ網羅）:
- `"accepts the page's Speech Articulation update end-to-end (F Domain hotfix)"` —
  実 state を bridge 経由でページと同一 request 形（section:"speech", field:"articulation", tone:1）で駆動。
  `result` が `validation-error` でなく `ok`、section.hasOverride=true、tones.articulation=1、かつ
  `getPhysiologyConfig().speech.articulationFloor === ARTICULATION_FLOOR_CRISP`（最crisp floor が config seam へ到達）。
  修正前はここが validation-error で**落ちる**。
- `"resets the Speech section end-to-end (F Domain hotfix)"` —
  speech 更新後に `resetSection {section:"speech"}` が `ok` になり hasOverride=false / articulation=DEFAULT_TONE へ戻る。
  修正前は Reset Speech が validation-error で**落ちる**。

**persistence round-trip ガード** `physiology-profiles/physiology-profile-store.test.ts`:
- 既存 `"persists and reloads quality-word tone overrides"` の保存 override に `speech:{articulation:0.85}` を追加。
  parser が speech を落とすと再読込結果に speech が現れず**この round-trip が落ちる**（第二の穴の回帰ガード）。

## 4. 検証結果（実行コマンド文字列と実際の出力）

実行者=Gnome（本エージェント）。作業ディレクトリ `apps/runtime-player`。

**型チェック**: `pnpm run typecheck`（= `tsc --noEmit -p tsconfig.json`）
→ エラー出力なし・正常終了（exit 0）。網羅 Record ガードを含め型エラー 0。

**該当テスト（追加分含む）**:
`pnpm exec vitest run -c vitest.config.ts src/main/physiology-bridge-request-validation.test.ts src/main/physiology-bridge-handlers.test.ts src/main/physiology-profiles/physiology-profile-store.test.ts`
→ 実出力:
```
 ✓ src/main/physiology-bridge-request-validation.test.ts (4 tests) 4ms
 ✓ src/main/physiology-profiles/physiology-profile-store.test.ts (7 tests) 21ms
 ✓ src/main/physiology-bridge-handlers.test.ts (8 tests) 18ms
 Test Files  3 passed (3)
      Tests  19 passed (19)
```

**パッケージ全体スイート**: `pnpm run test:unit`（= `vitest run -c vitest.config.ts`）
→ 実出力: `Test Files  2 failed | 138 passed (140)` / `Tests  2 failed | 923 passed (925)`。
2 件の失敗はいずれも **physiology と無関係の browser-source / broadcast-source サブシステム**:
- `src/stage/browser-source/browser-source-server-message.test.ts`（"accepts the not-loaded response shape"）
- `src/main/broadcast-source/browser-source-server.test.ts`（"serves current Runtime Export payload ..."）

両者が**私の変更と無関係な既存失敗**であることを、変更を `git stash -u` で退避したクリーン HEAD で個別実行し確認:
- `browser-source-server-message.test.ts` → クリーン HEAD で `Test Files 1 failed (1) / Tests 1 failed | 5 passed (6)`
- `browser-source-server.test.ts` → クリーン HEAD で `Test Files 1 failed (1) / Tests 1 failed | 15 passed (16)`
どちらもクリーン HEAD で同一に落ちるため既存不具合。physiology 関連テストは 19/19 全通過、私の変更起因の失敗は 0。

## 5. 変更ファイル一覧（`git diff --stat` 実出力 + 新規ファイル）

追跡済み変更（`git diff --stat`）:
```
 .../src/main/physiology-bridge-handlers.test.ts    | 61 ++++++++++++++++++++++
 .../main/physiology-bridge-request-validation.ts   | 33 +++++++++---
 .../physiology-profile-parser.ts                   | 13 ++++-
 .../physiology-profile-store.test.ts               |  5 ++
 4 files changed, 103 insertions(+), 9 deletions(-)
```
新規ファイル（untracked, `git status --porcelain`）:
```
?? apps/runtime-player/src/main/physiology-bridge-request-validation.test.ts
```
本報告ファイル `discussion/ai-cohost/implementation/waves/c6/domain-f-hotfix.md` も新規追加。

## 6. 無変更確認（契約型定義・golden・純度・lockfile）

- **契約型定義**: `git diff --stat -- apps/runtime-player/src/preload/physiology-bridge-contract.ts` → 出力空（無変更）。
  validation は同ファイルの `PhysiologySectionId` を型 import して真実源に参照するのみで、型定義自体は不変更。
- **golden**: `git diff --stat -- '*golden*' '*.golden*'` → 出力空（無変更）。
- **lockfile**: `git diff --stat -- '*lock*'` → 出力空（pnpm-lock.yaml 等無変更）。依存追加なし。
- **純度境界**: 変更は main プロセスの検証層（validation）とパース層（parser）およびテストのみ。
  renderer / UI への出力（`physiology-page.tsx` 等）は一切変更しておらず、工学数字（ms/Hz/probability）が
  renderer に漏れる新経路は追加していない。質感語 tone [0,1] のみが従来どおり境界を越える。

## 7. 分離規律の受領（証跡）

本委任の冒頭「分離規律（必読）」文言を実際に受領した:「Orch-Sylph 自身は実装担当ではない。source
implementation は必ず別コンテキストの Gnome（あなた）に委譲し、レビューは必ず別コンテキストの
Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
本作業は実装担当 Gnome（別コンテキスト）が正規委任として実施。レビューは別コンテキストの Review-Sylph へ
委譲されるべきものであり、本エージェントはレビューを兼務していない。

## 8. 判断に迷った点・残課題

- **裁量点（真実源の選択）**: 検証白名単の再発防止形として「コンパイル時網羅 Record ＋ ランタイム突合テスト」の
  二重防御を採用し、突合テストの真実源には既存の網羅 Record `PHYSIOLOGY_SECTION_TONE_FIELDS`（tone-config）を
  使用した。contract 型定義の無変更制約を守るため、contract ファイルへの runtime const 追加は行っていない。
- **裁量点（第二の穴の扱い）**: parser の speech 欠落は主バグとは別だが同一クラス（二重管理 drift）かつ実害
  （保存設定の消失）があるため、委任の「別の穴があれば同時に塞ぐ」に従い同時修正・回帰テスト追加した。
  なお parser はセクション毎に手書き列挙する構造で、完全データ駆動化（単一真実源からの生成）は hotfix 範囲を
  超える中規模リファクタになるため見送った。将来 parser も同様の drift-guard 化を検討する余地あり（残課題）。
- **既存失敗テスト 2 件**（browser-source / broadcast-source）は本タスク範囲外・私の変更と無関係の pre-existing
  failure。修正はスコープ外のため未着手（クリーン HEAD で同一に落ちることを確認済み）。
- 未解決の質問なし。設計・純度境界に反する点は検出していない。
