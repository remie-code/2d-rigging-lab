# Expo / research archives map update report

基準点: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。
`map-update-contract.md`、`51-expo-and-research-archives.md`、`62-cross-topic-integration.md`、`90-root-map-integration.md` を先に読み、Expo 子 map → Expo 親 map → reports archive map の順で更新した。`apply_patch` のみを使用し、stage/commit は行っていない。

## 1. 所有範囲で確認した map

- `discussion/expo/_map.md`
- `discussion/expo/genai-expo-2026/_map.md`
- `discussion/reports/_map.md`（契約上の除外、基準点確認のみ）
- `discussion/reports/cmo3-moc3-format-spec/_map.md`
- `discussion/reports/cubism-sdk-runtime-structure/_map.md`
- `discussion/reports/deformer-structure-technology/_map.md`
- `discussion/reports/editor-render-performance/_map.md`（契約上の除外、変更なし）
- `discussion/reports/psd-import-fidelity/_map.md`
- `discussion/reports/rights-risk-cleanup/_map.md`（現行の権利入口として確認、変更なし）
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md`
- `discussion/reports/viewer-preview-reference/_map.md`

## 2. 変更した map

### Expo

- `discussion/expo/_map.md`
  - 「版面は未着手」を削除し、6 面 HTML + 6 面 A2 PDF 完成へ更新。
  - 採択待ちは「作業場記録／個別結果は外部未検証」と明示。
  - 採択後の実寸試し刷りと、公開前の権利・スコープ確認を停止条件として保持。
- `discussion/expo/genai-expo-2026/_map.md`
  - 6 面 HTML / 6 面 A2・1ページ PDF の揃いを明記。
  - 採択状態を repo 記録と公式公開情報の未検証に分離。
  - 採択通知後の実寸試し刷り（③約64dpi、②88dpi）を次 action として維持。
  - 公開前の権利・スコープ確認を別ゲートとして残し、`discussion/expo.zip` は目的不明・成果物数外と明記。
  - `poster-design.md` の制作前ヘッダーは非 map の歴史的スナップショットとして索引上で注記（本文は契約上変更していない）。

### Archive / current-owner boundary

- `discussion/reports/cmo3-moc3-format-spec/_map.md`
  - private research archive / superseded exclusion を維持し、module-boundaries と rights-risk-cleanup への current-owner 導線を追加。
  - 将来再開の permission / legal / scope review を「歴史的未決（現行作業ではない）」として明示。
- `discussion/reports/cubism-sdk-runtime-structure/_map.md`
  - `Historical evidence index` を明示。
  - 基準点に存在しない `experiments/cubism-web-moc3-inspector/` と再検証不能性を注記。
  - module boundaries、runtime contract、rights-risk-cleanup への current-owner 導線を追加。
  - SDK差分確認を未来作業に昇格させず、permission / legal / scope review 前提の歴史的未決へ移動。
- `discussion/reports/deformer-structure-technology/_map.md`
  - historical evidence index と current runtime/module contract 導線を追加。
  - 過去の `bilinear-grid-v1` / pivot affine の暫定合意を歴史的候補として残し、現行 `rotation2d` / `warpLattice2d` は runtime-core contract を正と明記。
  - 設計統合・追加補間検討を現行 next action にせず、変更提案時の別 review に限定。
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md`
  - historical evidence index と runtime-core / MVP vertical-slice / rights 導線を追加。
  - 評価 pipeline・snapshot・unsupported layer の旧判断待ちを accepted runtime contract 反映済みとして現行作業から外した。
- `discussion/reports/viewer-preview-reference/_map.md`
  - historical evidence index と MVP vertical-slice / runtime-core / rights 導線を追加。
  - Preview/Viewer/Shared Runtime の旧設計統合待ちを反映済みとし、Cubism Viewer 相当機能を再検討する場合は permission / legal / scope review を先行する旨を保持。
