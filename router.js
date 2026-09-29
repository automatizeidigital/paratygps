// ParatyGPS water router. Uses the navigation mask built from DHN raster chart 1633
// (tools/build_chart_mask.py): land, drying areas and depth bands on a 10 m grid.
// A* on a grid that blocks land, drying areas and water shallower than the requested depth, keeps a
// clearance margin from them and prefers deeper water. Runs as a Web Worker in the app, CommonJS in tests.
'use strict';
const ORIGIN=[-23.2,-44.66],KY=110540,KX=111320*Math.cos(ORIGIN[0]*Math.PI/180),SQ2=Math.SQRT2;
const toXY=(lat,lng)=>[(lng-ORIGIN[1])*KX,(lat-ORIGIN[0])*KY],toLL=(x,y)=>[ORIGIN[0]+y/KY,ORIGIN[1]+x/KX];
// Class codes in the mask: 0 no data, 1 land, 2 drying, 3 depth>=0 m, 4 >=2 m, 5 >=5 m, 6 >=10 m.
const DEPTH_OF_CLASS=[null,null,null,0,2,5,10],CLASS_FOR_DEPTH={0:3,2:4,5:5,10:6};
let M=null;

function load(buffer){const v=new DataView(buffer);if(String.fromCharCode(v.getUint8(0),v.getUint8(1),v.getUint8(2),v.getUint8(3))!=='PGM1')throw new Error('máscara inválida');const minX=v.getInt32(4,true),minY=v.getInt32(8,true),cell=v.getUint16(12,true),cols=v.getUint16(14,true),rows=v.getUint16(16,true),data=new Uint8Array(cols*rows),b=new Uint8Array(buffer);let p=18,o=0;while(p<b.length&&o<data.length){const val=b[p++];let run=0,shift=0,x;do{x=b[p++];run|=(x&0x7f)<<shift;shift+=7}while(x&0x80);data.fill(val,o,o+run);o+=run}if(o!==data.length)throw new Error('máscara incompleta');M={minX,minY,cell,cols,rows,data};return{cols,rows,cell}}

function classAt(lat,lng){if(!M)return 0;const [x,y]=toXY(lat,lng),c=Math.floor((x-M.minX)/M.cell),r=Math.floor((y-M.minY)/M.cell);return c<0||r<0||c>=M.cols||r>=M.rows?0:M.data[r*M.cols+c]}

// Visit every cell a segment touches (Amanatides-Woo).
function trace(ax,ay,bx,by,visit){let cx=Math.floor(ax),cy=Math.floor(ay);const ex=Math.floor(bx),ey=Math.floor(by),dx=bx-ax,dy=by-ay,sx=Math.sign(dx),sy=Math.sign(dy),tdx=dx?1/Math.abs(dx):Infinity,tdy=dy?1/Math.abs(dy):Infinity;let tx=dx?(sx>0?cx+1-ax:ax-cx)*tdx:Infinity,ty=dy?(sy>0?cy+1-ay:ay-cy)*tdy:Infinity;if(visit(cx,cy)===false)return false;for(let n=Math.abs(ex-cx)+Math.abs(ey-cy);n>0;n--){if(tx<ty){tx+=tdx;cx+=sx}else{ty+=tdy;cy+=sy}if(visit(cx,cy)===false)return false}return true}

