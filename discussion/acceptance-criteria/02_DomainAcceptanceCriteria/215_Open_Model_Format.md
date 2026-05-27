# DOMAIN-15: Project-defined Model Package

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is project-defined model package.

## 問い

Private Prototypeの制作・runtime・validation・AI assistantが共有するmodel packageは、何を表現できるべきか。

### AC-FORMAT-001: project-defined仕様として定義できること

Package仕様は、Private Prototype内で実装者、制作者、AI assistantが読める形で定義されること。公開標準仕様化は現在MVPの要件ではない。

### AC-FORMAT-002: authoringとruntimeに必要な構造を表現できること

Packageは、drawable、mesh、part、parameter、keyform、rig control、dynamics、texture、metadata、provenanceを表現できること。

### AC-FORMAT-003: AI-readableであること

Packageは、AI assistantが構造、差分、編集意図、validation result、provenanceを扱える形で設計されること。

### AC-FORMAT-004: versioningとmigrationを扱えること

Packageは、format version、migration、非推奨要素、将来拡張を扱えること。

### AC-FORMAT-005: packageと参照整合を定義できること

Packageは、model graph、texture、関連設定、metadata、rights/provenanceを整合的に扱えること。
