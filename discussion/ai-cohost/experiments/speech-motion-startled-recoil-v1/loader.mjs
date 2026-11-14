import 'file:///C:/workspace/remie/rigging/astra-chan/workspace-notes/tools/player-ts-loader.mjs';
import{registerHooks}from'node:module';import{readFileSync}from'node:fs';
// Offline execution adapter for the runtime-player's bundler JSON imports.
registerHooks({load(url,context,next){if(url.includes('/apps/runtime-player/')&&url.endsWith('.json'))return{format:'module',source:'export default '+readFileSync(new URL(url),'utf8'),shortCircuit:true};return next(url,context);}});

