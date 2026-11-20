import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
import { loadAuthoringPackageDirectory } from '../../../../apps/authoring-host/src/package-directory-io.ts';
import { evaluatePerceptionSnapshot } from '../../../../apps/authoring-host/src/perception/evaluation-adapter.ts';
import { createPerceptionRenderScene } from '../../../../apps/authoring-host/src/perception/render-scene-adapter.ts';
import { compileRuntimeModel } from '../../../../packages/runtime-core/src/runtime-core.ts';
import { renderSceneToPng } from '../../../../packages/render-software/src/render-scene-to-png.ts';

// The Player's bundled TS imports omit the extension; Node runs these sources directly.
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === './speech-motion-assets' ? specifier + '.ts' : specifier, context);
} });
const { SpeechMotionPlayback } = await import('../../../../apps/runtime-player/src/main/control-channel/speech-motion-playback.ts');
hooks.deregister();

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const out = process.argv[2];
const { view, modelRevision, fps } = read(new URL('../speech-motion-game-curiosity-v1/definition.json', import.meta.url));
const mouth = read(join(out, 'mouth.json'));
const speechEndMs = read(join(out, 'speech-end.json'));
const { session } = await loadAuthoringPackageDirectory(
  'C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843'
);
if (session.packageRevision !== modelRevision) throw Error('Unexpected model revision');
const { graph, snapshot } = evaluatePerceptionSnapshot(session);
const template = createPerceptionRenderScene({ session, graph, snapshot });
const byId = new Map(template.drawables.map(d => [d.drawableId, d]));
const model = compileRuntimeModel(graph);
const clips = read(join(out, 'clips.json'));

for (const [version, clip] of Object.entries(clips)) {
  const instance = model.createInstance();
  const playback = new SpeechMotionPlayback();
  const base = { param_eye_left_open: 1, param_eye_right_open: 1 };
  playback.parameters(0, base);
  playback.stage(0, 'scale', 1);
  playback.start(clip, 0, []);
  playback.end(speechEndMs);
  mkdirSync(join(out, version), { recursive: true });
  for (const [i, opening] of mouth.entries()) {
    const t = i * 1000 / fps;
    const values = { ...playback.parameters(t, base), param_mouth_open: opening };
    const { frame } = instance.evaluateRenderFrame({
      schemaVersion: 'runtime-evaluation-input-v1', frameIndex: i, deltaTimeMs: 0,
      resetReasons: ['packageLoad'], authoredParameterValues: values, targetIds: []
    }, { controlOptions: { snapshotValidation: 'skip' } });
    const drawables = frame.drawables.map(d => {
      const base = byId.get(d.drawableId);
      return { ...base, mesh: { ...base.mesh, vertices: d.vertices }, opacity: d.opacity, visible: d.visible, drawOrder: d.drawOrder };
    });
    const box = view.stageViewport;
    const zoom = playback.stage(t, 'scale', 1) ?? 1;
    const width = box.width / zoom;
    const height = box.height / zoom;
    const panY = playback.stage(t, 'y', 0) ?? 0;
    const stageViewport = {
      width, height, minX: box.minX + (box.width - width) / 2,
      minY: box.minY + (box.height - height) / 2 - panY * height / view.outputHeight
    };
    const { png } = renderSceneToPng({ ...template, drawables }, { ...view, stageViewport });
    writeFileSync(join(out, version, String(i).padStart(3, '0') + '.png'), png);
  }
  console.log(version, mouth.length, 'frames');
}