// Grid over the box; each cell takes the WORST mask class it covers (conservative when cells are coarser).
function buildGrid(box,cell,need){const [minX,minY,maxX,maxY]=box,cols=Math.ceil((maxX-minX)/cell),rows=Math.ceil((maxY-minY)/cell),n=cols*rows,code=new Uint8Array(n);
for(let r=0;r<rows;r++){const y0=minY+r*cell,mr0=Math.floor((y0-M.minY)/M.cell),mr1=Math.floor((y0+cell-1e-6-M.minY)/M.cell);for(let c=0;c<cols;c++){const x0=minX+c*cell,mc0=Math.floor((x0-M.minX)/M.cell),mc1=Math.floor((x0+cell-1e-6-M.minX)/M.cell);let worst=7;for(let mr=mr0;mr<=mr1&&worst;mr++)for(let mc=mc0;mc<=mc1;mc++){const v=mr<0||mc<0||mr>=M.rows||mc>=M.cols?0:M.data[mr*M.cols+mc];if(v<worst)worst=v}code[r*cols+c]=worst}}
// Chamfer distance (metres) to the nearest blocked cell (land, drying, shallower than needed, no data).
const dist=new Float32Array(n);for(let i=0;i<n;i++)dist[i]=code[i]<need?0:1e9;const d1=cell,d2=cell*SQ2;
for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const i=r*cols+c;let v=dist[i];if(c>0&&dist[i-1]+d1<v)v=dist[i-1]+d1;if(r>0){const u=i-cols;if(dist[u]+d1<v)v=dist[u]+d1;if(c>0&&dist[u-1]+d2<v)v=dist[u-1]+d2;if(c<cols-1&&dist[u+1]+d2<v)v=dist[u+1]+d2}dist[i]=v}
for(let r=rows-1;r>=0;r--)for(let c=cols-1;c>=0;c--){const i=r*cols+c;let v=dist[i];if(c<cols-1&&dist[i+1]+d1<v)v=dist[i+1]+d1;if(r<rows-1){const u=i+cols;if(dist[u]+d1<v)v=dist[u]+d1;if(c<cols-1&&dist[u+1]+d2<v)v=dist[u+1]+d2;if(c>0&&dist[u-1]+d2<v)v=dist[u-1]+d2}dist[i]=v}
return{minX,minY,cols,rows,cell,code,dist}}

function snap(g,x,y,hard,maxMetres){const c0=Math.min(g.cols-1,Math.max(0,Math.floor((x-g.minX)/g.cell))),r0=Math.min(g.rows-1,Math.max(0,Math.floor((y-g.minY)/g.cell)));const R=Math.ceil(maxMetres/g.cell);let best=-1,bestD=Infinity;for(let rad=0;rad<=R&&best<0;rad++){for(let dr=-rad;dr<=rad;dr++)for(let dc=-rad;dc<=rad;dc++){if(Math.max(Math.abs(dr),Math.abs(dc))!==rad)continue;const c=c0+dc,r=r0+dr;if(c<0||r<0||c>=g.cols||r>=g.rows)continue;const i=r*g.cols+c;if(g.dist[i]>=hard){const d=dr*dr+dc*dc;if(d<bestD){bestD=d;best=i}}}}return best}

function astar(g,s,t,hard,soft,need){const {cols,rows,cell,dist,code}=g,n=cols*rows,gs=new Float32Array(n).fill(Infinity),par=new Int32Array(n).fill(-1),closed=new Uint8Array(n),heap=[],fs=[];const tc=t%cols,tr=(t/cols)|0,h=i=>Math.hypot((i%cols)-tc,((i/cols)|0)-tr)*cell;
const push=(i,f)=>{heap.push(i);fs.push(f);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(fs[p]<=fs[k])break;[heap[p],heap[k]]=[heap[k],heap[p]];[fs[p],fs[k]]=[fs[k],fs[p]];k=p}},pop=()=>{const top=heap[0],li=heap.pop(),lf=fs.pop();if(heap.length){heap[0]=li;fs[0]=lf;let k=0;for(;;){const a=2*k+1,b=a+1;let m=k;if(a<heap.length&&fs[a]<fs[m])m=a;if(b<heap.length&&fs[b]<fs[m])m=b;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];[fs[m],fs[k]]=[fs[k],fs[m]];k=m}}return top};
// extra cost near the margin and in the shallowest band still allowed: prefer open, deeper water
const pen=i=>(dist[i]>=soft?0:2.5*(soft-dist[i])/Math.max(1,soft-hard))+(code[i]===need&&need<6?.6:0);gs[s]=0;push(s,h(s));
while(heap.length){const i=pop();if(closed[i])continue;if(i===t)break;closed[i]=1;const c=i%cols,r=(i/cols)|0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=cols||rr>=rows)continue;const j=rr*cols+cc;if(closed[j]||dist[j]<hard)continue;if(dr&&dc&&(dist[r*cols+cc]<hard||dist[rr*cols+c]<hard))continue;const ng=gs[i]+(dr&&dc?SQ2:1)*cell*(1+pen(j));if(ng<gs[j]){gs[j]=ng;par[j]=i;push(j,ng+h(j))}}}
if(!Number.isFinite(gs[t]))return null;const path=[];for(let i=t;i!==-1;i=par[i])path.push(i);return path.reverse()}

