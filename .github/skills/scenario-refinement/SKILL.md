---
name: scenario-refinement
description: 'Acceptance Criteria の精緻化シナリオを作成・管理する。Phase 2 以降で AC 起草済みの項目を検証可能な具体ケースに落とし込む際に使用する。USE FOR: AC精緻化シナリオの作成、シナリオ管理ディレクトリの構造確認、テンプレート参照。'
---

# AC 精緻化シナリオの作成・管理

> Salamander が起草した Acceptance Criteria（オラクル）を、Undine が検証可能な具体シナリオに精緻化する際の運用規約。

## 前提: 順序原則

**シナリオ精緻化 → データモデル/I/F設計** の順序で進める。具体データ構造はシナリオ精緻化時点で定義しなくてよい。既に設計済みのデータ構造があればシナリオ内で参照できる。

## ディレクトリ構造

> 以下は配置例。カテゴリ（unit, progression, battle 等）はプロジェクトに応じて変わる。
> **scenarios/ は acceptance-criteria/ と同じディレクトリ構造（カテゴリ・ファイル名）をミラーする。**

```
discussion/
  acceptance-criteria/     ← Salamander 管理（オラクル・不可侵）
    _map.md
    <category>/
      <subsystem>.md
  scenarios/               ← Undine 管理（精緻化シナリオ）
    _map.md                ← シナリオ全体地図
    <category>/            ← acceptance-criteria/ と同じ構造
      <subsystem>.md       ← 対応する AC ファイルと同名
```

### オーナーシップ

| ディレクトリ | 管理者 | 操作権限 |
|-------------|--------|---------|
| `acceptance-criteria/` | Salamander | 起草・更新は Salamander のみ。Undine/Gnome は参照のみ |
| `scenarios/` | Undine | 精緻化シナリオの作成・更新。Gnome/Sylph は参照のみ |

AC に追加・変更が必要な場合は Salamander セッションを再開して行う。

## シナリオファイルのテンプレート

```markdown
# シナリオ: {サブシステム名}

> 参照元AC: [{ファイル名}](../acceptance-criteria/{層}/{ファイル名}.md)

## SC-{ID}: {シナリオタイトル}

### 前提条件
- {初期状態の記述}

### 操作列
1. {操作ステップ}
2. {操作ステップ}

### 期待結果
- {検証可能な期待結果}

### 検証するACの項目
- AC#{番号}: {対応するACの要約}
```

### テンプレートの原則

1. **Given-When-Then 形式**: 前提条件→操作列→期待結果
2. **粒度**: 1シナリオで1つの振る舞いを検証。複数AC項目がまとまる場合もあるが、1シナリオ1関心事が基本
3. **データ具体性**: 原作FFT の具体名（ブロードソード、イグーロス等）を使ってよい。抽象表現より直感的に正誤が判断できる
4. **AC項目への逆リンク**: 各シナリオがどのAC項目を検証するか明記する
