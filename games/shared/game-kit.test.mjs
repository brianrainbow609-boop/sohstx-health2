import assert from 'node:assert/strict';import {createGameState,saveGame,loadGame,animationFrame,spriteMetadata} from './game-kit.mjs';
const data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)||null};
const game=createGameState({name:'Demo',initial:{coins:5}});saveGame(storage,'demo',game);assert.equal(loadGame(storage,'demo').data.coins,5);
assert.equal(loadGame(storage,'missing'),null);assert.equal(animationFrame({frameCount:4,fps:10,elapsedMs:250}),2);assert.equal(animationFrame({frameCount:4,fps:10,elapsedMs:450}),0);
assert.deepEqual(spriteMetadata({id:'hector',name:'Hector',type:'character',tags:['crew','crew']}).tags,['crew']);
assert.equal(spriteMetadata({id:'erasmo',name:'Erasmo',type:'character'}).name,'Erasmo');
assert.throws(()=>saveGame(storage,'../bad',game));assert.throws(()=>animationFrame({frameCount:0}));assert.throws(()=>loadGame({getItem:()=>'{"name":"bad"}'},'demo'));
console.log('9 shared game-kit assertions passed');

