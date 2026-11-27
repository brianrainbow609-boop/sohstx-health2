import {POCKETS,BALL_RADIUS} from './pool.mjs';

export const DIFFICULTIES=[
 {name:'Beginner',jitter:.34,power:.48},
 {name:'Casual',jitter:.25,power:.56},
 {name:'Club',jitter:.17,power:.64},
 {name:'Skilled',jitter:.105,power:.70},
 {name:'Expert',jitter:.055,power:.77},
 {name:'Legendary',jitter:.018,power:.84}
];

export function chooseShot(balls,difficulty=1,rng=Math.random,eligibleNumbers=null){
 const cue=balls.find(b=>b.number===0&&b.active);
 if(!cue) return null;
 const level=DIFFICULTIES[Math.max(0,Math.min(5,difficulty|0))];
 const targets=balls.filter(b=>b.active&&b.number!==0&&(!Array.isArray(eligibleNumbers)||eligibleNumbers.includes(b.number)));
 if(!targets.length)return null;
 let best=null;
 for(const ball of targets){
  for(const pocket of POCKETS){
   const pd=Math.hypot(pocket.x-ball.x,pocket.y-ball.y);
   const ux=(pocket.x-ball.x)/(pd||1),uy=(pocket.y-ball.y)/(pd||1);
   const ghost={x:ball.x-ux*BALL_RADIUS*2.1,y:ball.y-uy*BALL_RADIUS*2.1};
   const score=Math.hypot(ghost.x-cue.x,ghost.y-cue.y)+pd*.42;
   if(!best||score<best.score)best={x:ghost.x,y:ghost.y,score,pocketIndex:POCKETS.indexOf(pocket)};
  }
 }
 const angle=Math.atan2(best.y-cue.y,best.x-cue.x)+(rng()-.5)*level.jitter;
 const distance=Math.hypot(best.x-cue.x,best.y-cue.y);
 return {
  x:cue.x+Math.cos(angle)*distance,
  y:cue.y+Math.sin(angle)*distance,
  power:Math.max(.2,Math.min(1,level.power+(rng()-.5)*level.jitter)),
  pocketIndex:best.pocketIndex
 };
}
