// Generates build/icon.ico from build/icon-source.png using png-to-ico.
//
// png-to-ico, when handed a single large PNG (>= 256px), emits a multi-size
// .ico containing the 16/32/48/256 layers, so the 256px entry electron-builder
// wants is included automatically.
//
// Run after `pnpm install` (png-to-ico is a devDependency):
//   pnpm run generate-icon
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pngToIco from 'png-to-ico';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const sourcePath = resolve(appRoot, 'build', 'icon-source.png');
const outputPath = resolve(appRoot, 'build', 'icon.ico');

async function main() {
  const sourcePng = await readFile(sourcePath);
  const ico = await pngToIco(sourcePng);
  await writeFile(outputPath, ico);
  console.log(`Wrote ${outputPath} (${ico.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
