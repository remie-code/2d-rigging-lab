# Editor Rebuild / Purge Policy

> 旧 `apps/editor` GUIを再利用対象ではなく削除対象として扱い、UX駆動でEditorを組み直すための方針。

## 1. 位置付け

この文書は、旧 `apps/editor` GUI / e2e / GUI由来ドキュメントが、以後のEditor再構築における判断根拠として混入することを防ぐための方針である。

これまでの画面設計discussionでは、Authoring Workspace、PSD Import Task、Toolbox、Inspector、Parameter Bar、Viewer / Runtime View、Texture Atlas Task、Dynamics、Variant / Expression Managerなどの目標UXを整理した。一方、既存 `apps/editor` GUIはその目標UXと乖離しており、既存資産を残すほど後続実装者の認識を汚染するリスクが高い。

したがって、以後のEditor再構築では、旧GUIの「再利用可能性調査」を原則として行わない。必要なものは、合意済みUX仕様、AC、プロダクト方針、Codex-facing automation方針から作り直す。

## 2. 採用方針

### 2.1 旧 `apps/editor` は削除対象

`apps/editor` は、GUI Editorとしては削除対象とする。

削除は単独で行わず、同じ作業単位で次を実施する。

- GUI削除後に成立する headless baseline を定義する。
- `build` / `typecheck` / `check` / scripts / workspace 設定から旧Editor GUI参照を外す。
- 旧e2e、focused e2e、testid系GUI検証を標準検証から外す。
- 新Editor実装の最初のUX単位を、合意済み画面設計から作る。

### 2.2 旧GUI由来の事実抽出は原則しない

旧 `apps/editor` から「使える事実」を抽出することも、原則として避ける。

理由は、抽出した事実が将来の実装者や圧縮後コンテキストに残り、旧GUI前提を再導入する汚染源になり得るためである。

ただし、削除作業に必要な機械的依存確認だけは許可する。例:

- package scriptが旧Editorを参照しているか。
- tsconfig / workspace / build targetが旧Editorを含んでいるか。
- 標準checkが旧e2eや旧GUI testに依存しているか。

この確認は「再利用判断」ではなく「削除のための参照切断確認」である。

## 3. 削除対象カテゴリ

次は削除または標準経路からの完全除外対象である。

| カテゴリ | 方針 | 理由 |
|---|---|---|
| 旧 `apps/editor` GUI実装 | 削除 | UX駆動再構築の認識汚染源 |
| 旧 `apps/editor` e2e | 削除 | 旧GUI挙動を正として固定する |
| focused e2e registry / Wave42系GUI境界 | 削除または標準checkから除外 | 新GUIの正を旧testid/e2eで拘束しない |
| production `data-testid` guard | 削除または新方針まで無効化 | 旧GUI構造を温存する圧力になる |
| 旧GUI詳細を列挙したinventory / report | 削除またはSuperseded隔離 | 後続agentが旧GUIを参照する入口になる |
| Wave51以降の旧GUI改善計画・成果物 | Superseded扱い | `apps/editor`削除方針と矛盾する |

## 4. 保持対象カテゴリ

保持対象は、旧GUI由来ではなく、プロダクトの正を定義する文書・契約に限定する。

| カテゴリ | 方針 | 備考 |
|---|---|---|
| concept / AC / scenarios | 保持 | プロダクトの正 |
| `discussion/design/screen-design/` の目標UX仕様 | 保持 | 旧実装説明ではなく、ユーザーと合意したあるべき画面設計 |
| Codex-friendly automation policy | 保持 | Editorは提案・意味推定を持たず、外部LLMがdeterministic APIを操作する方針 |
| packages側のロジック / contract | 保持候補 | GUI削除と独立して検証できるものに限る |
| operation API / ai-interface | 保持候補 | Codex-facing surfaceの中核。ただしGUI経由の実装詳細は保持しない |

保持候補は「既存コードを守る」対象ではない。新UXに必要なら、headless contractとして再定義し、必要な範囲で再実装する。

## 5. 初期再構築UX

最初に作るUX単位は、特定機能の完成ではなく、ユーザーが起動直後に目にする新Editorの画面骨格である。

各機能は、この段階では未実装のplaceholderでよい。重要なのは、旧GUIのpanel stackやdebug/evidence-heavy surfaceを一切見せず、今後の機能がどこに現れるかを人間が理解できる画面構成を先に固定することである。

```text
起動直後
  -> Primary Workspace Shell
      -> App Bar
      -> Toolbox
      -> Parts / Structure Tree
      -> Canvas / Preview
      -> Inspector
      -> Parameter Bar
      -> Task / View placeholder entry points
```

この初期UXの目的は、次を確立することである。

- 旧GUIに依存しない新Editorの画面骨格。
- 人間向けPrimary UIとCodex-facing operation/APIの境界。
- Toolbox、Workspace、Task Window、dedicated view、Inspectorの基本関係。
- PSD Import、Mesh、Rig、Parameter、Atlas、Dynamics、Viewerなどが今後どこから開かれるかの視覚的な見取り図。

## 6. Headless Baseline

`apps/editor`削除と同じ計画で、最低限次を定義する。

ここでいう headless baseline とは、GUI Editorが存在しない状態でも、リポジトリの中核ロジックが壊れていないことを確認するための非GUI検証基準である。

これは新しいGUIの代替ではない。旧GUI / 旧e2eを削除した後、後続実装者が「何を通せば、このリポジトリは健康だと言えるのか」を迷わないようにするための暫定的な標準である。

- GUIなしで通る標準 `check`。
- package-level tests。
- operation / model / PSD parser / command contractのheadless tests。
- 旧e2eを含まないCIまたはlocal verification path。
- 新GUIが存在しない期間でも、リポジトリ健康状態を示せるコマンド一覧。

このbaselineがないまま `apps/editor` だけ削除すると、以後の実装者が旧GUI復旧や旧e2e修復に引き戻される。

## 7. 関連ドキュメント方針

旧GUI前提のドキュメントは、以後のimplementation basisとして渡さない。

削除またはSuperseded隔離の対象:

- 旧GUIの詳細構造を説明するinventory。
- Wave51以降の旧GUI改善・migration・resetを正とするplan/report/review。
- 旧e2e / focused e2e / task window route / production testid を正とする検証文書。
- `_map.md` からの通常導線。

保持する文書:

- ユーザーと議論して定義した目標UX仕様。
- 旧GUIではなく、あるべき画面遷移・画面レイアウト・表示情報分類を記述した文書。
- Codex-friendly automation / operation API 方針。
- orchestration / planning / context protection の規約。

## 8. 決定事項と未決事項

Wave56計画前に確認済み:

1. `apps/editor` は完全に削除し、それとは別にUX駆動で再構築する。結果的に同名ディレクトリを使うことは許容する。
2. 旧GUI前提ドキュメントは物理削除する。汚染源をワークスペース内に残さない。
3. 初期再構築UXは、起動直後にユーザーが目にするAuthoring Workspace相当の画面骨格とする。機能本体はplaceholderでよい。
4. headless baselineは、GUI非依存unit tests、typecheck、標準scriptsから旧GUI/e2e参照が消えていることを最小基準にする。
