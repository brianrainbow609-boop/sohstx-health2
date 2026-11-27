import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveStraightPool,resolveCutthroat,cutthroatGroup} from './arcade-rules.mjs';

test('straight pool counts legal pockets',()=>{
 const r=resolveStraightPool({shooter:'player',firstContact:1,pocketed:[1,2],scores:{player:0,computer:0}});
 assert.equal(r.scores.player,2);
 assert.equal(r.turn,'player');
});

test('straight pool penalizes scratches',()=>{
 const r=resolveStraightPool({shooter:'player',firstContact:1,pocketed:[0,1],scores:{player:3,computer:0}});
 assert.equal(r.scores.player,2);
 assert.equal(r.turn,'computer');
});

test('straight pool ends at target score',()=>{
 const r=resolveStraightPool({shooter:'player',firstContact:1,pocketed:[1],scores:{player:49,computer:0}});
 assert.equal(r.winner,'player');
});

test('cutthroat assigns three distinct groups',()=>{
 assert.equal(cutthroatGroup(1),'player');
 assert.equal(cutthroatGroup(6),'computer');
 assert.equal(cutthroatGroup(11),'computer2');
});

test('cutthroat rotates through three players',()=>{
 const balls=[1,6,11].map(number=>({number,active:true}));
 const r=resolveCutthroat({shooter:'computer',firstContact:1,balls});
 assert.equal(r.turn,'computer2');
});

test('cutthroat skips eliminated opponents',()=>{
 const balls=[1,11].map(number=>({number,active:true}));
 const r=resolveCutthroat({shooter:'player',firstContact:11,balls});
 assert.equal(r.turn,'computer2');
});

test('cutthroat recognizes last surviving player',()=>{
 const r=resolveCutthroat({shooter:'player',firstContact:6,pocketed:[6],balls:[{number:1,active:true}]});
 assert.equal(r.winner,'player');
 assert.equal(r.turn,'over');
});
