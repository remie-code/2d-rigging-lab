# C6 ホットフィックス Domain F レビュー — Physiology Speech セクション bridge 検証欠落バグ

レビュー実施者: **Review-Sylph**（風の精霊・レビュー担当、別コンテキスト）。Orch-Sylph からのサブエージェント委任として実施。読み取り専任（検証コマンドの実行のみ実施、ソース無変更）。
起点 HEAD=ed49b5d、feature/2d-rigging-eco-system。

## 1. 総合判定

**approve**（承認）。

主修正・第二の穴の同時修正・再発防止テストいずれも設計意図どおりに機能しており、blocking な問題は検出しませんでした。drift-guard はトートロジーではなく本物、e2e は修正前に落ちる形、store round-trip は第二の穴を実際にガードしています。契約型定義・golden・lockfile 無変更、純度境界も維持。non-blocking の観察を数点 §5 に記載します。

## 2. 観点別所見

### A. 修正の正しさ（spec 適合）— 合格

- **validation.ts の網羅Record導出**（`physiology-bridge-request-validation.ts:18-31`）: `PHYSIOLOGY_SECTION_ID_PRESENCE: Readonly<Record<PhysiologySectionId, true>>` が contract union でキーされ、6セクション（blink/gaze/head/posture/speech/stagePresence）を網羅リテラルで持つ。`PHYSIOLOGY_SECTION_ID_WHITELIST = new Set(Object.keys(...))` として派生し、`readSection`（74行）が `.has(value)` で判定。**speech は実際に白名単に入り readSection を通る**（型チェックと単体テストで実証、後述）。union に将来セクションを足してこの Record へ追記し忘れると TypeScript が "Property 'xxx' is missing" でコンパイル拒否する構造は主張どおり成立。旧来の `new Set<PhysiologySectionId>([...])` が要素型のみ強制し網羅を強制しなかった穴（＝今回のバグ根源）を構造的に封じている。
- **parser.ts の speech パース追加**（`physiology-profiles/physiology-profile-parser.ts:137-142, 153`）: `parseNumericFamily(value.speech, PHYSIOLOGY_SPEECH_TONE_FIELDS, "speech", ...)` を他の numeric セクション（blink/gaze/head/posture）と**完全対称**に追加し、返却オブジェクトに `...(speech === undefined ? {} : { speech })` で合流。保存経路（`physiology-state.ts createProfileSnapshot` が overrides 全量書き出し）に対し、再読込で speech override が保持される形になった。修正前は `value.speech` を一切読まず黙って捨てていた（＝保存設定の無音喪失）。
- **穴の閉じ込め範囲**: `grep`（`PHYSIOLOGY_SECTION_IDS` / `.has(` / `.includes(` / "is not a known section"）で speech を知る/知らない他経路を追試。
  - `physiology-state.ts:30-37` の独立配列 `PHYSIOLOGY_SECTION_IDS` に speech あり（無変更、既に既知）。
  - `physiology-state.ts:414` のフィールド検証は `PHYSIOLOGY_SECTION_TONE_FIELDS[section].includes(field)` を使い、tone-config の網羅Record（speech 含む）に依存。
  - `physiology-bridge-handlers.ts` は独自 section 白名単を持たず validation 結果を素通し（handlers.test.ts の駆動で確認）。
  - バグは **validation 白名単の一点に限定**されており、state/tone-config/contract は元から speech を知っていた。この範囲判断は妥当。
- **純度境界**: 変更は main プロセスの検証層（validation）・パース層（parser）とテストのみ。`physiology-page.tsx` 等 renderer/UI は無変更（git 差分でも確認）。工学数字（ms/Hz/probability）が renderer に漏れる新経路は追加されていない。tone [0,1] のみが従来どおり境界を越える。

### B. テストの妥当性 — 合格