- `discussion/reports/psd-import-fidelity/_map.md`
  - H1 診断は維持し、`8640d12` の `contentInset` / `rasterDimensions` carry と UV remap を修正済みの現行実装として索引。
  - source、package contract、rights map への current-owner 導線を追加。
  - 旧「修正候補・設計待ち」は再発時検証へ限定し、現行未完了タスクにはしない。

## 3. 意図的に変更しなかった map

- `discussion/reports/_map.md` — 契約で除外。親 map の統合は後続 owner (`123-reports-parent-update.md`)。
- `discussion/reports/editor-render-performance/_map.md` — 契約で除外。静的診断の historical boundary は保持。
- `discussion/reports/rights-risk-cleanup/_map.md` — 現行の legal/scope 入口として既に有効。Cubism 非互換・公開前確認を変更せず保持。

`discussion/reports/map-freshness-audit/**` の監査 map は契約上の作業基盤として変更していない。

## 4. 置換した主張と根拠

| Claim | Replacement truth / evidence |
|---|---|
| Expo 親 map は「版面未着手」 | 6 HTML + 6 PDF、各 A2 1ページ。`51-expo-and-research-archives.md` §3.1（HTML/PDF列挙、CSS、MediaBox、基準点 commit） |
| Expo 採択待ちを外部事実として扱える | 作業場記録として保持するが公式ページは個別採択を掲載しない。`51-expo-and-research-archives.md` §3.2、`62-cross-topic-integration.md` §7 gate 19 |
| Cubism SDK inspector / SDK差分確認を現行 next action にできる | 実験ディレクトリは基準点に無く、Cubism exclusion が現行正。`51-expo-and-research-archives.md` §4.3、`62-cross-topic-integration.md` §7 gate 20 |
| Deformer/runtime/viewer の旧判断待ちが現行未決 | accepted project-defined contracts（runtime-core、MVP vertical-slice）へ反映済み。`51-expo-and-research-archives.md` §4.3 |
| PSD remap は着手候補 | commit `8640d12` で `canvas-projection.ts` / `canvas-render-scene-adapter.ts` に実装済み。`51-expo-and-research-archives.md` §4.4 |

## 5. 保持した決定・ゲート

- Private baseline、4 tracks、Editor mainline stop at Wave102 は変更していない。
- Cubism SDK/Core、`.cmo3` / `.moc3` / Cubism Viewer 互換を採らない legal/scope 境界を archive map 全体で保持した。
- Expo の採択通知は外部未検証のまま。採択後の実寸試し刷りを未完了 gate として保持した。
- Cubism inspector や archived experiment の再開には別 permission / legal / scope review が必要という gate を保持した。
- 既存 untracked `discussion/expo.zip` の存在・目的・成果物数への算入について推測・変更していない。

## 6. 検証

- 相対 Markdown link 検査（変更 map 8 件 + unchanged rights map）: `checked=67 missing=0`。
- `git diff --check -- discussion/expo discussion/reports/cmo3-moc3-format-spec discussion/reports/cubism-sdk-runtime-structure discussion/reports/deformer-structure-technology discussion/reports/psd-import-fidelity discussion/reports/runtime-evaluation-semantics-reference discussion/reports/viewer-preview-reference`: whitespace error なし（CRLF warning のみ）。
- `git diff --stat`: 8 map、104 insertions、46 deletions。非 map の source/design/report 本文、`reports/_map.md`、`editor-render-performance/_map.md` は変更していない。

## 7. 所有範囲外の残件

- `discussion/reports/_map.md` の archive/current performance/PSD 親行は `123-reports-parent-update.md` の統合対象。
- `discussion/_map.md` の Expo/archive 行は child-first 完了後に root owner (`140-root-map-update.md`) が更新する。
- Expo の個別採択通知、実寸試し刷り、公開素材の最終権利確認は外部状態・ユーザー判断であり、この map 更新では確定できない。
- `poster-design.md` の「版面の実制作は未着手」というヘッダーは非 map の historical text として残置した（契約上、今回の変更範囲外）。
