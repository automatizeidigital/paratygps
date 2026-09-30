(() => {
  'use strict';
  const $ = id => document.getElementById(id), home = [-23.205,-44.66];
  const key = window.paratyStorageKey('paraty-nautica-v1');
  let position=null,watch=null,tracking=false,track=[],userMarker=null,accuracyCircle=null,selected=null,selectedMarker=null,line=null,lastFix=null,sessionStart=0,storageWarning=false;
  const valid = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat)<=90 && Math.abs(p.lng)<=180;
  const safeTime = value => Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : Date.now();
  window.paratyValidPoint=valid;window.paratySafeTime=safeTime;
  const status = text => { $('status').textContent=text+(storageWarning?' Não foi possível salvar no aparelho. Exporte seus dados antes de fechar.':''); };
  let saved={waypoints:[],track:[]};
  try {
    const value=JSON.parse(localStorage.getItem(key));
    if(value && typeof value==='object') {
      saved.waypoints=Array.isArray(value.waypoints)?value.waypoints.filter(valid).map(p=>({lat:p.lat,lng:p.lng,name:typeof p.name==='string'?p.name.slice(0,60):'Ponto sem nome'})):[];
      track=Array.isArray(value.track)?value.track.filter(valid).map(p=>({lat:p.lat,lng:p.lng,time:safeTime(p.time)})):[];
    }
  } catch { status('Não foi possível ler os dados locais. O aplicativo continua disponível.'); }
  const persist=()=>{saved.track=track;try{localStorage.setItem(key,JSON.stringify(saved));storageWarning=false;return true;}catch{storageWarning=true;status('Dados mantidos apenas nesta sessão.');return false;}};
  const rad=x=>x*Math.PI/180;
  const dist=(a,b)=>{const dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng),v=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 3440.065*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));};
  const fmt=p=>`${Math.abs(p.lat).toFixed(5)}° ${p.lat<0?'S':'N'} · ${Math.abs(p.lng).toFixed(5)}° ${p.lng<0?'O':'L'}`;
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function markerIcon(cls,size){return L.divIcon({className:'',html:`<div class="${cls}" style="width:${size}px;height:${size}px"></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});}
  if(!window.L){status('O mapa não carregou. Verifique a conexão com a internet.');return;}
  const map=L.map('map',{zoomControl:false}).setView(home,12);window.paratyMap=map;
  function drawTrack(){
    if(line){line.remove();line=null;}
    if(track.length>1)line=L.polyline(track.map(p=>[p.lat,p.lng]),{color:'#0c9e8e',weight:4,opacity:.9}).addTo(map);
    let total=0;for(let i=1;i<track.length;i++)total+=dist(track[i-1],track[i]);
    $('distance').innerHTML=`${total.toFixed(2).replace('.',',')} <small>MN</small>`;
  }
  function renderPins(){
    if(window.pins)window.pins.forEach(m=>m.remove());window.pins=[];
    $('count').textContent=`${saved.waypoints.length} ${saved.waypoints.length===1?'ponto':'pontos'}`;
    $('waypoints').replaceChildren();
    if(!saved.waypoints.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nenhum ponto salvo. Use “Marcar ponto” ou toque no mapa.';$('waypoints').append(empty);}
    saved.waypoints.forEach((p,i)=>{
      const marker=L.marker([p.lat,p.lng],{icon:markerIcon('targetpin',16)}).addTo(map).bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>${fmt(p)}`);window.pins.push(marker);
      const row=document.createElement('div');row.className='waypoint';row.innerHTML=`<span class="pin">◆</span><div class="wptext"><strong></strong><small>${fmt(p)}</small></div><button class="iconbtn" aria-label="Excluir ponto">×</button>`;
      row.querySelector('strong').textContent=p.name;row.querySelector('.wptext').onclick=()=>map.setView([p.lat,p.lng],14);
      row.querySelector('button').onclick=()=>{saved.waypoints.splice(i,1);persist();renderPins();};$('waypoints').append(row);
    });
  }
  const baseTiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
  let tileErrors=0;
  baseTiles.on('tileload',()=>{tileErrors=0;$('offlineBanner').hidden=true;});
  baseTiles.on('tileerror',()=>{if(++tileErrors>=2)$('offlineBanner').hidden=false;});
  L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenSeaMap contributors',errorTileUrl:''}).addTo(map);
  L.control.zoom({position:'topright'}).addTo(map);
  map.on('click',e=>{
    if(window.routeSelectionActive)return;
    const p={lat:e.latlng.lat,lng:e.latlng.lng};if(!valid(p))return;selected=p;
    if(selectedMarker)selectedMarker.remove();selectedMarker=L.marker(e.latlng,{icon:markerIcon('targetpin',16)}).addTo(map).bindPopup('Ponto selecionado<br>'+fmt(selected)).openPopup();
    status('Ponto selecionado. Toque em “Marcar ponto” para salvar.');
  });
  drawTrack();renderPins();
  $('offlineBanner').hidden=navigator.onLine;
  window.addEventListener('offline',()=>{$('offlineBanner').hidden=false;});
  window.addEventListener('online',()=>{tileErrors=0;map.invalidateSize();baseTiles.redraw();});
  setTimeout(()=>map.invalidateSize(),300);
  const fresh=()=>position&&watch!==null&&Date.now()-position.time<=30000;
  function fix(p){
    const c=p.coords,point={lat:c.latitude,lng:c.longitude,time:safeTime(p.timestamp)};
    if(!valid(point)||!Number.isFinite(c.accuracy)||c.accuracy<0){status('O GPS forneceu uma posição inválida. Aguardando novo sinal.');return;}
    position=point;window.dispatchEvent(new CustomEvent('paraty-position',{detail:{...position}}));
    $('coords').textContent=fmt(position);$('accuracy').innerHTML=`${Math.round(c.accuracy)} <small>m</small>`;
    $('speed').innerHTML=Number.isFinite(c.speed)&&c.speed>=0?`${(c.speed*1.94384).toFixed(1).replace('.',',')} <small>nós</small>`:'— <small>nós</small>';
    $('heading').innerHTML=Number.isFinite(c.heading)&&c.heading>=0&&c.heading<360?`${Math.round(c.heading)} <small>°</small>`:'— <small>°</small>';
    if(!userMarker){userMarker=L.marker([position.lat,position.lng],{icon:markerIcon('userdot',18),zIndexOffset:1000}).addTo(map);map.setView([position.lat,position.lng],14);}else userMarker.setLatLng([position.lat,position.lng]);
    if(accuracyCircle)accuracyCircle.remove();accuracyCircle=L.circle([position.lat,position.lng],{radius:c.accuracy,color:'#1caeaa',weight:1,fillOpacity:.08}).addTo(map);
    $('live').classList.add('on');$('gpsLabel').textContent='GPS ativo';status(c.accuracy>100?'Precisão baixa: confira sua posição antes de navegar.':'Posição atualizada.');
    if(tracking&&(!lastFix||dist(lastFix,position)>0.005)){track.push({...position});lastFix=position;persist();drawTrack();}
  }
  function finishTracking(){
    if(!tracking)return;
    const points=track.slice(sessionStart);tracking=false;lastFix=null;$('trackBtn').textContent='● Iniciar percurso';
    window.dispatchEvent(new CustomEvent('paraty-voyage-finished',{detail:points}));
  }
  function stopGps(){
    if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;
    finishTracking();$('gpsBtn').textContent='Ativar GPS';$('gpsBtn').classList.remove('active');$('gpsLabel').textContent='GPS desligado';$('live').classList.remove('on');
  }
  function error(e){
    if(e.code===1)stopGps();
    $('gpsLabel').textContent='GPS indisponível';$('live').classList.remove('on');
    status(e.code===1?'Permissão de localização negada. Ative o GPS nas configurações do navegador.':'Localização indisponível. Aguardando sinal; o GPS tentará novamente.');
  }
  $('gpsBtn').onclick=()=>{
    if(watch!==null){stopGps();status('GPS e registro de percurso pausados.');return;}
    if(!navigator.geolocation){status('Este navegador não oferece geolocalização.');return;}
    status('Solicitando localização…');
    try{watch=navigator.geolocation.watchPosition(fix,error,{enableHighAccuracy:true,maximumAge:2000,timeout:20000});$('gpsBtn').textContent='Pausar GPS';$('gpsBtn').classList.add('active');}
    catch{watch=null;error({code:1});}
  };
  $('trackBtn').onclick=()=>{
    if(tracking){finishTracking();status('Percurso pausado. Você pode exportá-lo em GPX.');return;}
    if(!fresh()) {status('Ative o GPS e aguarde uma posição atual antes de iniciar o percurso.');return;}
    tracking=true;sessionStart=track.length;track.push({...position});lastFix=position;persist();drawTrack();
    $('trackBtn').textContent='■ Parar percurso';status('Percurso sendo registrado neste aparelho.');
  };
  let marking=false;
  $('markBtn').onclick=async()=>{
    if(marking)return;const p=selected||(fresh()?position:null);
    if(!p){status('Ative o GPS e aguarde uma posição atual ou selecione um ponto no mapa.');return;}
    marking=true;
    try{
      const name=await(window.paratyAskPointName?window.paratyAskPointName(`Ponto ${saved.waypoints.length+1}`):prompt('Nome do ponto:',`Ponto ${saved.waypoints.length+1}`));if(name===null)return;
      const clean=name.trim().slice(0,60)||`Ponto ${saved.waypoints.length+1}`;saved.waypoints.push({...p,name:clean});persist();renderPins();status(`Ponto “${clean}” registrado.`);
      selected=null;if(selectedMarker){selectedMarker.remove();selectedMarker=null;}
    }finally{marking=false;}
  };
  $('centerBtn').onclick=()=>{if(fresh())map.setView([position.lat,position.lng],15);else status('Ative o GPS e aguarde uma posição atual.');};
  $('homeBtn').onclick=()=>map.setView(home,12);
  $('clearBtn').onclick=()=>{
    if(!track.length)return;
    if(tracking){status('Pare o registro do percurso antes de apagar seus dados.');return;}
    if(!confirm('Apagar o percurso salvo neste aparelho?'))return;track=[];lastFix=null;persist();drawTrack();status('Percurso apagado.');
  };
  $('exportBtn').onclick=()=>{
    if(!track.length&&!saved.waypoints.length){status('Registre um percurso ou salve um ponto antes de exportar.');return;}
    const points=saved.waypoints.map(p=>`<wpt lat="${p.lat}" lon="${p.lng}"><name>${escapeHtml(p.name)}</name></wpt>`).join('');
    const trk=track.map(p=>`<trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(safeTime(p.time)).toISOString()}</time></trkpt>`).join('');
    const gpx=`<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="ParatyGPS" xmlns="http://www.topografix.com/GPX/1/1">${points}<trk><name>Percurso Paraty</name><trkseg>${trk}</trkseg></trk></gpx>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([gpx],{type:'application/gpx+xml'}));a.download='paraty-percurso.gpx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
})();
