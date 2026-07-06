# ディスカッション規約

> discussion/ 配下の外部記憶、トピック構造、命名、地図、所有権に関する合意事項。

## 1. 目的

`discussion/` は、Private 2D Rigging Lab / Prototype のコンセプト、設計、AC、シナリオ、調査、検証の議論を、将来のセッションや別エージェントが復元できる形で保存するための外部記憶である。

チャット履歴に依存せず、次に読むべき文書、決まったこと、未決事項、根拠を把握できることを重視する。

## 2. 基本構造

`discussion/` 直下には、議論の主題ごとにトピックディレクトリを置く。

```text
discussion/
  _conventions.md       # 本ファイル。discussion/ 全体の規約
  _map.md               # discussion/ 全体の地図
  concept/              # コンセプト、スコープ、方針変更メモ
    _map.md
    *.md
  design/               # 設計論点、設計判断、未決事項、設計検証観点
    _map.md
    *.md
  acceptance-criteria/  # Salamander が起草し、ユーザー合意で更新されるAC体系
    _map.md
    02_DomainAcceptanceCriteria/
      _map.md
      *.md
  scenarios/            # Undine がACを精緻化した検証シナリオ
    _map.md
    02_DomainAcceptanceCriteria/
      _map.md
      *.md
  demo/                 # Streaming Demo Surfaceの表示範囲、preflight、disclaimer
    _map.md
    *.md
  proposal/             # Live2D Feature Proposalのテンプレート、提案draft
    _map.md
    *.md
  development_convention/ # P0/P1開発規約、/goalオーケストレーション規約、basis、review
    _map.md
    *.md
    basis/
    review/
  implementation/       # 実装オーケストレーション、wave計画、review、completion、integration
    _map.md
    orchestration/
    reviews/
    waves/
  runtime-player/       # Editor外のRuntime Player / Capture Host appの調査、UX、設計
    _map.md
    architecture/
    backlog/
    implementation/
    research/
    screens/
  model-authoring/      # LLM(Fable)によるモデル制作挑戦。前提合意、閉問題、調査事実、制作定石
    _map.md
    premises/
    closed-problems/
    research/
    craft/
  mesh-generation/      # メッシュ自動生成の商用風改修(v7)。概念設計、現状調査、実装、品質評価、v6系整理
    _map.md
    *.md
    implementation/     # 実装フェーズ開始時に作成。wave計画・実装報告・レビューをトピック内に閉じる
  reports/              # 技術調査・成立性調査レポート。Cubism関連はprivate research archive扱い
    _map.md
    <research-topic>/
      _map.md
      *.md
```

トピック内のドメインや対象が大きくなる場合は、さらに子ディレクトリを作ってよい。

例:

```text
discussion/
  acceptance-criteria/
    02_DomainAcceptanceCriteria/
  scenarios/
    02_DomainAcceptanceCriteria/
```

## 3. マップファイル

書き物を置く各ディレクトリ階層には、原則として `_map.md` を配置する。

`_map.md` は本文を詰め込む場所ではなく、その階層の直下にあるファイル・ディレクトリの一覧、状態、リンク、次に読むべき文書を示す軽量な地図である。

下層ディレクトリの詳細は、そのディレクトリ内の `_map.md` に委譲する。親階層の `_map.md` は、子ディレクトリ内の個別ファイル一覧や詳細状態を再掲しない。

各 `_map.md` には、必要に応じて以下を置く。

- この階層の役割
- 直下のファイルまたは子ディレクトリの一覧
- 各議論・成果物の状態
- 主要リンク
- 次の作業候補
- 未決事項

状態は必要十分な粒度で記録する。例: `Draft`, `In discussion`, `Accepted`, `Needs review`, `Blocked`, `Superseded`。

## 4. トピックと所有権

| Path | Role | Owner | Notes |
|---|---|---|---|
| `concept/` | プロジェクトのコンセプト、スコープ、方針変更、未決の根本問い | Undine | ユーザー合意に基づき更新する |
| `design/` | Private 2D Rigging Lab / Prototype の設計論点、設計判断、未決事項、調査待ち、検証観点 | Undine / Gnome / Sylph | Undine が議論と地図を管理し、Gnome/Sylph が実装・レビュー時に参照する |
| `acceptance-criteria/` | 受け入れ基準。後続作業のオラクル | Salamander / Undine | 原則はSalamander起草。ユーザーの明示指示がある場合はUndineが再編・更新する |
| `scenarios/` | ACを検証可能な具体シナリオへ精緻化したもの | Undine | Gnome/Sylph は原則参照のみ |
| `demo/` | Streaming Demo Surfaceで見せてよい範囲、避けるもの、preflight、disclaimer | Undine | Private Prototype本体から分離して管理する |
| `proposal/` | Live2D Feature Proposalのテンプレート、提案draft、非目標 | Undine | 互換実装、形式対応、SDK/Core代替を示唆しない |
| `development_convention/` | P0/P1開発規約、/goal実装オーケストレーション規約、basis、review | Undine / Orch-Sylph / Gnome / Review-Sylph / Integrator | L0用の薄いorchestration contractとdomain agent向け詳細規約を分離して管理する |
| `implementation/` | 実装オーケストレーション、wave計画、domain completion、review、integration、final report | Undine / Orch-Sylph / Gnome / Review-Sylph / Integrator | Accepted development conventionに従い、実装証拠とレビュー成果物を永続化する |
| `runtime-player/` | Editorが出力したRuntime Exportを読む外部Runtime Player / Capture Host appの調査、UX、設計、未決事項 | Undine / Sylph / Gnome | Editor本体と分離し、tracking input、runtime display、OBS想定、外部app境界を扱う |
| `model-authoring/` | LLM(Fable)が作者として2Dモデルを制作する挑戦の前提合意、閉問題定義と結果、制作定石 | Undine / ユーザー | [design/codex-friendly-automation-policy.md](design/codex-friendly-automation-policy.md) の後継トピック。実装waveが必要になった場合の置き場は未決 |
| `mesh-generation/` | メッシュ自動生成の商用風改修(v7)。概念設計、現状実装調査、実装計画、品質評価、v6系整理 | Undine / Sylph / Gnome | 実装成果物(wave計画等)はトピック内 `implementation/` に置く(runtime-player方式)。Editor実装(Wave102停止中)の部分的再開 |
| `reports/` | 技術調査、成立性調査、外部仕様・実装状況のレポート | Undine | 調査担当サブエージェントが作成し、Undine が統合・地図管理する |

