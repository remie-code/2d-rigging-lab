// Local read-only TypeScript adapter, retained with the experiment.
import {registerHooks,createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(new URL('../../../../package.json',import.meta.url));
const ts=require('typescript');
registerHooks({
  resolve(specifier,context,nextResolve){
    try{return nextResolve(specifier,context);}catch(error){
      if(specifier.startsWith('.')||specifier.startsWith('file:')){
        const path=fileURLToPath(new URL(specifier,context.parentURL));
        const candidate=path.endsWith('.js')?path.slice(0,-3)+'.ts':path+'.ts';
        if(existsSync(candidate))return{url:pathToFileURL(candidate).href,shortCircuit:true};
      }
      throw error;
    }
  },
  load(url,context,nextLoad){
    if(url.startsWith('file:')&&/\.[cm]?ts$/.test(url)){
      const source=ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{
        compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true},fileName:fileURLToPath(url)
      }).outputText;
      return{format:'module',source,shortCircuit:true};
    }
    return nextLoad(url,context);
  }
});
