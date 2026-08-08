# Map Freshness Audit Contract

> 2026-08-08 に開始した `discussion/**/_map.md` 鮮度監査の共通契約。

## 1. 目的

`discussion/` の各 `_map.md` が、現在状態の入口、子成果物の索引、または歴史的証拠索引として正しいかを確認する。

調査結果はチャットだけに残さず、各 Sylph が `_map.md` で割り当てられた固有の Markdown ファイルへ保存する。

## 2. 監査基準点

- Git HEAD: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`
- 基準日: 2026-08-08 (Asia/Tokyo)
- 監査開始前から存在する worktree change:
  - Modified: `.codex/agents/gnome.toml`
  - Modified: `.codex/agents/sylph.toml`
  - Untracked: `.codex/skills/context-check/DESIGN.md`
  - Untracked: `.codex/skills/context-check/SKILL.md`
  - Untracked: `discussion/expo.zip`

上記はユーザー所有の既存変更として扱い、変更・削除・復元しない。

この監査のために追加される次の内容は、基準点における鮮度判定から除外する。

- `discussion/reports/_map.md` の `map-freshness-audit/` 登録行
- `discussion/reports/map-freshness-audit/**`

基準点の `discussion/reports/_map.md` を調べる場合は、必要に応じて `git show 3c3669e:discussion/reports/_map.md` を使う。

## 3. Map の種類

各 map を次のいずれかとして分類する。

1. `living-current-state`: 現在状態、次の行動、未決事項を示す map
2. `living-index`: 現在存在する子ディレクトリや成果物への入口 map
3. `historical-evidence-index`: 完了済み wave や過去調査の当時の証拠索引

歴史的 map は、後続作業が存在するだけでは stale としない。当時の状態、リンク、証拠の説明が誤っている場合だけ stale とする。

## 4. 判定

- `Current`
- `Partially stale`
- `Stale`
- `Intentionally historical`
- `Unverifiable`

## 5. 情報種別

以下を混同しない。

- 公式事実
- リポジトリ事実
- 仮説または推定
- 設計・方針決定
- 実験・検証結果
- 未決事項

リポジトリ事実は現行source、tests、設定、Git履歴で確認する。設計判断は Accepted 文書や記録されたユーザー決定を根拠にする。実験結果は実験・final report・reviewの観測として扱う。

## 6. 各 Sylph の必須出力

担当レポートには少なくとも次を含める。

1. 担当範囲と実際に確認した map 一覧
2. map ごとの種類と判定
3. stale または疑わしい記述の `file:line`
4. 現在の事実と根拠となる `file:line`、commit、または検証command
5. 情報種別の区別
6. 親 map へ反映すべき短い結論
7. 未解決事項とユーザー判断点
8. 調査できなかった範囲

正常な歴史的 map 群は範囲単位で集約してよい。ただし、確認対象となった map path の一覧は必ず残す。

## 7. 変更権限

各調査 Sylph が変更してよいのは、割り当てられた固有の出力ファイルだけである。

- 既存 map、source、tests、設定を変更しない。
- 他 Sylph の出力ファイルを変更しない。
- Git commit、stage、checkout、resetを行わない。
- 調査のためのread-only commandと、担当レポート作成だけを行う。

## 8. 統合順序

1. 機械監査と各ドメイン調査
2. Editor / Runtime Player / cross-topic 統合
3. root map 統合監査
4. 監査結果をユーザーへ報告
5. ユーザー合意後に、子 map から親 map の順で更新

監査中は既存 map を更新しない。