新しいトピックが必要になった場合は、ユーザーと合意してからディレクトリを作り、この規約と関連 `_map.md` を更新する。

## 5. シナリオの配置

`scenarios/` は、原則として `acceptance-criteria/` と同じ構造をミラーする。

例:

```text
discussion/
  acceptance-criteria/
    02_DomainAcceptanceCriteria/
      204_Deformation_Control_Structure.md
  scenarios/
    02_DomainAcceptanceCriteria/
      204_Deformation_Control_Structure.md
```

シナリオは、ACをデータモデルやI/F設計に落とす前の検証可能な具体ケースとして書く。

各シナリオは次を含む。

- 前提条件
- 操作列
- 期待結果
- 検証するAC項目への逆リンク
- 必要に応じて参照した外部資料やリポジトリ事実

詳細な書式は [.github/skills/scenario-refinement/SKILL.md](../.github/skills/scenario-refinement/SKILL.md) を参照する。

## 6. 情報の分離

議論文書では、以下を混同しない。

- 公式事実: 外部公式資料に基づく情報
- リポジトリ事実: 現在のファイル、実装、テスト、ディレクトリ構造に基づく情報
- 仮説: まだ確認できていない推測
- 設計判断: ユーザーまたは担当エージェントが採用した方針
- 実験結果: 実際に試した手順と観測結果
- 未決事項: まだ決めていない論点

不確かな情報は、確定事項として書かない。

## 7. Demo and Proposal Hygiene

現在の正は、個人利用の Private 2D Rigging Lab / Prototype である。配信デモ、Live2Dへの機能提案、将来公開可能なsubsetは、private実装本体から分離して記述する。

- Live2D / Cubism の固有名詞は、過去調査、リスク説明、非互換・非依存の宣言、Live2Dへの提案資料の文脈に限定する。
- 本プロジェクトは Live2D Cubism 互換ツールではなく、同形式の読み書き、解析、変換、再構築を行わない。
- `.moc3`, `.cmo3`, `.model3.json`, `.motion3.json`, `.physics3.json`, `.pose3.json` は検査・読み込み・変換対象にしない。
- Cubism SDK/Core には依存しない。
- fixture / sample / demo は rights-clean な自作・生成・明示許諾素材のみを使い、既存Cubismモデル、公式サンプル、第三者Live2Dモデル、nizima素材を使わない。
- 配信デモでは、コード、内部形式、ファイル構造、Cubism形式名、SDK/Core連携、既存モデル読み込みを示唆する画面を出さない。
- 用語は `project-defined model package`, `rig control`, `drawable mesh`, `faceYaw`, `facePitch`, `layered-character-psd-profile-v1` など独自/一般語彙を優先する。
- `Private Prototype`, `Streaming Demo Surface`, `Live2D Feature Proposal`, `Future Public Clean Subset` の4トラックを混同しない。

## 8. Prose and Machine-Readable Naming

自然言語の説明文では `rig control` と書いてよい。ただし、enum value、check ID、fixture ID、test ID、target kind、file identifier、operation IDなどのmachine-readable identifierでは、空白を含めず `rigControl` を使う。

例:

- target kind: `"rigControl"`
- check ID: `rigControl.cycle`
- fixture ID: `invalid-rigControl-cycle`
- operation ID: `rigControl.rotation.create`

Machine-readable identifierでは、`rig<space>control`、`rig<space>control.cycle`、`invalid-rig<space>control-cycle` のような空白入り表記を禁止する。

Dynamics関連のmachine-readable identifierも、`dynamicsGroup`、`computedDynamics`、`scalarDampedFollowV1` を使う。

## 9. ファイル命名

- 既存ファイルの命名は、理由なく変更しない。
- 新規ファイルは、意味のある英語ケバブケースを基本とする。
- 既存トピックに連番規則がある場合は、それに従う。
- `_conventions.md` と `_map.md` のようなメタファイルには、先頭アンダースコアを使う。
- 日本語ファイル名は、既存文脈やユーザー指定がある場合に使用してよい。

## 10. 変更ルール

- `acceptance-criteria/` は後続作業のオラクルであるため、変更時は根拠となるコンセプト、設計判断、ユーザー合意を明示する。
- ACの追加・変更が必要な場合は、原則としてユーザー合意のうえで行う。
- 誤配置、明白な転記ミス、またはユーザーが明示した方針変更は、Undine が反映してよい。
- `scenarios/` は Undine が議論に基づいて作成・更新する。
- 規約や地図が現状に合わなくなった場合は、ユーザーと合意して `_conventions.md` と該当 `_map.md` を更新する。
