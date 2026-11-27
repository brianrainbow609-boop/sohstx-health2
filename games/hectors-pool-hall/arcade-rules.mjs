export function resolveStraightPool({shooter,firstContact,pocketed=[],scores,target=50}){
 const opponent=shooter==='player'?'computer':'player';
 const next={...scores};
 const foul=pocketed.includes(0)||firstContact==null;
 const count=pocketed.filter(n=>n>0).length;
 next[shooter]+=foul?-1:count;
 const winner=next[shooter]>=target?shooter:null;
 return {
  scores:next,foul,winner,
  turn:winner?'over':foul||!count?opponent:shooter
 };
}

export const CUTTHROAT_PLAYERS=['player','computer','computer2'];

export function cutthroatGroup(number){
 return number>=1&&number<=15
  ? CUTTHROAT_PLAYERS[Math.floor((number-1)/5)]
  : null;
}

export function resolveCutthroat({shooter,firstContact,pocketed=[],balls}){
 const remaining=Object.fromEntries(
  CUTTHROAT_PLAYERS.map(p=>[p,balls.filter(b=>b.active&&cutthroatGroup(b.number)===p).length])
 );
 const alive=CUTTHROAT_PLAYERS.filter(p=>remaining[p]>0);
 const foul=pocketed.includes(0)||firstContact==null;
 const winner=alive.length===1?alive[0]:null;
 const keep=!foul&&remaining[shooter]>0&&pocketed.some(n=>n>0&&cutthroatGroup(n)!==shooter);
 const index=CUTTHROAT_PLAYERS.indexOf(shooter);
 const next=[1,2,3].map(i=>CUTTHROAT_PLAYERS[(index+i)%3]).find(p=>alive.includes(p));
 return {
  remaining,foul,winner,
  turn:winner||!alive.length?'over':keep?shooter:next
 };
}
