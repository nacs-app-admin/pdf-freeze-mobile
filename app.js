import * as pdfjsLib from './pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc='./pdfjs/pdf.worker.mjs';
const $=s=>document.querySelector(s),file=$('#file'),canvas=$('#pdf'),scroll=$('#scroll'),wrap=$('#pageWrap'),capture=$('#capture');
const panes={top:$('#top'),left:$('#left'),corner:$('#corner'),body:$('#body')};
let pdf=null,page=1,scale=1,fileKey='',mode=null,freeze=null,pending=null,pageW=0,pageH=0,raf=0;
const dpr=()=>Math.min(devicePixelRatio||1,2.5);
function geom(){const sr=scroll.getBoundingClientRect(),cr=canvas.getBoundingClientRect();return{sx:Math.max(0,sr.left-cr.left),sy:Math.max(0,sr.top-cr.top),ax:Math.max(0,cr.left-sr.left),ay:Math.max(0,cr.top-sr.top)}}
async function openPdf(f){if(!f)return;const data=new Uint8Array(await f.arrayBuffer());pdf=await pdfjsLib.getDocument({data}).promise;fileKey=`${f.name}|${f.size}|${f.lastModified}`;page=1;scale=innerWidth<600?1:1.25;$('#empty').style.display='none';scroll.scrollTo(0,0);await render()}
async function render(){if(!pdf)return;const p=await pdf.getPage(page),v=p.getViewport({scale}),r=dpr();pageW=v.width;pageH=v.height;canvas.width=Math.round(pageW*r);canvas.height=Math.round(pageH*r);canvas.style.width=pageW+'px';canvas.style.height=pageH+'px';wrap.style.width=pageW+'px';wrap.style.height=pageH+'px';const c=canvas.getContext('2d',{alpha:false});await p.render({canvasContext:c,viewport:v,transform:r===1?null:[r,0,0,r,0,0]}).promise;$('#page').textContent=`${page}/${pdf.numPages}`;$('#zoom').textContent=Math.round(scale*100)+'%';restore();apply()}
function key(){return`pdf-freeze-mobile:${fileKey}:p${page}`}
function save(){if(!freeze)return;localStorage.setItem(key(),JSON.stringify({mode:freeze.mode,x:freeze.x/pageW,y:freeze.y/pageH,ox:freeze.ox/pageW,oy:freeze.oy/pageH,ax:freeze.ax,ay:freeze.ay}))}
function restore(){try{const o=JSON.parse(localStorage.getItem(key())||'null');freeze=o?{mode:o.mode,x:o.x*pageW,y:o.y*pageH,ox:o.ox*pageW,oy:o.oy*pageH,ax:o.ax||0,ay:o.ay||0}:null}catch{freeze=null}}
function setup(p,w,h,l,t){if(w<1||h<1){p.style.display='none';return}const r=dpr();p.width=Math.round(w*r);p.height=Math.round(h*r);p.style.width=w+'px';p.style.height=h+'px';p.style.left=l+'px';p.style.top=t+'px';p.style.display='block'}
function crop(p,sx,sy,w,h){const r=dpr(),c=p.getContext('2d',{alpha:false});c.fillStyle='#fff';c.fillRect(0,0,p.width,p.height);w=Math.min(w,pageW-sx);h=Math.min(h,pageH-sy);if(w>0&&h>0)c.drawImage(canvas,sx*r,sy*r,w*r,h*r,0,0,w*r,h*r)}
function apply(){Object.values(panes).forEach(p=>p.style.display='none');canvas.style.visibility='visible';if(!freeze)return;const vw=scroll.clientWidth,vh=scroll.clientHeight,fw=freeze.mode==='top'?0:freeze.x-freeze.ox,fh=freeze.mode==='left'?0:freeze.y-freeze.oy,ax=freeze.ax,ay=freeze.ay;canvas.style.visibility='hidden';setup(panes.body,vw-ax-fw,vh-ay-fh,ax+fw,ay+fh);if(freeze.mode==='top')setup(panes.top,vw-ax,fh,ax,ay);if(freeze.mode==='left')setup(panes.left,fw,vh-ay,ax,ay);if(freeze.mode==='both'){setup(panes.corner,fw,fh,ax,ay);setup(panes.top,vw-ax-fw,fh,ax+fw,ay);setup(panes.left,fw,vh-ay-fh,ax,ay+fh)}redraw()}
function redraw(){if(!freeze)return;const g=geom(),fw=freeze.mode==='top'?0:freeze.x-freeze.ox,fh=freeze.mode==='left'?0:freeze.y-freeze.oy;if(panes.body.style.display!=='none')crop(panes.body,g.sx+fw,g.sy+fh,panes.body.clientWidth,panes.body.clientHeight);if(panes.top.style.display!=='none')crop(panes.top,g.sx+fw,freeze.oy,panes.top.clientWidth,fh);if(panes.left.style.display!=='none')crop(panes.left,freeze.ox,g.sy+fh,fw,panes.left.clientHeight);if(panes.corner.style.display!=='none')crop(panes.corner,freeze.ox,freeze.oy,fw,fh)}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;redraw()})}
function point(e){const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e.changedTouches?.[0]||e;const isTouch=!!(e.touches||e.changedTouches);const fingerOffset=isTouch?48:0;return{x:Math.max(0,Math.min(r.width,p.clientX-r.left)),y:Math.max(0,Math.min(r.height,p.clientY-r.top-fingerOffset))}}
function choose(m){mode=m;pending=null;$('#panel').hidden=true;capture.hidden=false;$('#guide').style.display='block';$('#confirmBar').hidden=true;$('#touchHint').hidden=false;document.body.classList.add('selecting')}
function showGuide(e){if(!mode)return;e.preventDefault();e.stopPropagation();const p=point(e);pending=p;$('#guide i').style.top=p.y+'px';$('#guide b').style.left=p.x+'px';$('#guide em').style.left=p.x+'px';$('#guide em').style.top=p.y+'px';$('#confirmBar').hidden=false}
function confirm(){if(!mode||!pending)return;const g=geom();freeze={mode,x:mode==='top'?0:pending.x,y:mode==='left'?0:pending.y,ox:mode==='top'?0:g.sx,oy:mode==='left'?0:g.sy,ax:mode==='top'?0:g.ax,ay:mode==='left'?0:g.ay};mode=null;pending=null;capture.hidden=true;$('#guide').style.display='none';$('#confirmBar').hidden=true;$('#touchHint').hidden=true;document.body.classList.remove('selecting');save();apply()}
async function zoom(d){if(!pdf)return;const old=scale,l=scroll.scrollLeft,t=scroll.scrollTop,f=freeze?{mode:freeze.mode,x:freeze.x/pageW,y:freeze.y/pageH,ox:freeze.ox/pageW,oy:freeze.oy/pageH,ax:freeze.ax,ay:freeze.ay}:null;scale=Math.max(.5,Math.min(4,scale+d));await render();if(f){freeze={mode:f.mode,x:f.x*pageW,y:f.y*pageH,ox:f.ox*pageW,oy:f.oy*pageH,ax:f.ax,ay:f.ay};save();apply()}scroll.scrollLeft=l*(scale/old);scroll.scrollTop=t*(scale/old);schedule()}
$('#open').onclick=()=>file.click();file.onchange=()=>openPdf(file.files[0]);$('#menu').onclick=()=>$('#panel').hidden=!$('#panel').hidden;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>choose(b.dataset.mode));$('#confirmFix').onclick=confirm;capture.addEventListener('touchstart',showGuide,{passive:false});capture.addEventListener('touchmove',showGuide,{passive:false});capture.addEventListener('mousedown',showGuide);capture.addEventListener('mousemove',e=>{if(e.buttons)showGuide(e)});$('#clear').onclick=()=>{freeze=null;mode=null;pending=null;capture.hidden=true;$('#guide').style.display='none';$('#confirmBar').hidden=true;$('#touchHint').hidden=true;document.body.classList.remove('selecting');localStorage.removeItem(key());canvas.style.visibility='visible';apply();$('#panel').hidden=true};$('#prev').onclick=async()=>{if(pdf&&page>1){page--;scroll.scrollTo(0,0);await render()}};$('#next').onclick=async()=>{if(pdf&&page<pdf.numPages){page++;scroll.scrollTo(0,0);await render()}};$('#minus').onclick=()=>zoom(-.25);$('#plus').onclick=()=>zoom(.25);scroll.addEventListener('scroll',schedule,{passive:true});addEventListener('resize',apply);if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');


function syncVisualViewport(){
  const vv=window.visualViewport;
  const left=vv?vv.offsetLeft:0,top=vv?vv.offsetTop:0,width=vv?vv.width:window.innerWidth;
  document.documentElement.style.setProperty('--vv-left',left+'px');
  document.documentElement.style.setProperty('--vv-top',top+'px');
  document.documentElement.style.setProperty('--vv-width',width+'px');
  apply();
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',syncVisualViewport);
  window.visualViewport.addEventListener('scroll',syncVisualViewport);
}
window.addEventListener('orientationchange',()=>setTimeout(syncVisualViewport,250));
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturechange',e=>e.preventDefault(),{passive:false});
document.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
syncVisualViewport();
