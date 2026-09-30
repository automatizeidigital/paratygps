const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const listeners={},deleted=[];let work;
 const source=fs.readFileSync('sw.js','utf8');
 assert(!source.includes('nautical.js'));assert(!source.includes('charts/1633'));
 vm.runInNewContext(source,{self:{addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim:async()=>{}}},caches:{keys:async()=>['paratygps-shell-v9','paratygps-shell-v10','paratygps-charts-1633','other-app'],delete:async name=>deleted.push(name)}});
 listeners.activate({waitUntil:p=>work=p});await work;
 assert.deepEqual(deleted,['paratygps-shell-v9','paratygps-charts-1633']);
 console.log('PASS: removes old charts and shell caches, keeps current shell and unrelated caches');
})().catch(e=>{console.error(e);process.exitCode=1;});
