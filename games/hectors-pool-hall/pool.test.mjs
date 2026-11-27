import test from 'node:test';
import assert from 'node:assert/strict';
import {createRack,shoot,stepPhysics,isMoving} from './pool.mjs';
import {chooseShot,DIFFICULTIES} from './opponent.mjs';

test('creates mode-specific racks with one cue ball',()=>{
 for(const [mode,count] of Object.entries({'8-ball':15,'9-ball':9,'10-ball':10,'straight-pool':15,cutthroat:15,practice:9})){
  const balls=createRack(mode);
  assert.equal(balls.length,count+1,mode);
  assert.equal(balls.filter(b=>b.number===0).length,1,mode);
 }
});

test('cue shot applies a bounded velocity in the selected direction',()=>{
 const balls=createRack('practice');
 assert.equal(shoot(balls,{x:350,y:280},.5),true);
 const cue=balls[0];
 assert.ok(cue.vx>0);
 assert.equal(cue.vy,0);
 assert.ok(Math.hypot(cue.vx,cue.vy)<=14.6);
});

test('rejects zero-length and invalid shots',()=>{
 const balls=createRack('practice');
 assert.equal(shoot(balls,{x:250,y:280},.5),false);
 assert.equal(shoot(balls,{x:NaN,y:1},.5),false);
});

test('physics moves balls and eventually damps velocity',()=>{
 const balls=createRack('practice');
 shoot(balls,{x:450,y:280},.3);
 assert.equal(isMoving(balls),true);
 for(let i=0;i<500&&isMoving(balls);i++)stepPhysics(balls);
 assert.equal(isMoving(balls),false);
});

test('balls collide and transfer momentum',()=>{
 const balls=[
  {number:0,x:200,y:200,vx:5,vy:0,active:true},
  {number:1,x:225,y:200,vx:0,vy:0,active:true}
 ];
 const events=stepPhysics(balls);
 assert.ok(balls[1].vx>0);
 assert.equal(events.firstContact,1);
});

test('AI returns a legal aim point for each of six difficulty tiers',()=>{
 const balls=createRack('8-ball');
 for(let i=0;i<6;i++){
  const shot=chooseShot(balls,i,()=>.5);
  assert.ok(Number.isFinite(shot.x)&&Number.isFinite(shot.y));
  assert.ok(shot.power>=.2&&shot.power<=1);
 }
 assert.equal(DIFFICULTIES.length,6);
});

test('AI gracefully declines a rack with no cue or no targets',()=>{
 assert.equal(chooseShot([],2),null);
 assert.equal(chooseShot([{number:0,x:250,y:280,active:true}],2),null);
});
