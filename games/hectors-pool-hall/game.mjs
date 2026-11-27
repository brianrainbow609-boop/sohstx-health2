import {createRack,shoot,stepPhysics,isMoving,POCKETS,BALL_RADIUS,TABLE} from './pool.mjs';
import {chooseShot,DIFFICULTIES} from './opponent.mjs';
import {resolveEightBallShot,resolveRotationShot} from './rules.mjs';

import {resolveStraightPool,resolveCutthroat,cutthroatGroup} from './arcade-rules.mjs';

const $=id=>document.getElementById(id);
const hall=$('hall'),game=$('game'),canvas=$('table'),ctx=canvas.getContext('2d');
const status=$('status'),turnLabel=$('turn'),scoreLabel=$('score');
const modeNames={
 '8-ball':'Eight Ball','9-ball':'Nine Ball','10-ball':'Ten Ball',
 'straight-pool':'Straight Pool',cutthroat:'Cutthroat',practice:'Practice'
};
let mode='8-ball',balls=[],aim=null,turn='player',shooter='player',pocketedThisShot=[],score={player:0,computer:0},difficulty=1,aiPending=false,firstContact=null,ballInHandFor=null,groups={player:null,computer:null},lowestBallAtStart=null;
const power=$('power');
let rackGeneration=0;

function setStatus(value){status.textContent=value}
function setTurn(){turnLabel.textContent=turn==='over'?'Rack complete':mode==='practice'?'Practice':turn==='player'?'Your shot':turn==='computer2'?'Opponent 2 shooting':turn==='computer'?'Opponent shooting':'Balls moving'}
function canvasPoint(event){
 const rect=canvas.getBoundingClientRect();
 return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
}
function start(modeId){
 rackGeneration++;
 mode=modeId;balls=createRack(mode);score={player:0,computer:0,computer2:0};turn='player';shooter='player';pocketedThisShot=[];aim=null;aiPending=false;firstContact=null;ballInHandFor=null;groups={player:null,computer:null};lowestBallAtStart=null;$('called-pocket-wrap').hidden=mode!=='10-ball';
 hall.hidden=true;game.hidden=false;$('mode-title').textContent=modeNames[mode];
 $('opponent-name').textContent=$('opponent').selectedOptions[0].textContent;
 difficulty=Number($('difficulty').value);
 const portrait=document.querySelector('.score-panel img');
 const name=$('opponent').value;
 portrait.src=name==='Erasmo'?'assets/erasmo-idle.png':'assets/hector-idle.png';
 portrait.hidden=mode==='practice'||!['Hector','Erasmo'].includes(name);
 portrait.alt=name;
 setStatus(mode==='practice'?'Practice table ready. Drag from the cue ball to aim, then release.':'Rack ready. You break. Drag from the cue ball to aim, then release.');
 setTurn();updateScore();
}
function updateScore(){
 if(mode==='cutthroat'){
  scoreLabel.textContent=['player','computer','computer2'].map((p,i)=>['You','Opponent 1','Opponent 2'][i]+': '+balls.filter(b=>b.active&&cutthroatGroup(b.number)===p).length).join(' | ');
  return;
 }scoreLabel.textContent='You '+score.player+' — '+score.computer+' Opponent'}
