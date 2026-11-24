'use strict';
const Dungeon = (() => {
 const W=15,H=9,T=24,Y=16;
 const crew=['Hector','Erasmo',...Array.from({length:17},(_,i)=>i===10?'Island dog 1':i===11?'Island dog 2':'Driftwood '+(i+1))];
 const bestiary=['Crystal Basilisk','Ember Griffin','Rune Gargoyle',...['Orc Disaster','Dwarven Gate Colossus','Veldora’s Storm Echo']];
 const signs={fight:['DEN','#fc977c'],cache:['VAULT','#ffd57d'],altar:['SPRING','#97eeef'],shop:['FORGE','#ffc58b'],boss:['GATE','#d7a7ff']};
 const palettes=[['#182a30','#2c4546','#344f50','#446768','#83efda'],['#222531','#3c3c4b','#454555','#636078','#dbb6f1'],['#211f30','#3f3549','#493c50','#665465','#ffa478']];
 let canvas,ctx,api,run,hero,mode,stamp,phase,trail=[],steps=[],doors=[],target=null,hit=null,face=1,last=0;
 let pos={x:7,y:7},walls=new Set(),images={};
 const hash=(x,y)=>y*W+x;
 const center=(x,y)=>[(x+.5)*T,Y+(y+.5)*T];
 function build(){
  walls=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   if(!x||!y||x===W-1||y===H-1)walls.add(hash(x,y));
  }
  const n=(run?.step||0)+(run?.zone||0);
  for(const x of [3,11])for(const y of [3,4,5])if((x+y+n)%4!==0)walls.add(hash(x,y));
  if(n%2)walls.add(hash(7,3));
  const opts=mode==='route'?[...new Set(run.map[run.step])]:[];
  doors=opts.map((kind,i)=>({kind,x:opts.length===1?7:i?11:3,y:1}));
 }
 function open(x,y){return x>0&&y>0&&x<W-1&&y<H-1&&!walls.has(hash(x,y));}
 function path(x,y){
  if(!open(x,y))return null;
  const start={x:Math.round(pos.x),y:Math.round(pos.y)},queue=[start],prev=new Map([[hash(start.x,start.y),null]]);
  for(let i=0;i<queue.length;i++){
   const p=queue[i];
   if(p.x===x&&p.y===y){const out=[];let at=p;while(prev.get(hash(at.x,at.y))){out.unshift(at);at=prev.get(hash(at.x,at.y));}return out;}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const a=p.x+dx,b=p.y+dy,k=hash(a,b);if(open(a,b)&&!prev.has(k)){prev.set(k,p);queue.push({x:a,y:b});}
   }
  }return null;
 }
 function walk(x,y,door){
  if(mode!=='route'||hit)return;
  const list=path(x,y);if(!list)return;
  steps=list;target=door||doors.find(d=>d.x===x&&d.y===y);if(!steps.length)arrive();
 }
 function arrive(){if(target){const k=target.kind;target=null;api.enter(k);}}
 function go(kind){const d=doors.find(v=>v.kind===kind);if(d)walk(d.x,d.y,d);}
 function attack(move){
  if(hit||!['fight','boss'].includes(mode)||!api.canFight(move))return;
  hit={move,t:0,retaliates:true};document.getElementById('actions').inert=true;
 }
 function sync(r,name){
  run=r;hero=crew.includes(name)?name:'Hector';document.getElementById('delver').value=hero;
  mode=r?.mode||'home';const k=[mode,r?.zone,r?.step].join('/');
  if(stamp!==k){stamp=k;steps=[];target=null;hit=null;phase=0;build();
   pos=mode==='route'&&open(r.tile?.x,r.tile?.y)&&Number.isInteger(r.tile?.x)&&Number.isInteger(r.tile?.y)?{...r.tile}:mode==='route'?{x:7,y:7}:{x:5,y:5};trail=[];}
 }
 function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
 function floor(t){
  const p=palettes[run?.zone||0];rect(0,0,360,232,'#0c1720');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const xx=x*T,yy=Y+y*T,k=hash(x,y),v=(x*31+y*47+x*y)%17;
   if(walls.has(k)){
    rect(xx,yy,T,T,'#101c23');rect(xx+1,yy+1,22,14,p[3]);rect(xx+2,yy+2,20,2,'#748187');rect(xx+2,yy+5,20,8,p[2]);rect(xx+2,yy+16,20,5,p[0]);rect(xx+11,yy+5,1,8,p[0]);
    if((x===3||x===11)&&y===4){rect(xx+8,yy+9,7,6,'#af8051');rect(xx+9,yy+4,5,7,'#ffb65f');rect(xx+11,yy+2+Math.floor(t*6)%2,2,7,'#ffedb1');}
   }else{
    rect(xx,yy,T,T,p[0]);rect(xx+1,yy+1,23,23,v%4?p[1]:p[2]);rect(xx+2,yy+2,20,1,p[2]);if(v<8){rect(xx+v+2,yy+7+v,4,1,p[0]);rect(xx+v+5,yy+8+v,2,1,p[0]);}
   }
  }
  for(const d of doors){const [x,y]=center(d.x,d.y),[caption,color]=signs[d.kind];rect(x-12,y-7,24,16,'#121d28');for(let j=0;j<3;j++)rect(x-9+j,y+5-j*3,18-2*j,1,color);
   ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(caption,x,y+19);}
  for(const point of steps.filter((_,i)=>i%2===0)){const [x,y]=center(point.x,point.y);rect(x-1,y-1,3,3,'#84ada6');}
 }
 function sprite(img,sx,sy,size,x,y,dest,flip=1){if(!img?.naturalWidth)return;ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(flip,1);ctx.drawImage(img,sx,sy,size,size,-dest/2,-dest+8,dest,dest);ctx.restore();}
 function paint(t){
  floor(t);let [px,py]=center(pos.x,pos.y);const combat=mode==='boss'||mode==='fight',e=run?.enemy;
  const progress=hit?Math.min(1,hit.t/.68):0;
  let [ex,ey]=center(9,4);const ox=px,oy=py;
  if(hit){const lunge=Math.sin(Math.PI*Math.min(1,progress*2));if(['strike','feed'].includes(hit.move)){px+=(ex-px-18)*lunge;py+=(ey-py)*lunge;}
   if(progress>.53&&hit.retaliates){const rush=Math.sin(Math.PI*(progress-.53)/.47);ex-=(ex-ox-22)*rush;ey+=(oy-ey)*rush;}}
  if(e&&(combat||mode==='lost')){
   const i=Math.max(0,bestiary.indexOf(e.name)),s=mode==='boss'?66:50;
   sprite(images.monsters,(i%3)*96,Math.floor(i/3)*96,96,ex,ey+Math.sin(t*3)*1.5,s);
   rect(ex-14,ey-s+9,28,3,'#1b151c');rect(ex-14,ey-s+9,Math.ceil(28*e.hp/e.max),3,'#ff9e86');
  }
  if(!combat&&mode!=='lost'){
   let obj={cache:'◆',shop:'⚒',altar:'✦',won:'✧'}[mode];
   if(obj){ctx.font='24px serif';ctx.textAlign='center';ctx.fillStyle='#ffd78a';ctx.fillText(obj,210,110);}
  }
  const walking=steps.length>0,row=hit?2:walking?1:0;
  const frame=hit?Math.min(5,Math.floor(progress*6)):Math.floor(t*(walking?9:4))%(walking?8:4);
  const n=crew.indexOf(hero);rect(px-9,py+5,18,3,'#18272e');
  if(n<2)sprite(images[hero],frame*64,row*64,64,px,py,47,combat?1:face);
  else sprite(images.crew,(walking||hit?frame%4:0)*48,(n-2)*48,48,px,py,44,combat?1:face);
  if(!combat&&mode==='route'&&trail.length){
   const q=trail[Math.max(0,trail.length-4)],[cx,cy]=center(q.x,q.y);
   const ally=(run.zone*5+run.step)%17;sprite(images.crew,(walking?frame%4:0)*48,ally*48,48,cx-8,cy+8,31,face);
  }
  if(hit&&progress>.18&&progress<.65){
   const color={blade:'#9cf4ff',feed:'#d1a0ff',strike:'#ffe3aa',guard:'#a4e9d3',potion:'#fbabbb'}[hit.move];
   ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
   if(['guard','potion'].includes(hit.move)){ctx.arc(ox,oy-10,15,0,Math.PI*2);}
   else{const f=Math.min(1,(progress-.18)*3.1),x=ox+(ex-ox)*f,y=oy+(ey-oy)*f;ctx.moveTo(x-8,y+3);ctx.lineTo(x+7,y-12);}ctx.stroke();
  }
 }
 function loop(now){
  const dt=Math.min(.07,(now-last)/1000);last=now;phase+=dt;
  if(!document.hidden&&!document.querySelector('dialog[open]')){
   if(steps.length){const q=steps[0],dx=q.x-pos.x,dy=q.y-pos.y,d=Math.hypot(dx,dy),s=dt*7;if(dx)face=Math.sign(dx);
    if(d<=s){pos={...q};steps.shift();trail.push({...q});if(trail.length>6)trail.shift();run.tile={...q};api.persist();if(!steps.length)arrive();}
    else{pos.x+=s*dx/d;pos.y+=s*dy/d;}}
   if(hit){hit.t+=dt;if(hit.t>=.68){const move=hit.move;hit=null;document.getElementById('actions').inert=false;api.fight(move);}}
   paint(now/1000);
  }
  requestAnimationFrame(loop);
 }
 function init(callbacks){
  api=callbacks;canvas=document.getElementById('actors');ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  for(const [name,file] of Object.entries({Hector:'hector',Erasmo:'erasmo',crew:'crew',monsters:'monsters'})){const im=new Image();im.src=file+'.webp';images[name]=im;}
  const sel=document.getElementById('delver');for(const name of crew)sel.add(new Option(name,name));sel.onchange=()=>api.select(sel.value);
  canvas.addEventListener('pointerdown',ev=>{const b=canvas.getBoundingClientRect();const x=Math.floor((ev.clientX-b.left)*360/b.width/T),y=Math.floor(((ev.clientY-b.top)*232/b.height-Y)/T);
   canvas.focus({preventScroll:true});if(mode==='route')walk(x,y);else if(['fight','boss'].includes(mode)&&Math.abs(x-9)<=1&&Math.abs(y-4)<=1)attack('strike');});
  const keys={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
  document.addEventListener('keydown',ev=>{if(document.querySelector('dialog[open]')||['SELECT','INPUT'].includes(ev.target.tagName)||mode!=='route'||!keys[ev.key])return;
   ev.preventDefault();if(steps.length)return;const [dx,dy]=keys[ev.key];walk(pos.x+dx,pos.y+dy);});
  requestAnimationFrame(loop);
 }
 return {init,sync,go,attack};
})();