// Straighten the staircase path without getting closer to danger, nor into a shallower band, than the stretch it replaces.
function smooth(g,path,soft){const {cols,cell,dist,code}=g,cx=i=>i%cols+.5,cy=i=>((i/cols)|0)+.5;const clear=(a,b,need,band)=>trace(cx(a),cy(a),cx(b),cy(b),(c,r)=>dist[r*cols+c]>=need&&code[r*cols+c]>=band);const out=[path[0]];let i=0;while(i<path.length-1){let last=i+1,runMin=Math.min(dist[path[i]],dist[path[i+1]]),band=Math.min(code[path[i]],code[path[i+1]]);for(let j=i+2;j<path.length;j++){runMin=Math.min(runMin,dist[path[j]]);band=Math.min(band,code[path[j]]);if(clear(path[i],path[j],Math.min(runMin,soft),band))last=j;else if(j-last>40)break}out.push(path[last]);i=last}return out.map(i=>[g.minX+(i%cols+.5)*cell,g.minY+(((i/cols)|0)+.5)*cell])}

// points: [[lat,lng],...] start, optional passages, end. opt: {hard (m), depth (0|2|5|10 m), maxCells}
function plan(points,opt={}){if(!M)return{ok:false,reason:'no-data'};const hard=opt.hard||50,soft=Math.max(hard*3,150),need=CLASS_FOR_DEPTH[opt.depth]||4,maxCells=opt.maxCells||900000;const xy=points.map(p=>toXY(p[0],p[1]));
const mapMax=[M.minX+M.cols*M.cell,M.minY+M.rows*M.cell];for(let k=0;k<xy.length;k++){const [x,y]=xy[k];if(x<M.minX||y<M.minY||x>mapMax[0]||y>mapMax[1])return{ok:false,reason:'outside',index:k}}
for(const pad of opt.pads||[3000,9000,40000]){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const [x,y] of xy){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}minX=Math.max(M.minX,minX-pad);minY=Math.max(M.minY,minY-pad);maxX=Math.min(mapMax[0],maxX+pad);maxY=Math.min(mapMax[1],maxY+pad);const cell=Math.max(M.cell,Math.ceil(Math.sqrt((maxX-minX)*(maxY-minY)/maxCells)/M.cell)*M.cell,Math.floor(hard/2.5/M.cell)*M.cell);const g=buildGrid([minX,minY,maxX,maxY],cell,need);
const snapped=[];for(let k=0;k<xy.length;k++){const i=snap(g,xy[k][0],xy[k][1],hard,1500);if(i<0)return{ok:false,reason:'no-water',index:k};snapped.push(i)}
const legs=[];let fail=false;for(let k=1;k<snapped.length;k++){const p=astar(g,snapped[k-1],snapped[k],hard,soft,need);if(!p){fail=true;break}legs.push(p)}if(fail){if(minX<=M.minX&&minY<=M.minY&&maxX>=mapMax[0]&&maxY>=mapMax[1])break;continue}
let coords=[],minClear=Infinity,minBand=6,metres=0;for(const p of legs){for(const i of p){minClear=Math.min(minClear,g.dist[i]);minBand=Math.min(minBand,g.code[i])}const pts=smooth(g,p,soft);if(coords.length)pts.shift();coords.push(...pts)}for(let k=1;k<coords.length;k++)metres+=Math.hypot(coords[k][0]-coords[k-1][0],coords[k][1]-coords[k-1][1]);
// Points that are not in water deep enough (a pier in shallow water, a beach) are joined to the route through
// water shallower than requested, including areas that dry at low tide, away from land. That stretch is
// reported as shallow, never as safe.
let shallow=null;const access=xy.map((p,k)=>{const i=snapped[k],sx=g.minX+(i%g.cols+.5)*g.cell,sy=g.minY+(((i/g.cols)|0)+.5)*g.cell,d=Math.hypot(sx-p[0],sy-p[1]);if(d<=g.cell)return null;
if(!shallow)shallow=buildGrid([minX,minY,maxX,maxY],cell,2);const h2=cell,a=snap(shallow,p[0],p[1],h2,1500);let pts=null;if(a>=0){const path=k===0?astar(shallow,a,i,h2,h2*3,2):astar(shallow,i,a,h2,h2*3,2);if(path){pts=smooth(shallow,path,h2*3);if(k===0)pts.unshift(p);else pts.push(p)}}
if(!pts)pts=k===0?[p,[sx,sy]]:[[sx,sy],p];let len=0;for(let q=1;q<pts.length;q++)len+=Math.hypot(pts[q][0]-pts[q-1][0],pts[q][1]-pts[q-1][1]);const ll=toLL(p[0],p[1]);return{coords:pts.map(([x,y])=>toLL(x,y)),metres:Math.round(len),viaWater:a>=0&&pts.length>2,onLand:classAt(ll[0],ll[1])<=1}});
return{ok:true,coords:coords.map(([x,y])=>toLL(x,y)),nm:metres/1852,minClear:Math.round(minClear),minDepth:DEPTH_OF_CLASS[minBand],cell,access}}
return{ok:false,reason:'no-path'}}

