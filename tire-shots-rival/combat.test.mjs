import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cooldown,opponentBuild,newFight,resolvePunch,restoreProgress,upgrade} from './combat.mjs';
test('level and allocation',()=>{const b=opponentBuild({wins:10,losses:3},()=>0);assert.equal(b.level,8);assert.equal(b.strength,8);assert.equal(b.speed+b.accuracy,2)});
test('level bounds',()=>{assert.equal(opponentBuild({wins:0,losses:50}).level,1);assert.equal(opponentBuild({wins:500}).level,100)});
test('legacy save',()=>{const p=restoreProgress({wins:4},[{id:'hector'},{id:'erasmo'}]);assert.equal(p.losses,0);assert.equal(p.wins,4)});
test('loss counted once',()=>{const p={wins:0,losses:0,points:0,strength:1,speed:1,accuracy:1};const f=newFight(p,()=>0);f.health=1;resolvePunch(p,f,0,()=>0);assert.equal(f.result,'loss');assert.equal(p.losses,1);resolvePunch(p,f,1000,()=>0);assert.equal(p.losses,1)});
test('win counted once',()=>{const p={wins:0,losses:0,points:0,strength:1,speed:1,accuracy:1};const f=newFight(p,()=>0);f.opponentHealth=1;resolvePunch(p,f,0,()=>0);assert.equal(p.wins,1);assert.equal(p.losses,0);resolvePunch(p,f,1000,()=>0);assert.equal(p.wins,1)});
test('upgrade budget',()=>{const p={points:5,strength:1};assert.equal(upgrade(p,'strength'),true);assert.equal(p.points,0);assert.equal(upgrade(p,'strength'),false)});
test('opponent strength increases damage',()=>{const p={wins:10,losses:0,points:0,strength:1,speed:1,accuracy:1};const f=newFight(p,()=>0);assert.equal(resolvePunch(p,f,0,()=>0).counter,23)});


test('speed reduces cooldown with a hard lower bound',()=>{assert.equal(cooldown(1),645);assert.ok(cooldown(5)<cooldown(1));assert.equal(cooldown(100),120)});
test('power increases successful punch damage',()=>{const make=strength=>({points:0,wins:0,losses:0,strength,speed:1,accuracy:1});const low=make(1),high=make(4);const a=newFight(low,()=>0),b=newFight(high,()=>0);resolvePunch(low,a,0,()=>0);resolvePunch(high,b,0,()=>0);assert.equal(a.opponentHealth,93);assert.equal(b.opponentHealth,87)});
test('accuracy improves hit probability at the same random roll',()=>{const make=accuracy=>({points:0,wins:0,losses:0,strength:1,speed:1,accuracy});const low=make(1),high=make(5);const a=newFight(low,()=>0),b=newFight(high,()=>0);resolvePunch(low,a,0,()=>0.7);resolvePunch(high,b,0,()=>0.7);assert.equal(a.opponentHealth,100);assert.equal(b.opponentHealth,90)});
test('invalid saved stats reset safely and duplicate fighters are separated',()=>{const p=restoreProgress({points:-1,wins:-4,round:0,strength:-9,speed:1.5,accuracy:999,me:'hector',enemy:'hector'},[{id:'hector'},{id:'erasmo'}]);assert.equal(p.points,0);assert.equal(p.wins,0);assert.equal(p.round,1);assert.equal(p.strength,1);assert.equal(p.speed,1);assert.equal(p.accuracy,1);assert.equal(p.enemy,'erasmo')});
