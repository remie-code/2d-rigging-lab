# Wave 109 Plan: Atlas uvRect Preflight Reconcile(Runtime Export preflight を Wave108 契約へ整合)

> Wave108(boundary-transparent-margin)で placement の `uvRect` は「ラスタ全体(contentRect)」から「contentInset を折り込んだ content サブ矩形」へ意味が変わった。packing・materialization・editor atlasRuntime は新契約に揃ったが、Runtime Export preflight の検証関数 `doesUvRectMatchContentRect` だけが旧契約(uvRect == contentRect)のまま取り残され、inset 非ゼロの placement 全件が `runtimeExport.invalidPlacementData`(reason=`uv rect does not match content rect`)で偽ブロックされる。本 wave はこの reconcile 漏れを閉じ、期待値導出の二重実装を共有ヘルパーで構造的に封じる。

## 1. Status

- Status: Approved / ready for orchestration(ユーザー承認 2026-07-14)
- Target wave: Wave109
- Wave name: `atlas-uvrect-preflight-reconcile`
- Primary objective:
  - `doesUvRectMatchContentRect` を新契約(uvRect = contentRect を contentInset で内側に縮めた content サブ矩形)へ更新
  - content サブ矩形の導出を共有ヘルパーへ抽出し、packing と preflight 検証の両方が同一関数を使う(再乖離の構造的封じ)
  - 非ゼロ inset の回帰テスト追加

## 2. Planning Gate Result

Planning Gate result: `Proceed`。

- 事実調査は L0 直轄で完了済み(数値で確定):
  - 書き込み側 `createTextureAtlasPlacement`(`packages/authoring-core/src/texture-atlas-packing.ts:525-593`)は `uvRect` を inset 適用後の `contentUvRect` から算出。
  - 検証側 `doesUvRectMatchContentRect`(`packages/authoring-core/src/runtime-export-assembly.ts:786-805`)は inset を考慮せず `contentRectPixels` そのままとの一致を許容差 `1e-9` で要求。
  - 実データ検証(claude-chan `C:\workspace\remie\rigging\claude-chan\workspace`): 4096x4096 ページ・placement 33 件**全件**がこの条件で落ちる。uvRect のズレから逆算した inset(片側 5〜17px)が元テクスチャ entry の `contentInset` と完全一致(例: topwear = 17px)。他の検証条件は全て通る。
  - `TextureAtlasPlacementSchema`(`packages/package-format/src/texture-atlas.ts:122-139`)に `contentInset` は無い。ただし検証関数は session を持ち、packing が使った inset の出所(元テクスチャ entry の `contentInset`)へ `placement.originalTextureId` 経由で到達できるため**スキーマ拡張は不要**。
  - 鮮度懸念(commit 後の texprep やり直しで inset が変わるケース)は、専用ブロッカー `runtimeExport.staleAtlas`(sourceSignature に contentHash が入る。`runtime-export-assembly.ts:225-232`)が必ず併発するため、本修正が単独で偽ブロッカーを出す経路は無い。
- Uncertainty: factual **low**(実データで数値確定)/ decision **low**(方針承認済み・候補比較済み)/ cost of wrong plan **low**(単一関数 + ヘルパー抽出 + テスト。export 本体・スキーマ不変)。

## 3. Accepted Decisions / Oracles

### 3.1 設計の正(オラクル)

- **[../../design/mesh-rendering/boundary-transparent-margin-design.md](../../design/mesh-rendering/boundary-transparent-margin-design.md)** — 「uvRect = content サブ矩形が単一の真実。消費側で再 inset しない」(§3.1/§4)。
- Wave108 実装マップ [../waves/wave108/_map.md](../waves/wave108/_map.md) — 契約の要約と Residual(content-inset スキーマ三重化の集約は**後続**。本 wave では触らない)。
- 本計画 §2 の調査事実(検証側だけが旧契約、が数値で確定済み)。

### 3.2 採用した修正方針(候補比較済み・ユーザー承認)

1. 検証側の期待値を「`contentRectPixels` を元テクスチャ entry の `contentInset`(無ければ zero)で内側に縮めた矩形」から算出する。**placement スキーマは拡張しない**。
2. contentRect + inset + ページ寸法 → contentUvRect(正規化 uvRect)の導出を共有ヘルパーに抽出し、packing(`createTextureAtlasPlacement`)と検証(`doesUvRectMatchContentRect`)の両方が使う。同一関数なら浮動小数演算も同一で、許容差 `1e-9` はそのまま生きる。
3. 却下済み候補: 包含チェックへの緩和(検証力を弱め将来の書き込み側バグを素通しにする)・packing 側 revert(設計意図に反する)。

### 3.3 Model Allocation

Orch-Sylph・Gnome・Review-Sylph = **opus = Opus 4.8(`claude-opus-4-8`)**(`Agent` 呼び出しで `model: "opus"` 明示必須。無指定は親モデル継承の罠)。L0 = 本セッションの Undine。

## 4. Wave Strategy

```text
Batch 1(単一ドメイン):
  Domain A (D-preflight): uvRect preflight 検証の新契約整合 + 共有ヘルパー抽出 + 回帰テスト
```

依存する他ドメイン無し。Orch-Sylph は SKILL.md の分離規則に従う(Orch 自身は実装しない / Gnome 実装 / Review-Sylph レビュー / 在席ポーリング / ループ上限5 / ユーザー判断が要る設計漏れ検出時は早期脱出)。

