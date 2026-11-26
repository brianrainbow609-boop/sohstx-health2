import assert from 'node:assert/strict';
import {test} from 'node:test';
import {opponentBuild,newFight,resolvePunch,restoreProgress,upgrade} from './combat.mjs';
test('level and allocation',()=>{const b=opponentBuild({wins:10,losses:3},()=>0);assert.equal(b.level,8);assert.equal(b.strength,8);assert.equal(b.speed+b.accuracy,2)});
test('level bounds',()=>{assert.equal(opponentBuild({wins:0,losses:50}).level,1);assert.equal(opponentBuild({wins:500}).level,100)});
test('legacy save',()=>{const p=restoreProgress({wins:4},[{id:'hector'},{id:'erasmo'}]);assert.equal(p.losses,0);assert.equal(p.wins,4)});
test('loss counted once',()=>{const p={wins:0,losses:0,points:0,strength:1,speed:1,accuracy:1};const f=newFight(p,()=>0);f.health=1;resolvePunch(p,f,0,()=>0);assert.equal(f.result,'loss');assert.equal(p.losses,1);resolvePunch(p,f,1000,()=>0);assert.equal(p.losses,1)});
test('win counted once',()=>{const p={wins:0,losses:0,points:0,strength:1,speed:1,accuracy:1};const f=newFight(p,()=>0);f.opponentHealth=1;resolvePunch(p,f,0,()=>0);assert.equal(p.wins,1);assert.equal(p.losses,0);resolvePunch(p,f,1000,()=>0);assert.equal(p.wins,1)});
test('upgrade budget',()=>{const p={points:5,strength:1};assert.equal(upgrade(p,'strength'),true);assert.equal(p.points,0);assert.equal(upgrade(p,'strength'),false)});
test('opponent strength increases damage',()=>{const p={wins:10,losses:0,points:0,strength:1,speed:1,accuracy:1};const f=newFight(p,()=>0);assert.equal(resolvePunch(p,f,0,()=>0).counter,23)});

