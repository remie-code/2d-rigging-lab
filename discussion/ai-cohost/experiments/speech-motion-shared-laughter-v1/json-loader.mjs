import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
registerHooks({load(url,context,next){if(url.endsWith('.json') && url.includes('/apps/runtime-player/'))return {format:'module',source:'export default '+readFileSync(new URL(url),'utf8')+';',shortCircuit:true};return next(url,context);}});