## 5. Domain A: uvRect preflight 検証の新契約整合(`D-preflight`)

Domain id: `wave109-uvrect-preflight-reconcile`

Allowed write scope:
- `packages/authoring-core/src/runtime-export-assembly.ts`(`doesUvRectMatchContentRect` と、inset 解決のための texture entry 参照配線)
- `packages/authoring-core/src/texture-atlas-packing.ts`(`createTextureAtlasPlacement` の contentUvRect 導出を共有ヘルパー呼び出しへ置換)
- 共有ヘルパーの新規ファイル(authoring-core 内。例: `packages/authoring-core/src/texture-atlas-content-rect.ts`。既存モジュールへの同居も可 — Orch 裁量。ただし packing と assembly の双方から import される単一実装であること)
- 対応テスト: `packages/authoring-core/src/runtime-export-assembly.test.ts`、`packages/authoring-core/src/texture-atlas-packing.test.ts`、ヘルパー単体テスト
- Domain report / review(`discussion/implementation/waves/wave109/`、`discussion/implementation/reviews/wave109/`)

Forbidden write scope:
- `packages/package-format`(スキーマ不変。placement への contentInset 追加はしない)
- texprep・生成器・レンダラ・`runtime-export-materialization.ts`(写像本体)・editor UI
- Wave108 Residual ①(content-inset スキーマ三重化)の集約に着手しない

Required implementation:
1. 共有ヘルパー: `(contentRectPixels, contentInset, pageWidth, pageHeight) → uvRect(topLeft/bottomRight 正規化)` の導出を単一実装として抽出。inset 未指定は zero inset(旧 `ZERO_CONTENT_INSET` の意味論を継承)。根拠コメントに設計文書 §3.1/§4 と「packing と preflight 検証が同一関数を共有し再乖離を封じる」趣旨を残す。
2. `createTextureAtlasPlacement` の contentUvRect / uvRect 算出をヘルパー呼び出しへ置換(**出力値は完全不変**であること — 既存テストが退行検知)。
3. `doesUvRectMatchContentRect` の期待値をヘルパーで算出。inset は `placement.originalTextureId` → session の texture entry → `contentInset ?? zero` で解決。entry が見つからない場合の扱いは「zero inset として照合」(entry 欠落自体は既存の他ブロッカー系の責務)とし、判断に迷いがあれば escalate。
4. `nearlyEqual` 許容差 `1e-9` は据え置き。

Required tests:
- 非ゼロ inset(実データ相当: 4096 ページ・inset 17px 等)の placement が検証を**通る**こと(修正前は落ちるケース)。
- inset を無視した誤 uvRect(旧契約の値)が検証で**落ちる**こと(検証力の維持)。
- zero inset / inset 無し texture の従来ケースが無退行であること。
- packing 側の uvRect 出力がヘルパー置換前後で厳密一致すること(既存テストの green で担保。必要なら数値固定ケースを追加)。

Review focus:
- 導出が本当に単一実装か(packing と検証に別式が残っていないか)。
- 検証の期待値の出所が「commit 済みデータ(placement + texture entry)」であり、揮発状態に依存していないか。
- 検証力が緩和されていないか(包含チェック化・許容差拡大が紛れ込んでいないか)。
- Forbidden scope(スキーマ・materialization)へ触れていないか。

## 6. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の規則に従う(役割/呼び出し元の散文明示 / 実装は Gnome / レビューは Review-Sylph / 在席ポーリングで子を待つ / model 明示 / 孤児を残さない / ループ上限5 / 早期脱出=ユーザー判断が要る設計漏れ検出時)。
- 環境操作(pnpm install 等)は L1 以下で禁止。回避工作も禁止。必要が生じたら escalate。
- 設計文書に無い判断分岐は実装で埋めず escalate(L0 が裁定)。

## 7. Verification Plan

Minimum focused verification:
- `pnpm.cmd exec vitest run packages/authoring-core/src`
- `pnpm.cmd typecheck`

Preferred final verification:
- `pnpm.cmd exec vitest run packages`(authoring-core 外への波及が無いことの確認)

環境都合で preferred を省く場合、domain report にスキップしたコマンドと理由を明記する。

## 8. Residual Risks

- **staleAtlas との併発報告**: commit 後に texprep をやり直した stale 状態では、本検証と `staleAtlas` が同時に出る(invalidPlacementData の文言単体ではやや誤誘導だが、staleAtlas が真因を示すため許容)。domain report に注記として残す。
- **content-inset スキーマ三重化**(Wave108 Residual ①)は本 wave では据置き。ヘルパーの型参照が三重化のどれに依存するかは report に記録。

## 9. Completion Criteria

Wave 109 is complete when:
- `doesUvRectMatchContentRect` が新契約で照合し、非ゼロ inset の回帰テストを含む focused テスト + typecheck が green。
- packing と検証が同一の共有ヘルパーを使い、期待値導出の二重実装が消えている。
- Review-Sylph の clean review が blocking を出さない、または全て解消。
- domain report / review report が所定パスに永続化されている。
- **コミットは未実施(wave gate = ユーザー統制点)**。
- **ユーザー gate(wave 外)**: claude-chan(`C:\workspace\remie\rigging\claude-chan\workspace`)で Runtime Export の preflight が blocked にならず export が通ることを実機確認。
