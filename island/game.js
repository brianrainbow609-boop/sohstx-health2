'use strict';
const $=id=>document.getElementById(id);
const stations=[[245,307],[622,301],[476,209],[434,386]];
const jobs=['foraging','hauling water','repairing','resting'];
const spells=[
 {name:'Spring rain',icon:'☂',detail:'Refill the spring',food:1,water:2.8,wear:1.2,cost:2},
 {name:'Fruit bloom',icon:'✿',detail:'Ripen the orchard',food:2.8,water:.8,wear:1,cost:2},
 {name:'Heat wave',icon:'☀',detail:'Dry up the spring',food:.5,water:.28,wear:1.4,cost:1},
 {name:'Gale',icon:'☁',detail:'Batter every shelter',food:.45,water:.75,wear:4,cost:1}];
const cap=x=>Math.max(0,Math.min(100,x));
const saveKey='sohstx-driftwood-1';
function newIsland(){return {time:0,food:64,water:65,shelter:72,vitality:92,energy:4,effect:-1,until:0,won:false,ended:false,paused:false,speed:1,logs:['Day 1 · The crew and both dogs make camp.'],people:Array.from({length:17},(_,i)=>({x:330+(i%6)*40,y:273+Math.floor(i/6)*39,job:i%4,work:0,dx:0,dy:0,face:1}))}}
let state=newIsland();
try{const v=JSON.parse(localStorage.getItem(saveKey));if(v?.people?.length===17 && Number.isFinite(v.time))state=v}catch{}
const day=()=>1+Math.floor(state.time/48);
const phase=()=>Math.floor(state.time%48/12);
function note(s){state.logs.unshift('Day '+day()+' · '+s);state.logs.length=Math.min(5,state.logs.length)}
function save(){try{localStorage.setItem(saveKey,JSON.stringify(state))}catch{}}
function assign(p,i){
 const needs=[82-state.food,82-state.water,80-state.shelter,phase()===3?58:12];
 if(i===10||i===11){needs[0]+=20;needs[2]=-99}
 needs[p.job]-=9;
 const scores=needs.map(n=>n+Math.random()*38);
 p.job=scores.indexOf(Math.max(...scores));p.work=0;
}
function tick(dt){
 if(state.ended||state.paused)return;
 const previous=day();state.time+=dt;
 if(state.effect>=0&&state.time>=state.until){state.effect=-1;note('Clear skies return.')}
 if(day()!==previous){
 if(day()===11&&!state.won){state.won=true;note('Ten days survived! The island continues in free play.')}
 else if(state.effect<0&&Math.random()<.48){state.effect=Math.random()<.5?2:3;state.until=state.time+12;note(spells[state.effect].name+' rolls across camp.')}
 else note('Dawn breaks. The crew checks the stores.');
 }
 const e=spells[state.effect]||{food:1,water:1,wear:1};
 const rates=[0,0,0,0];
 state.people.forEach((p,i)=>{
 const [x,y]=stations[p.job];const dx=x+(i%5-2)*18-p.x,dy=y+(Math.floor(i/5)-1)*14-p.y,d=Math.hypot(dx,dy);
 if(d>2){const step=Math.min(d,dt*(i===10||i===11?44:33));p.x+=dx/d*step;p.y+=dy/d*step;if(Math.abs(dx)>2)p.face=Math.sign(dx);p.dx=step}
 else{p.dx=0;rates[p.job]++;p.work+=dt;if(p.work>5+i%4)assign(p,i)}
 });
 state.food=cap(state.food+dt*(rates[0]*.34*e.food-.74));
 state.water=cap(state.water+dt*(rates[1]*.38*e.water-(state.effect===2?1.28:.78)));
 state.shelter=cap(state.shelter+dt*(rates[2]*.32-.40*e.wear));
 const poor=Math.min(state.food,state.water,state.shelter)<1;
 state.vitality=cap(state.vitality+dt*(poor?-1.25:.035+rates[3]*.028));
 state.energy=Math.min(6,state.energy+dt/11);
 if(state.vitality<=0){state.ended=true;note('The camp disperses. Its empty lodges fall quiet.');save()}
}
function cast(i){const p=spells[i];if(state.paused||state.ended||state.energy<p.cost)return;state.energy-=p.cost;state.effect=i;state.until=state.time+16;note(p.name+' reaches the whole island.');save();ui()}
for(const [i,p] of spells.entries()){const b=document.createElement('button');b.innerHTML=p.icon+' '+p.name+'<span>'+p.detail+' · '+p.cost+' energy</span>';b.onclick=()=>cast(i);$('powers').append(b)}
for(const key of ['food','water','shelter','vitality'])$('stats').insertAdjacentHTML('beforeend','<div class="stat"><small>'+key.toUpperCase()+'</small><strong id="'+key+'"></strong><div class="track"><i id="'+key+'bar"></i></div></div>');
function ui(){
 $('day').textContent='Day '+day();$('phase').textContent=['DAWN','MIDDAY','DUSK','NIGHT'][phase()];
 $('weather').textContent=state.ended?'Camp abandoned':state.effect<0?'☀ Clear skies':spells[state.effect].icon+' '+spells[state.effect].name+' · '+Math.ceil(state.until-state.time)+'s';
 for(const k of ['food','water','shelter','vitality']){$(k).textContent=Math.round(state[k]);$(k+'bar').style.width=state[k]+'%';$(k+'bar').style.background=state[k]<25?'#bd5840':''}
 $('charge').textContent='✦ '+Math.floor(state.energy)+' / 6 energy';
 Array.from($('powers').children).forEach((b,i)=>b.disabled=state.ended||state.paused||state.energy<spells[i].cost);
 $('crew').textContent=state.ended?'Camp dispersed':'15 islanders · 2 dogs';
 $('journal').replaceChildren(...state.logs.map(s=>Object.assign(document.createElement('li'),{textContent:s})));
 $('pause').textContent=state.paused?'▶':'Ⅱ';$('pause').ariaLabel=state.paused?'Resume simulation':'Pause simulation';$('speed').textContent=state.speed+'×';$('restart').hidden=!state.ended;
}
$('pause').onclick=()=>{state.paused=!state.paused;save();ui()};
$('speed').onclick=()=>{state.speed=state.speed===4?1:state.speed*2;save();ui()};
$('restart').onclick=()=>{state=newIsland();save();ui()};
window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
ui();
