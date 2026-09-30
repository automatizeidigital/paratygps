// Run with Playwright available, PARATY_TEST_PASSWORD and optional PARATY_TEST_URL.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.PARATY_TEST_URL||'http://localhost:8001';
const config={headless:true};
if(process.env.PARATY_USE_PROXY==='1' && process.env.HTTPS_PROXY)config.proxy={server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'};
if(process.env.PARATY_CHROMIUM_PATH)config.executablePath=process.env.PARATY_CHROMIUM_PATH;
if(process.env.PARATY_BROWSER_BUNDLE)config.args=[...require(process.env.PARATY_BROWSER_BUNDLE).args.filter(arg=>!['--disable-web-security','--allow-running-insecure-content'].includes(arg)),'--ignore-certificate-errors'];
(async()=>{
 if(!process.env.PARATY_TEST_PASSWORD)throw Error('PARATY_TEST_PASSWORD required');
 const browser=await chromium.launch(config);
 try{
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:393,height:852},acceptDownloads:true});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(()=>{
   const id='dec754d7-8684-4b23-af3f-a235a80d4b36',key=name=>`paratygps-user:${id}:${name}`;
   if(!localStorage.getItem('audit-fixtures')){
    localStorage.setItem(key('paraty-nautica-v1'),JSON.stringify({waypoints:[null,{lat:200,lng:0},{lat:-23.205,lng:-44.66,name:'<img src=x onerror=alert(1)>'}],track:[null,{lat:100,lng:10},{lat:-23.205,lng:-44.66,time:1e100}]}));
    localStorage.setItem(key('paratygps-history-v1'),JSON.stringify([{id:'fixture',created:'invalid',name:'<b>Histórico</b>',points:[{lat:-23.205,lng:-44.66,time:1e100},{lat:-23.21,lng:-44.66,time:0}]}]));
    localStorage.setItem('audit-fixtures','yes');
   }
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok,error){window.auditFix=(lat=-23.205,lng=-44.66)=>ok({coords:{latitude:lat,longitude:lng,accuracy:12,speed:null,heading:null},timestamp:Date.now()});window.auditGpsError=error;setTimeout(()=>window.auditFix(),0);return 42;},clearWatch(){}}});
  });
  // Never send test signup/recovery mail to real recipients.
  await ctx.route('**/auth/v1/signup*',r=>r.fulfill({json:{user:{id:'signup-fixture'},session:null}}));
  await ctx.route('**/auth/v1/recover*',r=>r.fulfill({json:{}}));
  await page.goto(base+'/');await page.waitForURL('**/login.html');
  await page.locator('#signupTab').click();
  await page.locator('#fullName').fill('Teste');await page.locator('#email').fill('fixture@example.test');await page.locator('#password').fill('TestPassword123!');await page.locator('#confirmPassword').fill('DifferentPassword123!');await page.locator('#submitBtn').click();await page.getByText('As senhas precisam ser iguais.',{exact:true}).waitFor();
  await page.locator('#confirmPassword').fill('TestPassword123!');await page.locator('#submitBtn').click();await page.waitForFunction(()=>document.getElementById('authMessage').textContent.includes('confirmar o cadastro'));
  await page.locator('#showPassword').click();await page.locator('#loginTab').click();assert.equal(await page.locator('#password').getAttribute('type'),'password');
  await page.locator('#forgotBtn').click();await page.locator('#email').fill('fixture@example.test');await page.locator('#submitBtn').click();await page.waitForFunction(()=>document.getElementById('authMessage').textContent.includes('link de recuperação'));await page.locator('#backBtn').click();
  await page.locator('#email').fill(process.env.PARATY_TEST_EMAIL||'automatizeidigital@gmail.com');await page.locator('#password').fill(process.env.PARATY_TEST_PASSWORD);await page.locator('#submitBtn').click();await page.waitForURL('**/index.html').catch(async()=>{throw new Error('Login/map gate failed: '+page.url()+' '+await page.locator('#authMessage').textContent().catch(()=>''));});await page.waitForFunction(()=>window.paratyMap&&document.getElementById('historyCount').textContent==='1 viagem');
  assert.equal(await page.locator('#count').textContent(),'1 ponto');assert.equal(await page.locator('#waypoints img').count(),0);assert.equal(await page.locator('#chartLayer').count(),0);
  await page.locator('#trackBtn').click();assert.match(await page.locator('#status').textContent(),/Ative o GPS/);
  await page.locator('#gpsBtn').click();await page.waitForFunction(()=>document.getElementById('gpsLabel').textContent==='GPS ativo');await page.locator('#trackBtn').click();
  await page.evaluate(()=>window.auditFix(-23.215,-44.66));await page.locator('#clearBtn').click();assert.match(await page.locator('#status').textContent(),/Pare o registro/);
  await page.locator('#openMapBtn').click();await page.waitForFunction(()=>document.body.classList.contains('map-expanded'));const box=await page.locator('.mapwrap').boundingBox();assert.equal(box.height,852);assert.equal(box.width,393);
  await page.locator('#fullscreenTrack').click();await page.locator('#pointNameInput').fill('Viagem auditada');await page.locator('#pointNameForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('historyCount').textContent==='2 viagens');assert.equal(await page.locator('#fullscreenTrack').textContent(),'● Iniciar percurso');
  await page.locator('#fullscreenMark').click();await page.locator('#pointNameInput').fill('Ponto auditado');await page.locator('#pointNameForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('count').textContent==='2 pontos');await page.goBack();await page.waitForFunction(()=>!document.body.classList.contains('map-expanded'));
  const gpx=async button=>{
   const pending=page.waitForEvent('download');await button.click();const file=await(await pending).path();const text=fs.readFileSync(file,'utf8');
   assert.equal(await page.evaluate(xml=>new DOMParser().parseFromString(xml,'text/xml').getElementsByTagName('parsererror').length,text),0);return text;
  };
  assert.match(await gpx(page.locator('#exportBtn')),/Ponto auditado/);assert.match(await gpx(page.locator('.history-card').last().getByRole('button',{name:'↓ GPX'})),/&lt;b&gt;/);
  for(const [id,lat]of[['routeStart',-23.20],['routeVia',-23.21],['routeEnd',-23.22]]){await page.locator('#'+id).click();await page.evaluate(lat=>window.paratyMap.fire('click',{latlng:L.latLng(lat,-44.66)}),lat);}
  const route=await gpx(page.locator('#routeExport'));assert.equal((route.match(/<rtept /g)||[]).length,3);
  await page.evaluate(()=>{const old=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('paratygps-user:'))throw new DOMException('quota','QuotaExceededError');return old.call(this,key,value);};});
  await page.locator('#markBtn').click();await page.locator('#pointNameInput').fill('Sem espaço');await page.locator('#pointNameForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Não foi possível salvar'));
  await page.locator('#routeVia').click();await page.evaluate(()=>window.paratyMap.fire('click',{latlng:L.latLng(-23.23,-44.66)}));assert.match(await page.locator('#routeDistance').textContent(),/Não foi possível salvar/);
  await page.locator('#gpsBtn').click();await page.locator('#trackBtn').click();assert.match(await page.locator('#status').textContent(),/posição atual/);
  await page.evaluate(()=>navigator.serviceWorker.ready);await ctx.setOffline(true);await page.reload();await page.waitForFunction(()=>window.paratyMap&&window.paratyCurrentUser.offline);
  assert.equal(await page.locator('#offlineBanner').isVisible(),true);await page.locator('#gpsBtn').click();await page.waitForFunction(()=>document.getElementById('gpsLabel').textContent==='GPS ativo');await page.locator('#trackBtn').click();await page.evaluate(()=>window.auditOriginalMap=window.paratyMap);
  await ctx.setOffline(false);await page.waitForFunction(()=>window.paratyCurrentUser.offline===false);assert.equal(await page.evaluate(()=>window.paratyMap===window.auditOriginalMap),true);assert.match(await page.locator('#trackBtn').textContent(),/Parar percurso/);
  await page.locator('#trackBtn').click();if(await page.locator('#pointNameDialog').isVisible())await page.locator('#pointCancel').click();await page.locator('#gpsBtn').click();
  await page.locator('#adminLink').click();await page.locator('#adminControls').waitFor({state:'visible'});assert.match(await page.locator('#users').textContent(),/automatizeidigital@gmail.com/);
  const oldToken=await page.evaluate(async()=>{const {data}=await ParatyAuth.client.auth.getSession();return data.session.access_token;});
  await page.locator('#logoutBtn').click();await page.waitForURL('**/login.html');
  const revoked=await ctx.request.post('https://zrlzgckdfpeatzkqjaih.supabase.co/rest/v1/rpc/platform_list_access',{headers:{apikey:'sb_publishable_iALv_mJ1lvswbLDD_Fe6Pw_c25CHd1e',Authorization:'Bearer '+oldToken},data:{}});assert.equal(revoked.status(),403);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: signup/recovery validations (mocked mail), real login/master, corrupt data, XSS payload, fresh GPS, recording/history, fullscreen/back, GPX XML, quota failures, paused GPS, offline/reconnection without interrupting GPS, real admin and revoked JWT blocking; no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
