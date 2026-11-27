import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEightBallShot as resolve,resolveRotationShot} from './rules.mjs';

const balls=(numbers)=>numbers.map(number=>({number,active:true}));

test('first legal pocket assigns solids and stripes and keeps the shooter',()=>{
 const r=resolve({shooter:'player',firstContact:1,pocketed:[1],balls:balls([2,3,8,9,10])});
 assert.deepEqual(r.groups,{player:'solids',computer:'stripes'});
 assert.equal(r.turn,'player');
 assert.equal(r.foul,false);
 assert.equal(r.score,1);
});

test('wrong first contact is a foul and gives the opponent ball in hand',()=>{
 const r=resolve({shooter:'player',firstContact:9,pocketed:[1],balls:balls([2,8,9]) ,groups:{player:'solids',computer:'stripes'}});
 assert.equal(r.foul,true);
 assert.equal(r.turn,'computer');
 assert.equal(r.score,0);
});

test('cue scratch is a foul even after a legal first contact',()=>{
 const r=resolve({shooter:'player',firstContact:1,pocketed:[0,1],balls:balls([2,8,9]),groups:{player:'solids',computer:'stripes'}});
 assert.equal(r.foul,true);
 assert.equal(r.turn,'computer');
});

test('legal 8-ball wins after the shooter clears their group',()=>{
 const r=resolve({shooter:'player',firstContact:8,pocketed:[8],balls:balls([9,10,11]),groups:{player:'solids',computer:'stripes'}});
 assert.equal(r.winner,'player');
 assert.equal(r.foul,false);
 assert.equal(r.turn,'over');
});

test('early 8-ball pocket loses the rack',()=>{
 const r=resolve({shooter:'player',firstContact:8,pocketed:[8],balls:balls([2,3,8,9]),groups:{player:'solids',computer:'stripes'}});
 assert.equal(r.winner,'computer');
});

test('8-ball pocketed before groups are assigned loses the rack',()=>{
 const r=resolve({shooter:'player',firstContact:8,pocketed:[8],balls:balls([9,10])});
 assert.equal(r.winner,'computer');
 assert.equal(r.foul,true);
});

test('9-ball requires the lowest active ball to be contacted first',()=>{
 const r=resolveRotationShot({mode:'9-ball',shooter:'player',firstContact:2,lowestBallAtStart:1,pocketed:[1],balls:balls([3,9])});
 assert.equal(r.foul,true);
 assert.equal(r.turn,'computer');
});

test('legal 9-ball pocket wins the rack',()=>{
 const r=resolveRotationShot({mode:'9-ball',shooter:'player',firstContact:1,lowestBallAtStart:1,pocketed:[9],balls:balls([])});
 assert.equal(r.winner,'player');
 assert.equal(r.turn,'over');
});

test('10-ball requires the called pocket',()=>{
 const rack=balls([1,2,3]);rack.push({number:10,active:false,pocketIndex:4});
 const r=resolveRotationShot({mode:'10-ball',shooter:'player',firstContact:1,lowestBallAtStart:1,pocketed:[10],balls:rack,calledPocket:2});
 assert.equal(r.winner,null);
 assert.equal(r.respotted,10);
 assert.equal(r.turn,'computer');
});

test('10-ball wins when the called pocket matches',()=>{
 const rack=balls([1,2,3]);rack.push({number:10,active:false,pocketIndex:4});
 const r=resolveRotationShot({mode:'10-ball',shooter:'player',firstContact:1,lowestBallAtStart:1,pocketed:[10],balls:rack,calledPocket:4});
 assert.equal(r.winner,'player');
});
