'use strict';
const $ = id => document.getElementById(id);
const roll = n => Math.floor(Math.random()*n);
const pick = list => list[roll(list.length)];
const key = 'sohstx.tempest-delver.v1';
const lands = ['Jura Crystal Caverns','Dwargon Underkeep','Storm Dragon Castle'];
const beasts = [['Crystal Basilisk','Rune Gargoyle'],['Ember Griffin','Rune Gargoyle'],['Crystal Basilisk','Ember Griffin','Rune Gargoyle']];
const lords = ['Orc Disaster','Dwarven Gate Colossus','Veldora’s Storm Echo'];
const traits = [
 ['Analyze','Strike deals 2 extra damage.',8,-1],
 ['Sage Circuit','Water Blade costs 1 less magicule.',14,0],
 ['Universal Thread','Predator restores 3 extra HP.',14,0],
 ['Raphael','Gain 2 magicules after each victory.',24,1],
 ['Infinite Regeneration','Recover 4 HP after each victory.',24,2]
];
let state = {gems:0, traits:[], run:null, wins:0};
try {const old=JSON.parse(localStorage.getItem(key)); if(old && Array.isArray(old.traits) && Number.isFinite(old.gems)) state=old;} catch {}
let message='', storageOK=true;
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{storageOK=false;}}
function has(i){return state.traits.includes(i);}
function route(){
 return [['fight','cache'],[pick(['altar','fight']),'shop'],[pick(['cache','fight']),pick(['altar','fight'])],['shop','fight'],['boss']].map(pair=>Math.random()<.5?pair.reverse():pair);
}
function start(){
 state.run={zone:0,step:0,hp:40,mp:7,max:40,power:0,armor:0,potions:1,mode:'route',map:route(),enemy:null};
 message='Great Sage has charted a new route.'; update();
}
function restore(hp,mp){const r=state.run;r.hp=Math.min(r.max,r.hp+hp);r.mp=Math.min(9,r.mp+mp);}
function next(){
 const r=state.run;delete r.tile;r.step++;r.mode='route';r.enemy=null;
 if(r.step===5){if(r.zone===2){r.mode='won';state.wins++;}else{r.zone++;r.step=0;r.map=route();restore(12,4);message+=' Recovered 12 HP and 4 magicules at camp.';}}
}
function enter(kind){
 const r=state.run;message='';r.mode=kind;
 if(kind==='fight'||kind==='boss'){const boss=kind==='boss', hp=(boss?21:9)+r.zone*(boss?8:4)+roll(4);r.enemy={name:boss?lords[r.zone]:pick(beasts[r.zone]),hp,max:hp,turn:1};}
 update();
}
function incoming(){const r=state.run,e=r.enemy;return 3+r.zone+(r.mode==='boss'?1:0)+(e.turn%3===0?4:0);}
function fight(move){
 const r=state.run,e=r.enemy, cost=move==='blade'?(has(1)?2:3):move==='feed'?2:0;
 if(r.mp<cost)return;
 r.mp-=cost;
 let damage=0;
 if(move==='strike'){damage=5+r.power+(has(0)?2:0)+roll(3);restore(0,1);}
 if(move==='blade')damage=11+r.power+roll(3);
 if(move==='feed'){damage=4+r.power;restore(has(2)?8:5,0);}
 if(move==='guard')restore(0,3);
 if(move==='potion'){if(!r.potions)return;r.potions--;restore(18,0);}
 e.hp-=damage;
 message=damage?'Dealt '+damage+' damage. ':move==='guard'?'Guarded and gathered magicules. ':'Used a healing draught. ';
 if(e.hp<=0){
  const gems=(r.mode==='boss'?10:4)+r.zone+roll(3);state.gems+=gems;message=e.name+' defeated. +'+gems+' gems.';restore(has(4)?4:0,has(3)?2:0);next();
 }else{
  const hit=Math.max(0,incoming()-r.armor-(move==='guard'?8:0));r.hp=Math.max(0,r.hp-hit);e.turn++;
  message+='Took '+hit+' damage.';if(r.hp===0)r.mode='lost';
 }
 update();
}
function button(parent,label,fn,disabled=false,detail=''){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;
 if(detail){const s=document.createElement('small');s.textContent=detail;b.append(s);}b.onclick=fn;parent.append(b);
}
const names={fight:'Monster den',cache:'Treasure vault',shop:'Kaijin’s store',altar:'Spirit spring',boss:'Castle gate'};
function render(){
 const r=state.run, z=r?.zone||0, mode=r?.mode||'home', a=$('actions');a.replaceChildren();Dungeon.sync(r, state.avatar || 'Hector');
 $('area').textContent=lands[z];$('stats').textContent=(r?'HP '+r.hp+'/'+r.max+'   ·   Magicules '+r.mp+'/9   ·   ':'')+'◆ '+state.gems+' gems'+(r?'   ·   Draughts '+r.potions:'');
 $('path').replaceChildren();
 if(r)for(let i=0;i<5;i++){const el=document.createElement('i');if(i<=r.step)el.className='done';$('path').append(el);}
 function copy(title,story){$('title').textContent=title;$('story').textContent=story;}
 const act=(label,fn,off)=>button(a,label,fn,off);
 if(mode==='home'){copy('The labyrinth awaits','Guide Rimuru through Jura’s caverns and two castle strongholds. Choose your rooms, absorb monsters and carry gems into your next life.');act('Enter the labyrinth',start);}
 if(mode==='route'){
  copy('Choose your passage','Depth '+(z+1)+' of 3 · Chamber '+(r.step+1)+' of 5. '+(r.step===4?'A guardian blocks the way forward.':'Great Sage senses '+[...new Set(r.map[r.step])].map(k=>({fight:'a hostile aura',cache:'buried treasure',shop:'a merchant',altar:'healing water'})[k]).join(' and ')+'.'));
  for(const k of new Set(r.map[r.step])) act(names[k],()=>Dungeon.go(k));
  if(r.potions && r.hp<r.max)act('Drink draught (+18 HP)',()=>{r.potions--;restore(18,0);message='Drank a healing draught.';update();});
 }
 if(mode==='fight'||mode==='boss'){
  const e=r.enemy;copy(e.name,(mode==='boss'?'Guardian':'Monster')+' · '+e.hp+'/'+e.max+' HP. '+(e.turn%3===0?'Charging a heavy blow':'Preparing a strike')+' for '+Math.max(0,incoming()-r.armor)+' damage.');
  act('Strike · +1 MP',()=>Dungeon.attack('strike'));act('Water Blade · '+(has(1)?2:3)+' MP',()=>Dungeon.attack('blade'),r.mp<(has(1)?2:3));
  act('Predator · 2 MP',()=>Dungeon.attack('feed'),r.mp<2);act('Guard · +3 MP',()=>Dungeon.attack('guard'));act('Draught · +18 HP',()=>Dungeon.attack('potion'),!r.potions||r.hp===r.max);
 }
 function finish(txt){message=txt;next();update();}
 if(mode==='cache'){
  copy('A sealed treasure vault','Choose what to carry out of the vault.');act('Take magic gems',()=>{const n=5+roll(5);state.gems+=n;finish('Found '+n+' gems.');});act('Take a draught',()=>{r.potions++;finish('Packed a healing draught.');});
 }
 if(mode==='altar'){
  copy('Spirit spring','A current of magicules pools beneath the stone. Draw from one stream.');act('Recover 15 HP',()=>{restore(15,0);finish('The spring restored your vitality.');});act('Refill magicules',()=>{restore(0,9);finish('Magicules replenished.');});
 }
 if(mode==='shop'){
  copy('Kaijin’s traveling forge','Gear lasts for this expedition. Your blade has +'+r.power+' attack and your armor blocks '+r.armor+' damage.');
  function buy(label,cost,apply){act(label+' · '+cost+' ◆',()=>{if(state.gems<cost)return;state.gems-=cost;apply();message='Purchased '+label+'.';update();},state.gems<cost);}
  buy('Draught',3,()=>r.potions++);buy('Blade +2',7,()=>r.power+=2);buy('Armor +1',6,()=>r.armor++);act('Leave store',()=>finish('Left the forge.'));
 }
 if(mode==='lost'||mode==='won'){
  copy(mode==='won'?'The storm seal breaks':'Time to reincarnate', mode==='won'?'Veldora recognizes Rimuru’s strength. All three guardians have fallen.':'Rimuru dissolves into magicules. Your gems and researched traits pass to the next incarnation.');act('Start a new expedition',start);act('Open evolution tree',openTree);
 }
 $('report').textContent=message+(storageOK?'':' Progress cannot be saved in this browser.');
}
function update(){save();render();}
function renderTree(){
 const list=$('traits');list.replaceChildren();
 traits.forEach(([name,description,cost,parent],i)=>{
  const owned=has(i),locked=parent>=0&&!has(parent);
  button(list,name+(owned?' · Learned':' · '+cost+' ◆'),()=>{if(has(i)||state.gems<cost||(parent>=0&&!has(parent)))return;state.gems-=cost;state.traits.push(i);message='Learned '+name+'.';update();renderTree();},owned||locked||state.gems<cost,description+(locked?' Requires '+traits[parent][0]+'.':''));
 });
}
function openTree(){renderTree();$('tree').showModal();}
Dungeon.init({
 enter, fight, persist:save,
 select(name){state.avatar=name;update();},
 canFight(move){return state.run?.enemy && (move!=='blade'||state.run.mp>=(has(1)?2:3)) && (move!=='feed'||state.run.mp>=2) && (move!=='potion'||state.run.potions>0);}
});
$('research').onclick=openTree;$('close').onclick=()=>$('tree').close();render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
