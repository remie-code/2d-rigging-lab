# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-25: Open Source and Rights Hygiene

### 問い

Open Live2D Stack を Open Source として公開可能にするために、どの権利境界を守るべきか。

### AC-RIGHTS-001: 再配布できない資産を必須依存にしないこと

Open Live2D Stack は、Cubism SDK/Core、公式サンプル、商用モデルなど、再配布条件に制約がある資産を公開リポジトリの必須依存にしないこと。


### AC-RIGHTS-002: サンプル資産の権利状態を記録できること

Open Sample Model Set は、素材、モデル、テクスチャ、音声、モーション、生成物のライセンスと出典を記録できること。


### AC-RIGHTS-003: proprietary format 互換を初期成功条件にしないこと

`.cmo3`、`.moc3` などの proprietary format 互換は、初期成功条件ではなく、調査・移行・将来拡張として扱うこと。


### AC-RIGHTS-004: contributor 向け権利ルールを定義できること

Open Live2D Stack は、外部貢献者が追加するコード、モデル、素材、ドキュメントの権利条件を確認できる contributor guide を持つこと。


### AC-RIGHTS-005: 実験用ローカル依存を公開成果物から分離できること

Cubism SDK/Core などのローカル検証用依存は、`.gitignore`、環境変数、adapter 境界によって公開成果物から分離できること。
