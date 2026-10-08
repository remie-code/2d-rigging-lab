# Runtime Player Backlog Map

> Runtime Playerで後から実行すべきタスク、延期されたリスク、将来wave候補の入口地図。

## 1. Scope

この階層は、Runtime Player文脈で「今は実装しないが、後で必ず検討または実行する必要があること」を管理する。

ここには詳細な設計判断そのものではなく、後続planning-gateへ渡すためのタスク入口を置く。判断の根拠や設計詳細は `architecture/`、実装結果は `implementation/`、外部仕様調査は `research/` に置く。

## 2. Files

| Path | Status | Content |
|---|---|---|
| [runtime-player-backlog.md](runtime-player-backlog.md) | Active / implementation-vs-gate split required | Runtime Playerの延期タスク、技術的負債、将来wave候補の一覧。実装済み項目（特に旧3.5）は実装passと残余実機確認を分離して読む |

## 3. Backlog Categories

- Architecture debt: 今は短期対応で進めるが、長期的には構造を変えるべきもの。
- Runtime verification: 実物Runtime Exportや実環境で確認すべきもの。
- Future UX / feature: 次以降のRuntime Player UXとして検討するもの。
- Platform risk: OS、Electron、OBS capture、透明windowなど環境差分があるもの。

## 4. How To Use

1. `runtime-player-backlog.md` で該当項目を探す。
2. 各項目の `Source` を読んで、なぜそのタスクが残っているか確認する。
3. 実装済みwaveのsource/test passと、real Runtime Export・iFacialMocap・OBS・Electronのhuman/device gateを分けて確認する。`Trigger` に該当する未実装項目だけをplanning-gateで次wave候補にする。
4. 実装waveに移したら、項目のstatusを `Planned` / `In progress` / `Done` / `Superseded` のいずれかへ更新する。

## 5. Current Follow-up Boundary

- Wave13–19 performance/diagnostics implementation is complete; OBS/CEF visual confidence remains a product gate, not a deep-profiler backlog item.
- Wave20 lifecycle implementation is pass; packaged/dev Electron close/reopen smoke remains a manual gate.
- Wave21 Dynamics Tune is Domain A/B pass; Domain C parity/persistence/reset/isolation/artifact checks remain pending.
- Wave22/23 vowel implementation/reviews are pass; real iFacialMocap + vowel-rig behavior remains pending. The detailed backlog child may still contain historical item wording; correct that child only under its owning leaf pass.
