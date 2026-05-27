# DOMAIN-19: Future Streaming App Boundary

> Status: Future / out of current MVP.
> Filename note: the historical filename is kept for link stability.

## 問い

将来、配信用アプリやtracking連携を扱う場合、どの境界を別途設計すべきか。

## 方針

Current MVPはFuture streaming app、OBS output、tracking app、public app distributionを含まない。Streaming Demo Surfaceはprivate viewer captureで扱い、配信用アプリは将来設計に分離する。

### AC-VTUBER-001: project-defined packageを配信用modelとして扱う将来境界を検討できること

将来検討時には、private runtime coreと配信用stageの責務境界を設計できること。

### AC-VTUBER-002: tracking inputをparameterへmappingする将来境界を検討できること

将来検討時には、tracking input、calibration、parameter mappingを別設計として扱えること。

### AC-VTUBER-003: smoothingとcalibrationを将来候補として扱えること

将来検討時には、入力値のsmoothing、基準姿勢、感度、範囲補正を設計できること。

### AC-VTUBER-004: expression hotkeyとmodel placementを将来候補として扱えること

将来検討時には、expression hotkey、placement、transparent backgroundなどを別途扱えること。

### AC-VTUBER-005: 外部APIとAI設定補助を将来候補として扱えること

将来検討時には、外部制御APIやAI設定補助の公開範囲を別途reviewできること。