function getLowestBall(){return Math.min(...balls.filter(b=>b.active&&b.number>0).map(b=>b.number));}
function aiEligibleNumbers(){
 if(mode==='cutthroat')return balls.filter(b=>b.active&&b.number>0&&cutthroatGroup(b.number)!==turn).map(b=>b.number);
 if(mode==='9-ball'||mode==='10-ball')return [getLowestBall()];
 if(mode==='8-ball'){
  const group=groups.computer;
  if(!group)return balls.filter(b=>b.active&&b.number>0&&b.number!==8).map(b=>b.number);
  const own=balls.filter(b=>b.active&&(group==='solids'?b.number>=1&&b.number<=7:b.number>=9&&b.number<=15)).map(b=>b.number);
  return own.length?own:[8];
 }
 return null;
}
function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#25180f';ctx.fillRect(0,0,1000,560);
 ctx.fillStyle='#7a4a27';ctx.fillRect(54,42,892,476);
 ctx.fillStyle='#12634a';ctx.fillRect(86,72,828,416);
 ctx.strokeStyle='#54a17b';ctx.lineWidth=3;ctx.strokeRect(108,98,784,364);
 for(const p of POCKETS){ctx.beginPath();ctx.fillStyle='#07100e';ctx.arc(p.x,p.y,25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b9874c';ctx.lineWidth=3;ctx.stroke();}
 ctx.fillStyle='#d8c59a';ctx.font='14px system-ui';ctx.fillText('SOH/STX • HECTOR’S POOL HALL',365,30);
 for(const b of balls){
  if(!b.active)continue;
  ctx.beginPath();ctx.fillStyle=b.number===0?'#fff8df':ballColor(b.number);ctx.arc(b.x,b.y,BALL_RADIUS,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#17231f';ctx.lineWidth=1.5;ctx.stroke();
  if(b.number){ctx.beginPath();ctx.fillStyle='#fff';ctx.arc(b.x,b.y,6.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17231f';ctx.font='bold 8px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(b.number),b.x,b.y+.4);}
 }
 if(aim&&turn==='player'&&!isMoving(balls)){
  const cue=balls.find(b=>b.number===0&&b.active);
  if(cue){ctx.beginPath();ctx.setLineDash([8,7]);ctx.strokeStyle='#f8e3a4';ctx.lineWidth=2;ctx.moveTo(cue.x,cue.y);ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);}
 }
}
function ballColor(n){
 const colors=['#e9c83e','#2868b4','#d94d3d','#75449b','#ef8733','#218b60','#9a3346','#16191a','#e9c83e','#2868b4','#d94d3d','#75449b','#ef8733','#218b60','#9a3346'];
 return colors[(n-1)%colors.length];
}
function finishShot(){
 const cuePocketed=pocketedThisShot.includes(0);
 const objectPockets=pocketedThisShot.filter(n=>n!==0);
 if(mode==='8-ball'){
  const result=resolveEightBallShot({shooter,firstContact,pocketed:pocketedThisShot,balls,groups});
  groups=result.groups;
  score[shooter]+=result.score;
  if(result.winner){
   setStatus((result.winner==='player'?'You win':'Opponent wins')+'! '+(result.winner===shooter?'Legal 8-ball.':'The 8-ball was pocketed illegally.') );
   turn='over';updateScore();setTurn();return;
  }
  if(cuePocketed){
   const cue=balls.find(b=>b.number===0);cue.active=true;cue.x=250;cue.y=280;cue.vx=cue.vy=0;
  }
  turn=result.turn;
  if(result.foul){
   ballInHandFor=turn;
   setStatus('Foul: '+result.reason+'. '+(turn==='player'?'Place the cue ball anywhere on the table.':'Opponent has ball in hand.'));
  }else{
   ballInHandFor=null;
   const group=groups[shooter];
   const assignment=group?' '+(shooter==='player'?'You':'Opponent')+' are '+group+'.':'';
   setStatus(result.reason==='legal pocket; shooter continues'
    ? (shooter==='player'?'You':'Opponent')+' pocketed a ball. Keep shooting.'+assignment
    : 'Turn passes. '+(turn==='player'?'Your shot.':'Opponent is lining up.')+assignment);
  }
  updateScore();setTurn();
  if(turn==='computer')scheduleAI();
  return;
 }
 if(mode==='9-ball'||mode==='10-ball'){
  const result=resolveRotationShot({
   mode,shooter,firstContact,pocketed:pocketedThisShot,
   lowestBallAtStart,balls,calledPocket:Number($('called-pocket').value)
  });
  score[shooter]+=result.score;
  if(result.respotted!==null){
   const ball=balls.find(b=>b.number===result.respotted);
   if(ball){ball.active=true;ball.x=620;ball.y=280;ball.vx=ball.vy=0;delete ball.pocketIndex;}
  }
  if(result.winner){
   setStatus((result.winner==='player'?'You win':'Opponent wins')+'! '+(mode==='9-ball'?'9-ball':'Called 10-ball')+' legally pocketed.');
   turn='over';updateScore();setTurn();return;
  }
  if(cuePocketed){
   const cue=balls.find(b=>b.number===0);cue.active=true;cue.x=250;cue.y=280;cue.vx=cue.vy=0;
  }
  turn=result.turn;
  if(result.foul){
   ballInHandFor=turn;
   setStatus('Foul: '+result.reason+'. '+(turn==='player'?'Place the cue ball anywhere on the table.':'Opponent has ball in hand.'));
  }else{
   ballInHandFor=null;
   setStatus(result.respotted!==null?'Called pocket missed. The 10-ball is spotted; turn passes.':result.reason+'. '+(turn==='player'?'Your shot.':'Opponent is lining up.'));
  }
  updateScore();setTurn();
  if(turn==='computer')scheduleAI();
  return;
 }
 if(mode==='straight-pool'||mode==='cutthroat'){
  const result=mode==='straight-pool'
   ? resolveStraightPool({shooter,firstContact,pocketed:pocketedThisShot,scores:score})
   : resolveCutthroat({shooter,firstContact,pocketed:pocketedThisShot,balls});
  if(result.scores)score=result.scores;
  if(cuePocketed){
   const cue=balls.find(b=>b.number===0);
   Object.assign(cue,{active:true,x:250,y:280,vx:0,vy:0});
  }
  turn=result.turn;
  if(result.winner){
   setStatus(result.winner==='player'?'You win!':result.winner==='computer2'?'Opponent 2 wins!':'Opponent 1 wins!');
  }else if(turn==='over'){
   setStatus('Rack complete.');
  }else{
   if(mode==='straight-pool'&&!balls.some(b=>b.active&&b.number>0))balls=createRack(mode);
   setStatus((result.foul?'Foul. ':'')+(turn==='player'?'Your shot.':turn==='computer2'?'Opponent 2 shoots.':'Opponent 1 shoots.'));
  }
  updateScore();setTurn();
  if(turn==='computer'||turn==='computer2')scheduleAI();
  return;
 }
 if(mode==='practice'&&!balls.some(b=>b.active&&b.number>0)){
  score.player+=objectPockets.length;
  balls=createRack(mode);turn='player';
  setStatus('Table cleared! New practice rack.');
  updateScore();setTurn();return;
 }
 const winningBall=null;
 if(winningBall!==null&&objectPockets.includes(winningBall)){
  setStatus((shooter==='player'?'You':'Opponent')+' pocketed the '+winningBall+' ball. Rack complete.');
  turn='over';setTurn();return;
 }
 if(cuePocketed){
  const cue=balls.find(b=>b.number===0);cue.active=true;cue.x=250;cue.y=280;cue.vx=cue.vy=0;
  if(mode==='practice'){
   setStatus('Scratch. Cue ball reset; practice continues.');turn='player';
  }else{
   setStatus((shooter==='player'?'Scratch. Opponent':'Opponent scratched. Your')+' turn.');
   turn=shooter==='player'?'computer':'player';
  }
 }else if(objectPockets.length){
  if(shooter==='player')score.player+=objectPockets.length;else score.computer+=objectPockets.length;
  setStatus((shooter==='player'?'You':'Opponent')+' pocketed '+objectPockets.length+'. '+(shooter==='player'?'Keep shooting.':'Opponent continues.'));
  turn=shooter;
 }else{
  turn=mode==='practice'?'player':shooter==='player'?'computer':'player';
  setStatus(turn==='player'?'Your turn.':'Opponent is lining up a shot.');
 }
 updateScore();setTurn();
 if(turn==='computer'&&mode!=='practice')scheduleAI();
}
function scheduleAI(){
 if(aiPending)return;aiPending=true;
 const generation=rackGeneration;
 window.setTimeout(()=>{
  if(generation!==rackGeneration)return;
  aiPending=false;
  if(!['computer','computer2'].includes(turn)||isMoving(balls))return;
  lowestBallAtStart=getLowestBall();
  const shot=chooseShot(balls,difficulty,Math.random,aiEligibleNumbers());
  if(!shot){turn='player';setTurn();return;}
  shooter=turn;pocketedThisShot=[];firstContact=null;if(ballInHandFor==='computer'){const cue=balls.find(b=>b.number===0);cue.x=250;cue.y=280;cue.vx=cue.vy=0;ballInHandFor=null;}if(mode==='10-ball')$('called-pocket').value=String(shot.pocketIndex);shoot(balls,shot,shot.power);turn='rolling';setStatus($('opponent').selectedOptions[0].textContent+' is shooting…');setTurn();
 },650);
}
canvas.addEventListener('pointerdown',event=>{
 if(turn!=='player'||isMoving(balls))return;
 const cue=balls.find(b=>b.number===0&&b.active),p=canvasPoint(event);
 if(ballInHandFor==='player'&&cue){
  cue.x=Math.max(TABLE.left+BALL_RADIUS,Math.min(TABLE.right-BALL_RADIUS,p.x));
  cue.y=Math.max(TABLE.top+BALL_RADIUS,Math.min(TABLE.bottom-BALL_RADIUS,p.y));
  cue.vx=cue.vy=0;ballInHandFor=null;setStatus('Cue ball placed. Drag from it to aim and shoot.');return;
 }
 if(cue&&Math.hypot(p.x-cue.x,p.y-cue.y)<58){canvas.setPointerCapture(event.pointerId);aim=p;}
});
canvas.addEventListener('pointermove',event=>{if(aim)aim=canvasPoint(event)});
canvas.addEventListener('pointerup',event=>{
 if(!aim)return;
 const p=canvasPoint(event);aim=null;shooter='player';pocketedThisShot=[];firstContact=null;lowestBallAtStart=getLowestBall();
 if(shoot(balls,p,Number(power.value)/100)){turn='rolling';setStatus('Shot taken.');setTurn();}
});
canvas.addEventListener('pointercancel',()=>{aim=null});
$('power').addEventListener('input',()=>{$('power-value').textContent=power.value+'%'});
$('back').addEventListener('click',()=>{rackGeneration++;aiPending=false;game.hidden=true;hall.hidden=false;turn='player';aim=null});
$('rack-again').addEventListener('click',()=>start(mode));
$('mode-grid').addEventListener('click',event=>{
 const button=event.target.closest('[data-mode]');if(button)start(button.dataset.mode);
});
$('difficulty').innerHTML=DIFFICULTIES.map((d,i)=>'<option value="'+i+'"'+(i===1?' selected':'')+'>'+d.name+'</option>').join('');
function frame(){
 const events=stepPhysics(balls);if(events.pocketed.length)pocketedThisShot.push(...events.pocketed);if(firstContact===null&&events.firstContact!==null)firstContact=events.firstContact;
 if(turn==='rolling'&&!isMoving(balls))finishShot();
 draw();requestAnimationFrame(frame);
}
setTurn();requestAnimationFrame(frame);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