- **drift-guard**（`physiology-bridge-request-validation.test.ts:11-22`）は**本物**。両辺が独立した2つの真実源:
  - 左辺 `whitelisted` ← validation.ts の `PHYSIOLOGY_SECTION_ID_PRESENCE`（`Record<PhysiologySectionId, true>`）由来。
  - 右辺 `contractSections` ← tone-config の `PHYSIOLOGY_SECTION_TONE_FIELDS`（`Record<PhysiologySectionId, readonly string[]>`）のキー。
  - **同一配列を両辺に使うトートロジーではない**。両者は別ファイルの別 const であり、白名単が非網羅な手書き Set へ退行した場合（＝今回のバグパターンの再来）に突合が落ちて検出する。両 Record が同じ union で網羅強制されるためコンパイル段階でも二重に守られるが、ランタイム突合はコンパイルガードを外した退行を捕まえる残存価値を持つ。真実源の選択（contract 型に runtime const を足せない制約下で tone-config の網羅Record を代理に採用）も妥当。
- **e2e**（`physiology-bridge-handlers.test.ts:149-204`）は**修正前に落ちる形**。
  - speech 更新テスト: 実 state を bridge 経由で `{section:"speech", field:"articulation", tone:1}`（ページと同一 request 形）で駆動し、`result.result === "ok"`・`hasOverride===true`・`tones.articulation===1`・`getPhysiologyConfig().speech.articulationFloor === ARTICULATION_FLOOR_CRISP` を検証。同ファイル 248-262 の「unknown section → validation-error」テストが、readSection throw 時にハンドラが `validation-error` を返す経路を固定しており、**修正前の speech は同じ経路で validation-error になり `toBe("ok")` が落ちる**ことが裏付けられる。config seam（articulationFloor）到達まで貫通確認しており e2e として十分。
  - Reset テスト: speech 更新後 `resetSection {section:"speech"}` が `ok`・`hasOverride===false`・`articulation===DEFAULT_TONE` へ戻ることを検証。修正前は Reset Speech も同白名単で validation-error。
- **store round-trip**（`physiology-profiles/physiology-profile-store.test.ts:41-66`）: 既存 round-trip の保存 override に `speech:{articulation:0.85}` を追加し、reload 後の `overrides` が speech を含めて `toEqual` することを検証。parser が speech を落とすと reload 結果に speech が現れず**この突合が落ちる**（第二の穴の実効的な回帰ガード）。

### C. 検証の独立再実行 — 合格（Review-Sylph が実際に実行）

作業ディレクトリ `apps/runtime-player`。以下は Review-Sylph が本レビュー中に実行した実コマンドと実出力。

- **型チェック**: `pnpm run typecheck`（= `tsc --noEmit -p tsconfig.json`）
  → 出力エラーなし、`TYPECHECK_EXIT=0`（**exit 0**）。網羅Record ガード含め型エラー 0。
- **該当3ファイル**:
  `pnpm exec vitest run -c vitest.config.ts src/main/physiology-bridge-request-validation.test.ts src/main/physiology-bridge-handlers.test.ts src/main/physiology-profiles/physiology-profile-store.test.ts`
  → 実出力:
  ```
   ✓ src/main/physiology-bridge-request-validation.test.ts (4 tests) 4ms
   ✓ src/main/physiology-profiles/physiology-profile-store.test.ts (7 tests) 20ms
   ✓ src/main/physiology-bridge-handlers.test.ts (8 tests) 18ms
   Test Files  3 passed (3)
        Tests  19 passed (19)
  ```
  **19/19 passed**（Gnome の主張と一致）。
- **パッケージ全体**: `pnpm run test:unit`（= `vitest run -c vitest.config.ts`）
  → 実出力: `Test Files  2 failed | 138 passed (140)` / `Tests  2 failed | 923 passed (925)`。
  **2 failed | 923 passed**（Gnome の主張と一致）。

## 3. pre-existing failure 2件についての判断

