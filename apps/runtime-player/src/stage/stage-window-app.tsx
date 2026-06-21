import type { ReactElement } from "react";

export function StageWindowApp(): ReactElement {
  return (
    <main
      aria-label="Transparent capture stage placeholder"
      className="stage-window-shell"
    >
      <div className="stage-model-aura" aria-hidden="true" />
      <div className="stage-model-placeholder" aria-hidden="true">
        <div className="stage-model-head" />
        <div className="stage-model-neck" />
        <div className="stage-model-body" />
      </div>
      <p className="stage-window-label">Transparent Stage placeholder</p>
    </main>
  );
}
