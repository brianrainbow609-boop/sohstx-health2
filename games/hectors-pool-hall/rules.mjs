const other=player=>player==='player'?'computer':'player';
const groupOf=number=>number>=1&&number<=7?'solids':number>=9&&number<=15?'stripes':null;

export function resolveEightBallShot({shooter,firstContact,pocketed=[],balls=[],groups={player:null,computer:null}}){
 if(!['player','computer'].includes(shooter))throw Error('Invalid shooter');
 if(!Array.isArray(pocketed)||!Array.isArray(balls))throw Error('Invalid shot evidence');
 const nextGroups={player:groups.player??null,computer:groups.computer??null};
 const opponent=other(shooter);
 const objects=pocketed.filter(n=>Number.isInteger(n)&&n>0);
 const scratch=pocketed.includes(0);
 const own=nextGroups[shooter];
 const remainingOwn=own?balls.filter(b=>b.active&&groupOf(b.number)===own).length:0;
 const legalFirst=firstContact!==null&&(
  own
   ? firstContact===8?remainingOwn===0:groupOf(firstContact)===own
   : firstContact!==8&&groupOf(firstContact)!==null
 );
 const foul=scratch||!legalFirst;
 if(objects.includes(8)){
  const won=!foul&&Boolean(own)&&remainingOwn===0;
  return {
   groups:nextGroups,score:objects.length,turn:'over',
   winner:won?shooter:opponent,foul,
   reason:scratch?'cue ball scratched':!legalFirst?'wrong first contact':'8-ball pocketed before clearing the group'
  };
 }
 if(foul){
  return {
   groups:nextGroups,score:0,turn:opponent,winner:null,foul:true,
   reason:scratch?'cue ball scratched':firstContact===null?'no object ball contacted':'wrong first contact'
  };
 }
 if(!own){
  const firstPocketed=objects.find(n=>groupOf(n)!==null);
  if(firstPocketed){
   nextGroups[shooter]=groupOf(firstPocketed);
   nextGroups[opponent]=nextGroups[shooter]==='solids'?'stripes':'solids';
  }
 }
 const assigned=nextGroups[shooter];
 const keep=assigned
  ? objects.some(n=>groupOf(n)===assigned)
  : objects.length>0;
 return {
  groups:nextGroups,score:objects.length,turn:keep?shooter:opponent,
  winner:null,foul:false,
  reason:keep?'legal pocket; shooter continues':'no legal group pocketed; turn passes'
 };
}

export function resolveRotationShot({mode,shooter,firstContact,pocketed=[],lowestBallAtStart,balls=[],calledPocket=null}){
 if(!['9-ball','10-ball'].includes(mode)||!['player','computer'].includes(shooter))
  throw Error('Invalid rotation-game state');
 const opponent=other(shooter);
 const objects=pocketed.filter(n=>Number.isInteger(n)&&n>0);
 const scratch=pocketed.includes(0);
 const legal=!scratch&&Number.isInteger(lowestBallAtStart)&&firstContact===lowestBallAtStart;
 if(!legal)return {
  score:0,turn:opponent,winner:null,foul:true,respotted:objects.includes(mode==='9-ball'?9:10)?(mode==='9-ball'?9:10):null,
  reason:scratch?'cue ball scratched':'lowest-numbered ball was not contacted first'
 };
 const target=mode==='9-ball'?9:10;
 if(objects.includes(target)){
  if(mode==='10-ball'){
   const ball=balls.find(b=>b.number===target);
   if(!ball||ball.pocketIndex!==calledPocket)return {
    score:0,turn:opponent,winner:null,foul:false,respotted:target,
    reason:'10-ball missed the called pocket'
   };
  }
  return {score:objects.length,turn:'over',winner:shooter,foul:false,respotted:null,reason:'target ball legally pocketed'};
 }
 return {
  score:objects.length,turn:objects.length?shooter:opponent,
  winner:null,foul:false,respotted:null,
  reason:objects.length?'legal pocket; shooter continues':'no ball pocketed; turn passes'
 };
}
