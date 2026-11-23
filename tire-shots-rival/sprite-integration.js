(()=>{'use strict';
const counts={Hector:{idle:4,walk:8,attack:6},Erasmo:{idle:4,walk:8,attack:6}};
const state={};const fallback={Hector:'🧢',Erasmo:'🧔'};
function nameFor(id){return document.getElementById(id==='myface'?'mine':'theirs')?.textContent?.trim()}
function stop(id){const x=state[id];if(x){clearInterval(x.timer);clearTimeout(x.reset)}delete state[id]}
function show(id,mode='idle'){
 const host=document.getElementById(id),name=nameFor(id);if(!host)return;
 const previous=state[id];if(previous&&previous.name===name&&previous.mode===mode)return;
 stop(id);if(!counts[name])return;
 const x={name,mode,frame:0,timer:null,reset:null};state[id]=x;
 const img=document.createElement('img');img.className='character-sprite';img.alt=name+' '+mode;img.decoding='async';
 const frame=()=>{if(state[id]!==x)return;const index=x.frame++%counts[name][mode];img.src='/tire-shots-rival/sprites/'+name.toLowerCase()+'-'+mode+'-'+String(index).padStart(2,'0')+'.png'};
 img.onerror=()=>{if(state[id]!==x)return;stop(id);host.textContent=fallback[name]};
 host.replaceChildren(img);frame();x.timer=setInterval(frame,mode==='attack'?110:mode==='walk'?140:230);
 if(mode==='attack')x.reset=setTimeout(()=>{if(state[id]===x)show(id,'idle')},counts[name].attack*110+80);
}
function refresh(){for(const id of ['myface','theirface']){const name=nameFor(id);if(!counts[name]){stop(id);continue}if(!state[id]||state[id].name!==name)show(id,'idle')}}
const observer=new MutationObserver(refresh);
for(const id of ['mine','theirs']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,characterData:true,subtree:true})}
document.getElementById('punch')?.addEventListener('click',()=>{show('myface','attack');show('theirface','attack')});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['BUTTON','SELECT','INPUT'].includes(document.activeElement?.tagName||'')){show('myface','attack');show('theirface','attack')}});
refresh();
})();