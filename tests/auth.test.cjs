const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const master={id:'c73338d1-4912-4dae-a578-dca7ee284911',email:'admin@example.test',app_metadata:{role:'master_admin'}};
const normal={id:'19f6ebdf-10ec-47c5-a153-533ff1ce11a0',email:'user@example.test',app_metadata:{},user_metadata:{role:'master_admin'}};
async function setup({user=normal,error=null,online=true,remembered=null,legacy=false,access=null}={}) {
 const values=new Map(),elements=new Map(),callbacks=[];let destination,reloaded=false;const scripts=[];
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 if(remembered) values.set('paratygps-offline-account',JSON.stringify({...remembered,verifiedAt:Date.now(),approved:true}));
 if(legacy) values.set('paraty-nautica-v1','{"waypoints":[{"name":"Legacy"}],"track":[]}');
 const window={addEventListener(){},PARATY_AUTH_CONFIG:{url:'https://example.supabase.co',publishableKey:'public',storageKey:'paratygps-auth'},supabase:{createClient:()=>({rpc:async()=>({data:access || {status:'active',is_master:user?.app_metadata?.role==='master_admin'},error:null}),auth:{onAuthStateChange:cb=>callbacks.push(cb),getUser:async()=>({data:{user},error}),signOut:async()=>({error:null})}})}};
 const location={href:'https://example.test/login.html',hash:'',replace:value=>destination=value,reload:()=>reloaded=true};
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false});return elements.get(id);},documentElement:{classList:{remove(){}}},createElement:()=>({}),body:{append:script=>{scripts.push(script.src);queueMicrotask(()=>script.onload());}}};
 const context={window,location,document,localStorage:storage,navigator:{onLine:online},URL,URLSearchParams,AbortSignal,fetch:async()=>{},Date,setInterval(){}};
 vm.runInNewContext(fs.readFileSync('auth-core.js','utf8'),context);
 const api=window.ParatyAuth;
 vm.runInNewContext(fs.readFileSync('app-auth.js','utf8'),context);
 await tick();await tick();
 return {window,api,values,elements,scripts,callbacks,destination:()=>destination,reloaded:()=>reloaded};
}
(async()=>{
 let app=await setup({user:normal,legacy:true});
 assert.equal(app.api.roleLabel(normal),'Usuário','user_metadata cannot grant master');
 assert.equal(app.values.get('paraty-nautica-v1').includes('Legacy'),true);
 assert.equal(app.values.get(app.api.storageKey(normal.id,'paraty-nautica-v1')),undefined);
 assert.notEqual(app.api.storageKey(master.id,'history'),app.api.storageKey(normal.id,'history'));
 assert.equal(app.elements.get('accountRole').textContent,'Usuário liberado');
 app.callbacks.at(-1)('SIGNED_IN',{user:master});assert.equal(app.reloaded(),true);
 app=await setup({user:master,legacy:true});
 assert.equal(app.elements.get('accountRole').textContent,'Administrador master');
 assert.equal(app.values.get('paraty-nautica-v1'),undefined);
 assert.match(app.values.get(app.api.storageKey(master.id,'paraty-nautica-v1')),/Legacy/);
 app=await setup({error:{status:401,code:'bad_jwt'},remembered:master});
 assert.equal(app.destination(),'https://example.test/login.html');assert.equal(app.scripts.length,0);assert.equal(app.values.has('paratygps-offline-account'),false);
 app=await setup({online:false,remembered:master});
 assert.equal(app.window.paratyCurrentUser.offline,true);assert.match(app.elements.get('accountRole').textContent,/Offline/);
 await app.elements.get('logoutBtn').onclick();
 assert.equal(app.values.has('paratygps-offline-account'),false);assert.equal(app.destination(),'https://example.test/login.html');
 app=await setup({online:false});assert.equal(app.destination(),'https://example.test/login.html');assert.equal(app.scripts.length,0);
 app=await setup({access:{status:'pending',is_master:false}});assert.equal(app.destination(),'https://example.test/access.html');assert.equal(app.scripts.length,0);assert.equal(app.api.offlineAccount(),null);
 app=await setup({access:{status:'suspended',is_master:false},remembered:normal});assert.equal(app.destination(),'https://example.test/access.html');assert.equal(app.scripts.length,0);assert.equal(app.api.offlineAccount(),null);
 app=await setup({online:false,remembered:normal});app.values.set('paratygps-offline-account',JSON.stringify({...normal,approved:true,verifiedAt:Date.now()-86400001}));assert.equal(app.api.offlineAccount(),null);
 app.values.set('paratygps-offline-account',JSON.stringify({...normal,verifiedAt:Date.now()}));assert.equal(app.api.offlineAccount(),null);
 console.log('PASS: pending/suspended gates, offline entitlement expiry, legacy entitlement rejection, server-owned role, per-user storage, master migration, invalid-session blocking, account changes and offline logout');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Authorization failures without an HTTP status are not network outages.
(async()=>{
 const app=await setup();
 assert.equal(app.api.isTransportError({code:'42501',message:'permission denied'}),false);
 assert.equal(app.api.isTransportError({code:'session_not_found',message:'Session missing'}),false);
 assert.equal(app.api.isTransportError({message:'Failed to fetch'}),true);
 assert.equal(app.api.isTransportError({status:503,message:'Service unavailable'}),true);
 console.log('PASS: permission/session failures cannot use transport fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
