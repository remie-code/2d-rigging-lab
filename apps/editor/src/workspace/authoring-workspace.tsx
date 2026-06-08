import { Group, Panel, Separator } from "react-resizable-panels";

import { AppBar } from "./app-bar";
import { CanvasPreviewPanel } from "./panels/canvas-preview-panel";
import { InspectorPanel } from "./panels/inspector-panel";
import { ParameterBar } from "./panels/parameter-bar";
import { StructureTreePanel } from "./panels/structure-tree-panel";
import { TaskViewEntryBar } from "./task-view-entry-bar";
import { WorkspaceToolbox } from "./toolbox/workspace-toolbox";

function ResizeHandle() {
  return (
    <Separator className="w-1 shrink-0 bg-neutral-900 transition hover:bg-teal-700/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400" />
  );
}

export function AuthoringWorkspace() {
  return (
    <main className="flex min-h-screen flex-col bg-[#10100f] text-neutral-100">
      <AppBar />
      <TaskViewEntryBar />

      <div className="hidden min-h-0 flex-1 overflow-hidden p-2 xl:block">
        <Group className="h-full min-h-0" orientation="horizontal">
          <Panel defaultSize="48px" maxSize="56px" minSize="48px">
            <WorkspaceToolbox />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize="280px" maxSize="360px" minSize="240px">
            <StructureTreePanel />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={55} minSize="520px">
            <CanvasPreviewPanel />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize="320px" maxSize="420px" minSize="280px">
            <InspectorPanel />
          </Panel>
        </Group>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-2 xl:hidden">
        <div className="h-24 overflow-hidden rounded-md border border-neutral-800">
          <WorkspaceToolbox layout="horizontal" />
        </div>
        <StructureTreePanel />
        <CanvasPreviewPanel />
        <InspectorPanel />
      </div>

      <ParameterBar />
    </main>
  );
}
