# Playwright E2E Oracle

> 状態: Accepted oracle。GUI再構築後のPlaywright E2Eが何を保証し、何を保証しないかを定義する。

## 1. 目的

Playwright E2Eは、ユーザーが実際に触る主要導線が通ることを確認するための最小限の疎通テストである。

E2Eを画面品質や内部ロジックの万能検査にしない。大きなUI変更時にE2E自体が負債化し、UX改善の足かせになることを避ける。

## 2. E2Eで確認するもの

- ユーザー操作の主要パスが通ること。
- 画面間またはmodalとworkspace間の状態反映が成立すること。
- ユーザーから見て、操作結果が次の主要領域へ反映されること。

PSD Importでの代表パス:

```text
empty Authoring Workspace
  -> Import PSDを開く
  -> fixture PSDを選択する
  -> Import Reviewが表示される
  -> 作成予定Parts構造が表示される
  -> Importする
  -> modalが閉じる
  -> WorkspaceのParts Treeにimport済み構造が表示される
  -> generated import root / part groupが選択される
```

Cancel pathを追加する場合も、確認するのは「modalを閉じる」「Workspace stateを変えない」までに留める。

## 3. E2Eで確認しないもの

- レイアウトの美しさ。
- 画面密度、余白、比率、視認性。
- ピクセル単位の位置やサイズ。
- visual regression screenshot。
- Canvas画像描画の正しさ。
- PSD parserの詳細正当性。
- structural scaffold DTOの全field。
- issue分類の網羅。
- tooltip全文。
- CSS classやDOM構造の細部。
- operation ID、evidence path、diagnostics詳細。
- internal store shape。

画面レイアウト、UXとして自然か、余計な情報が出ていないか、見た目の違和感は人間が確認する。

## 4. 他テストとの分担

| 層 | 責務 |
|---|---|
| Unit / headless tests | parser、operation、structural scaffold、validator、DTO変換、issue二値化などの内部正当性 |
| Component / focused tests | review row derivation、Issue badge表示、状態分岐などの局所UI |
| Playwright E2E | ユーザー操作の主要パスとworkspaceへの反映 |
| Human visual check | レイアウト、視認性、情報量、UXの自然さ |

Playwright E2Eはunit/headless testの代替ではない。逆に、unit/headless testで見るべき内部正当性をE2Eへ持ち込まない。

## 5. 運用方針

- E2E suiteは最初は1〜2本に絞る。
- root `check` へ無条件に統合しない。必要に応じて明示コマンドとして運用する。
- dev serverの起動停止はPlaywright configの `webServer` など、プロセス管理できる仕組みに任せる。
- 長時間起動しっぱなしのdev serverを前提にしない。
- screenshot assertionやpixel oracleを追加しない。
- fixture PSDは小さく、rights-cleanで、由来が明確なものに限定する。
- selectorは安定したaccessibility / role / label / controlled test hookを使ってよいが、人間向けUIをtest都合のdebug textで汚染しない。

## 6. PSD Import v0 E2Eの合格基準

最小合格基準:

- 起動直後にAuthoring Workspaceが表示される。
- `Import PSD` からPSD Import modalを開ける。
- fixture PSDを選択するとImport Reviewへ進む。
- Import Reviewに作成予定Parts構造が表示される。
- 画像previewはplaceholderでよい。
- `Import` 後にmodalが閉じる。
- WorkspaceのParts Treeにimport済み構造が表示される。
- generated import root / part groupが選択される。

非合格理由:

- E2Eがレイアウトやpixel差分を要求する。
- E2Eがraw diagnosticsやoperation evidenceを通常UIに要求する。
- E2EがPSD parser内部やDTO全fieldを検証しようとする。
- E2Eのためにユーザーに不要な表示を追加する。