失敗2件（Review-Sylph が明示的に file 名抽出）:
- `src/main/broadcast-source/browser-source-server.test.ts > ... serves current Runtime Export payload to authorized Browser Source clients`
- `src/stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`

両者の失敗内容は**期待オブジェクトに `effectiveDynamicsTuning: null` フィールドが欠けている**ことによる `toStrictEqual`/shape 不一致（実出力の diff に `+ "effectiveDynamicsTuning": null` が現れる）。これは **dynamics-tuning のレスポンス形拡張**に対しテスト側の期待が未更新であることが原因で、physiology の speech セクション（validation/parser）とは別サブシステム。

**判断: physiology 修正と無関係の pre-existing failure**。根拠は因果的不可能性 — 本 hotfix の差分は `physiology-bridge-request-validation.ts` と `physiology-profile-parser.ts`（＋各テスト）のみで、browser-source / broadcast-source のレスポンス形（`effectiveDynamicsTuning` 等）に一切触れていない。したがって physiology 差分がこれら2失敗を生む経路は存在しない。クリーン HEAD 再現は、この物理的無関係性が git 差分から明白なため未実施とした（Gnome はクリーン HEAD で同一に落ちると確認したと報告しており、その主張は差分の性質と整合する）。**追加調査は本 hotfix のスコープ外**として不要と判断（別途 dynamics-tuning レーンの既存テスト更新課題）。

## 4. blocking な問題

なし。

## 5. non-blocking な観察

- **drift-guard の残存価値の位置づけ（観察のみ）**: `PHYSIOLOGY_SECTION_ID_PRESENCE` と `PHYSIOLOGY_SECTION_TONE_FIELDS` はともに `Record<PhysiologySectionId, ...>` であり、union へセクションを足すと**両方がコンパイル段階で更新を強制される**。したがってランタイム drift-guard の主要価値は「白名単が将来また非網羅な手書き Set へ退行した場合の検出」に絞られる。これは今回のバグパターンそのものの再来を捕まえるため正当な価値であり、テストとして残す判断は妥当。トートロジー懸念なし。
- **parser の構造（残課題、Gnome も自己申告済み）**: `parseToneOverrides` はセクション毎に手書き列挙する構造で、単一真実源からのデータ駆動生成にはなっていない。今回 speech を対称追加して穴は塞いだが、将来セクション追加時に parser への追記漏れは（validation と違い）コンパイルで捕まらない。完全データ駆動化は hotfix 範囲超の中規模リファクタのため見送り妥当。将来 parser も drift-guard 化を検討する余地あり（残課題として記録）。

## 6. 純度境界・契約無変更の確認結果

- **契約型定義**: `git status --porcelain` / `git diff --stat` で `apps/runtime-player/src/preload/physiology-bridge-contract.ts` は変更対象に現れず（無変更）。validation は `PhysiologySectionId` を型 import で参照するのみ。
- **変更ファイル**（`git diff --stat` 実出力、Review-Sylph 確認）: 追跡済み4ファイル（handlers.test.ts / physiology-bridge-request-validation.ts / physiology-profile-parser.ts / physiology-profile-store.test.ts、`4 files changed, 103 insertions(+), 9 deletions(-)`）＋ 新規 `physiology-bridge-request-validation.test.ts`（untracked）＋ 本レビュー・完了報告 md。golden / lockfile は変更対象に現れず（無変更）。
- **純度境界**: renderer/UI（`physiology-page.tsx` 等）無変更。工学数字が renderer に漏れる新経路なし。

## 7. 質問（判断に迷う点）

- なし。本 hotfix の範囲・修正・テストいずれも設計意図と整合し、blocking な疑義は残っていません。pre-existing failure 2件は dynamics-tuning レーン側の課題であり、本ドメインの承認可否には影響しないと判断しました（もし Orch-Sylph が dynamics-tuning テスト形の更新を別途トラッキングしたい場合は別レーン起票が妥当）。
