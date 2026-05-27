# DOMAIN-16: Private Runtime Core

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is private runtime core.

## 問い

Private runtime coreは、project-defined packageをどのように読み込み、評価し、private viewerへ描画可能な状態を渡すべきか。

### AC-RUNTIME-001: project-defined packageを読み込めること

Private runtime coreは、project-defined model packageを読み込み、runtime stateを初期化できること。

### AC-RUNTIME-002: parameter stateを保持・更新できること

Private runtime coreは、parameter値を保持し、viewer override、editor preview override、operation dry-runなどの入力源から更新できること。

### AC-RUNTIME-003: parameterに応じたvertex / drawable状態を評価できること

Private runtime coreは、parameter値、keyform、manual authored parameter grid、rig control、dynamicsに基づき、vertex、visibility、opacity、draw order、maskを評価できること。

### AC-RUNTIME-004: 描画統合できること

Private runtime coreは、renderer adapterに対してtexture、mesh、draw order、maskを反映した描画情報を提供できること。

### AC-RUNTIME-005: runtime stateを観測できること

Private runtime coreは、validator、private viewer、AI assistantがruntime snapshot、diagnostics、warning/errorを取得できるようにすること。