// Translucent overlay of the areas the route must avoid for the chosen depth (every `step` mask cells).
function overlay(depth,step=2){if(!M)return null;const need=CLASS_FOR_DEPTH[depth]||4,w=Math.ceil(M.cols/step),h=Math.ceil(M.rows/step),px=new Uint8ClampedArray(w*h*4);for(let r=0;r<h;r++)for(let c=0;c<w;c++){const v=M.data[Math.min(M.rows-1,r*step)*M.cols+Math.min(M.cols-1,c*step)],o=((h-1-r)*w+c)*4;if(v===2||(v>=3&&v<need)){px[o]=226;px[o+1]=48;px[o+2]=48;px[o+3]=v===2?120:95}else if(v===need&&need<6){px[o]=246;px[o+1]=183;px[o+2]=60;px[o+3]=45}}const sw=toLL(M.minX,M.minY),ne=toLL(M.minX+M.cols*M.cell,M.minY+M.rows*M.cell);return{width:w,height:h,pixels:px,bounds:[sw,ne]}}

if(typeof module!=='undefined'&&module.exports)module.exports={load,plan,overlay,classAt,toXY,toLL};
else if(typeof self!=='undefined'&&typeof importScripts==='function')self.onmessage=async e=>{const m=e.data;try{if(m.type==='load'){const res=await fetch(m.url);if(!res.ok)throw new Error('HTTP '+res.status);self.postMessage({type:'reply',id:m.id,result:load(await res.arrayBuffer())})}else if(m.type==='plan')self.postMessage({type:'reply',id:m.id,result:plan(m.points,m.opt)});else if(m.type==='overlay'){const o=overlay(m.depth);self.postMessage({type:'reply',id:m.id,result:o},o?[o.pixels.buffer]:[])}else if(m.type==='classAt')self.postMessage({type:'reply',id:m.id,result:m.points.map(p=>classAt(p[0],p[1]))})}catch(err){self.postMessage({type:'reply',id:m.id,result:{ok:false,reason:'error',message:String(err&&err.message||err)}})}};
